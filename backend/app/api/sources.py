import json

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.api.auth import get_current_user
from app.db.session import get_db
from app.models.models import Book, BookSource, User
from app.schemas.sources import (
    SourceBookInfoRequest,
    SourceBookInfoResponse,
    SourceContentRequest,
    SourceContentResponse,
    SourceImportRequest,
    SourceImportResponse,
    SourceRead,
    SourceSearchRequest,
    SourceSearchResponse,
    SourceTocRequest,
    SourceTocResponse,
)
from app.services.demo_source import build_demo_source_content
from app.services.source_parser import (
    SourceParseError,
    load_book_info,
    load_content,
    load_toc,
    parse_source_json,
    search_source,
)


router = APIRouter(prefix="/api/sources", tags=["sources"])


def raise_source_bad_gateway(exc: httpx.HTTPError) -> None:
    raise HTTPException(
        status_code=status.HTTP_502_BAD_GATEWAY,
        detail=f"Source request failed: {exc}",
    ) from exc


def get_owned_source(source_id: int, user_id: int, db: Session) -> BookSource:
    source = db.query(BookSource).filter(BookSource.id == source_id, BookSource.user_id == user_id).first()
    if not source:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Source not found")
    return source


def source_to_parser_dict(source: BookSource) -> dict:
    return {
        "id": source.id,
        "name": source.name,
        "base_url": source.base_url,
        "group": source.group,
        "raw": json.loads(source.raw_json),
    }


def save_source_configs(configs: list[dict], db: Session, current_user: User) -> list[BookSource]:
    imported: list[BookSource] = []
    for config in configs:
        existing = (
            db.query(BookSource)
            .filter(
                BookSource.user_id == current_user.id,
                BookSource.name == config["name"],
                BookSource.base_url == config["base_url"],
            )
            .first()
        )
        source = existing or BookSource(user_id=current_user.id)
        source.name = config["name"]
        source.base_url = config["base_url"]
        source.group = config["group"]
        source.enabled = config["enabled"]
        source.raw_json = json.dumps(config["raw"], ensure_ascii=False)
        source.compatibility = config["compatibility"]
        if not existing:
            db.add(source)
        imported.append(source)

    db.commit()
    for source in imported:
        db.refresh(source)
    return imported


@router.post("/import", response_model=SourceImportResponse, status_code=status.HTTP_201_CREATED)
def import_sources(
    payload: SourceImportRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SourceImportResponse:
    try:
        configs = parse_source_json(payload.content)
    except SourceParseError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    imported = save_source_configs(configs, db, current_user)
    return SourceImportResponse(imported_count=len(imported), sources=imported)


@router.post("/import-demo", response_model=SourceImportResponse, status_code=status.HTTP_201_CREATED)
def import_demo_source(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SourceImportResponse:
    base_url = str(request.base_url).rstrip("/")
    try:
        configs = parse_source_json(build_demo_source_content(base_url))
    except SourceParseError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    imported = save_source_configs(configs, db, current_user)
    return SourceImportResponse(imported_count=len(imported), sources=imported)


@router.get("", response_model=list[SourceRead])
def list_sources(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[BookSource]:
    return (
        db.query(BookSource)
        .filter(BookSource.user_id == current_user.id)
        .order_by(BookSource.updated_at.desc(), BookSource.id.desc())
        .all()
    )


@router.delete("/{source_id}")
def delete_source(
    source_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, bool | int]:
    source = get_owned_source(source_id, current_user.id, db)
    db.query(Book).filter(Book.user_id == current_user.id, Book.source_id == source.id).update(
        {Book.source_id: None},
        synchronize_session=False,
    )
    db.delete(source)
    db.commit()
    return {"deleted": True, "id": source_id}


@router.post("/{source_id}/search", response_model=SourceSearchResponse)
async def search_books_from_source(
    source_id: int,
    payload: SourceSearchRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SourceSearchResponse:
    source = get_owned_source(source_id, current_user.id, db)
    if not source.enabled:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Source is disabled")
    try:
        books = await search_source(source_to_parser_dict(source), payload.keyword, payload.page)
    except (SourceParseError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except httpx.HTTPError as exc:
        raise_source_bad_gateway(exc)
    for book in books:
        book["source_id"] = source.id
        book["source_name"] = source.name
    return SourceSearchResponse(books=books)


@router.post("/{source_id}/book-info", response_model=SourceBookInfoResponse)
async def parse_book_info_from_source(
    source_id: int,
    payload: SourceBookInfoRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SourceBookInfoResponse:
    source = get_owned_source(source_id, current_user.id, db)
    try:
        book = await load_book_info(source_to_parser_dict(source), payload.model_dump())
    except (SourceParseError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except httpx.HTTPError as exc:
        raise_source_bad_gateway(exc)

    return SourceBookInfoResponse(
        source_id=source.id,
        source_name=source.name,
        **book,
    )


@router.post("/{source_id}/toc", response_model=SourceTocResponse)
async def parse_toc_from_source(
    source_id: int,
    payload: SourceTocRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SourceTocResponse:
    source = get_owned_source(source_id, current_user.id, db)
    try:
        chapters = await load_toc(source_to_parser_dict(source), payload.book_url, payload.toc_url)
    except (SourceParseError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except httpx.HTTPError as exc:
        raise_source_bad_gateway(exc)
    return SourceTocResponse(chapters=chapters)


@router.post("/{source_id}/content", response_model=SourceContentResponse)
async def parse_content_from_source(
    source_id: int,
    payload: SourceContentRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SourceContentResponse:
    source = get_owned_source(source_id, current_user.id, db)
    try:
        content = await load_content(source_to_parser_dict(source), payload.chapter_url)
    except (SourceParseError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except httpx.HTTPError as exc:
        raise_source_bad_gateway(exc)
    return SourceContentResponse(content=content)
