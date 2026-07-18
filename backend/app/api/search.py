import asyncio
import json
import re
import time
import unicodedata
from typing import Any

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.auth import get_current_user
from app.api.sources import source_to_parser_dict
from app.core.config import get_settings
from app.db.session import get_db
from app.models.models import BookSource, SourceHealthCheck, User
from app.schemas.search import (
    BatchDiagnosticRequest,
    BatchDiagnosticResponse,
    DiagnosticStage,
    MultiSourceSearchRequest,
    MultiSourceSearchResponse,
    SourceDiagnosticRequest,
    SourceDiagnosticResponse,
    SourceSearchResult,
)
from app.services.source_parser import SourceParseError, load_book_info, load_content, load_toc, search_source


router = APIRouter(tags=["search"])


def _safe_error_message(exc: Exception) -> str:
    if isinstance(exc, httpx.HTTPError):
        return f"Upstream request failed ({exc.__class__.__name__})"
    message = str(exc)[:300]
    return re.sub(r"(https?://[^?\s]+)\?[^\s]+", r"\1?<redacted>", message)


def _normalized_key(title: str, author: str) -> str:
    value = unicodedata.normalize("NFKC", f"{title}|{author}").lower()
    return re.sub(r"[\W_]+", "", value, flags=re.UNICODE)


def _enabled_sources(db: Session, user_id: int, source_ids: list[int] | None) -> list[BookSource]:
    query = db.query(BookSource).filter(
        BookSource.user_id == user_id,
        BookSource.enabled.is_(True),
        BookSource.deleted_at.is_(None),
    )
    if source_ids is not None:
        query = query.filter(BookSource.id.in_(source_ids))
    sources = query.order_by(BookSource.id.asc()).all()
    if source_ids is not None and len({source.id for source in sources}) != len(set(source_ids)):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="One or more sources were not found or disabled")
    if not sources:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="No enabled sources available")
    return sources


async def _search_one(
    source: BookSource,
    parser_source: dict[str, Any],
    payload: MultiSourceSearchRequest,
    semaphore: asyncio.Semaphore,
) -> tuple[list[dict[str, Any]], SourceSearchResult]:
    started = time.perf_counter()
    try:
        async with semaphore:
            books = await asyncio.wait_for(
                search_source(parser_source, payload.keyword, payload.page, payload.force_refresh),
                timeout=get_settings().source_timeout_seconds,
            )
        for book in books:
            book["source_id"] = source.id
            book["source_name"] = source.name
        return books, SourceSearchResult(
            source_id=source.id,
            source_name=source.name,
            status="success" if books else "empty",
            result_count=len(books),
            duration_ms=int((time.perf_counter() - started) * 1000),
        )
    except (asyncio.TimeoutError, httpx.TimeoutException) as exc:
        return [], SourceSearchResult(
            source_id=source.id,
            source_name=source.name,
            status="failed",
            duration_ms=int((time.perf_counter() - started) * 1000),
            error_code="timeout",
            message="Source search timed out",
        )
    except (httpx.HTTPError, SourceParseError, json.JSONDecodeError, ValueError) as exc:
        return [], SourceSearchResult(
            source_id=source.id,
            source_name=source.name,
            status="failed",
            duration_ms=int((time.perf_counter() - started) * 1000),
            error_code="source_error",
            message=_safe_error_message(exc),
        )
    except Exception as exc:
        return [], SourceSearchResult(
            source_id=source.id,
            source_name=source.name,
            status="failed",
            duration_ms=int((time.perf_counter() - started) * 1000),
            error_code="unexpected_error",
            message=f"Source search failed ({exc.__class__.__name__})",
        )


@router.post("/api/search/books", response_model=MultiSourceSearchResponse)
async def search_books(
    payload: MultiSourceSearchRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MultiSourceSearchResponse:
    started = time.perf_counter()
    sources = _enabled_sources(db, current_user.id, payload.source_ids)
    parser_sources = [source_to_parser_dict(source, db) for source in sources]
    semaphore = asyncio.Semaphore(get_settings().source_max_concurrency)
    groups = await asyncio.gather(*[
        _search_one(source, parser_source, payload, semaphore)
        for source, parser_source in zip(sources, parser_sources)
    ])
    deduplicated: dict[str, dict[str, Any]] = {}
    source_results = []
    for books, source_result in groups:
        source_results.append(source_result)
        for book in books:
            key = _normalized_key(book.get("title", ""), book.get("author", ""))
            if not key:
                continue
            if key not in deduplicated:
                deduplicated[key] = {**book, "alternatives": []}
            else:
                deduplicated[key]["alternatives"].append({
                    "source_id": book["source_id"],
                    "source_name": book["source_name"],
                    "book_url": book["book_url"],
                })
    return MultiSourceSearchResponse(
        books=list(deduplicated.values())[:200],
        source_results=source_results,
        duration_ms=int((time.perf_counter() - started) * 1000),
    )


async def _run_diagnostic(
    source: BookSource,
    parser_source: dict[str, Any],
    payload: SourceDiagnosticRequest,
) -> SourceDiagnosticResponse:
    started = time.perf_counter()
    stages: list[DiagnosticStage] = []
    failed_stage = ""
    error_code = ""
    error_message = ""
    books: list[dict[str, Any]] = []
    book: dict[str, Any] | None = None
    chapters: list[dict[str, Any]] = []

    async def run_stage(name: str, action):
        stage_started = time.perf_counter()
        try:
            result = await asyncio.wait_for(action(), timeout=get_settings().source_timeout_seconds)
            stages.append(DiagnosticStage(
                stage=name,
                status="success",
                duration_ms=int((time.perf_counter() - stage_started) * 1000),
            ))
            return result
        except Exception as exc:
            nonlocal failed_stage, error_code, error_message
            failed_stage = name
            error_code = "timeout" if isinstance(exc, (asyncio.TimeoutError, httpx.TimeoutException)) else "source_error"
            error_message = _safe_error_message(exc) or f"{name} failed"
            stages.append(DiagnosticStage(
                stage=name,
                status="failed",
                duration_ms=int((time.perf_counter() - stage_started) * 1000),
                message=error_message,
            ))
            return None

    books = await run_stage("search", lambda: search_source(parser_source, payload.keyword, 1, payload.force_refresh))
    if books == [] and not failed_stage:
        failed_stage, error_code, error_message = "search", "empty_result", "Search returned no books"
        stages[-1].status = "empty"
        stages[-1].message = error_message
    if books:
        book = await run_stage("book_info", lambda: load_book_info(parser_source, books[0], payload.force_refresh))
    if book and not failed_stage:
        chapters = await run_stage(
            "toc",
            lambda: load_toc(parser_source, book["book_url"], book.get("toc_url"), payload.force_refresh),
        )
    if chapters and not failed_stage:
        await run_stage("content", lambda: load_content(parser_source, chapters[0]["url"], payload.force_refresh))

    if not failed_stage and len(stages) == 4:
        health = "healthy"
    elif stages and stages[0].status == "failed":
        health = "unavailable"
    else:
        health = "degraded"
    return SourceDiagnosticResponse(
        source_id=source.id,
        source_name=source.name,
        status=health,
        failed_stage=failed_stage,
        latency_ms=int((time.perf_counter() - started) * 1000),
        error_code=error_code,
        error_message=error_message,
        stages=stages,
    )


def _store_diagnostic(db: Session, user_id: int, source: BookSource, result: SourceDiagnosticResponse) -> None:
    source.health_status = result.status
    from datetime import UTC, datetime
    source.last_checked_at = datetime.now(UTC)
    db.add(SourceHealthCheck(
        user_id=user_id,
        source_id=source.id,
        status=result.status,
        failed_stage=result.failed_stage,
        latency_ms=result.latency_ms,
        error_code=result.error_code,
        error_message=result.error_message,
        details_json=json.dumps([stage.model_dump() for stage in result.stages], ensure_ascii=False),
    ))


@router.post("/api/sources/{source_id}/diagnostics", response_model=SourceDiagnosticResponse)
async def diagnose_source(
    source_id: int,
    payload: SourceDiagnosticRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SourceDiagnosticResponse:
    source = db.query(BookSource).filter(
        BookSource.id == source_id,
        BookSource.user_id == current_user.id,
        BookSource.deleted_at.is_(None),
    ).first()
    if not source:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Source not found")
    result = await _run_diagnostic(source, source_to_parser_dict(source, db), payload)
    _store_diagnostic(db, current_user.id, source, result)
    db.commit()
    return result


@router.post("/api/sources/diagnostics", response_model=BatchDiagnosticResponse)
async def diagnose_sources(
    payload: BatchDiagnosticRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> BatchDiagnosticResponse:
    sources = _enabled_sources(db, current_user.id, payload.source_ids)
    parser_sources = [source_to_parser_dict(source, db) for source in sources]
    semaphore = asyncio.Semaphore(get_settings().source_max_concurrency)

    async def guarded(source: BookSource, parser_source: dict[str, Any]) -> SourceDiagnosticResponse:
        async with semaphore:
            return await _run_diagnostic(source, parser_source, payload)

    diagnostics = await asyncio.gather(*[
        guarded(source, parser_source)
        for source, parser_source in zip(sources, parser_sources)
    ])
    for source, result in zip(sources, diagnostics):
        _store_diagnostic(db, current_user.id, source, result)
    db.commit()
    return BatchDiagnosticResponse(diagnostics=diagnostics)
