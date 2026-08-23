import json

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.api.auth import get_current_user
from app.db.session import get_db
from app.models.models import BookSource, SourceSession, User
from app.schemas.sources import (
    SourceBookInfoRequest,
    SourceBookInfoResponse,
    SourceContentRequest,
    SourceContentResponse,
    SourceImportRequest,
    SourceImportItem,
    SourceImportPreviewResponse,
    SourceImportResponse,
    SourceRead,
    SourceSessionDeleteResponse,
    SourceSessionRead,
    SourceSessionWrite,
    SourceUpdate,
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
    classify_source,
    search_source,
)
from app.services.session_crypto import decrypt_session_value
from app.services.source_service import (
    SourceConflictError,
    SourceNotFoundError,
    delete_source as delete_source_service,
    delete_source_session as delete_source_session_service,
    get_owned_source as get_owned_source_service,
    get_source_session as get_source_session_service,
    list_sources as list_sources_service,
    save_source_configs as save_source_configs_service,
    save_source_session as save_source_session_service,
    source_to_parser_dict,
    update_source as update_source_service,
)
from app.models.models import make_source_identity_hash


router = APIRouter(prefix="/api/sources", tags=["sources"])


def raise_source_bad_gateway(exc: httpx.HTTPError) -> None:
    raise HTTPException(
        status_code=status.HTTP_502_BAD_GATEWAY,
        detail=f"Source request failed ({exc.__class__.__name__})",
    ) from exc


def get_owned_source(source_id: int, user_id: int, db: Session) -> BookSource:
    try:
        return get_owned_source_service(db, source_id=source_id, user_id=user_id)
    except SourceNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


def empty_source_session(source_id: int) -> SourceSessionRead:
    return SourceSessionRead(source_id=source_id, exists=False)


def source_session_to_read(session: SourceSession) -> SourceSessionRead:
    return SourceSessionRead(
        source_id=session.source_id,
        exists=True,
        origin=session.origin,
        user_agent=session.user_agent,
        referer=session.referer,
        cookie=decrypt_session_value(session.cookie),
        storage_state_json=decrypt_session_value(session.storage_state_json),
        local_storage_json=decrypt_session_value(session.local_storage_json),
        session_storage_json=decrypt_session_value(session.session_storage_json),
        expires_at=session.expires_at,
        last_verified_at=session.last_verified_at,
        status=session.status,
        updated_at=session.updated_at,
    )


def save_source_configs(configs: list[dict], db: Session, current_user: User) -> list[BookSource]:
    try:
        return save_source_configs_service(db, configs=configs, user_id=current_user.id)
    except SourceConflictError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc


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

    existing_hashes = {
        row.identity_hash
        for row in db.query(BookSource).filter(BookSource.user_id == current_user.id).all()
    }
    selected: list[dict] = []
    items: list[SourceImportItem] = []
    updated_count = 0
    skipped_count = 0
    unsupported_count = 0
    for config in configs:
        classification = config["classification"]
        identity_hash = make_source_identity_hash(config["name"], config["base_url"])
        exists = identity_hash in existing_hashes
        if classification["status"] != "ready":
            unsupported_count += 1
        if exists and payload.duplicate_strategy == "skip":
            skipped_count += 1
            action = "skipped"
        else:
            selected.append(config)
            action = "updated" if exists else "imported"
            if exists:
                updated_count += 1
            existing_hashes.add(identity_hash)
        items.append(SourceImportItem(**classification, action=action))

    imported = save_source_configs(selected, db, current_user) if selected else []
    return SourceImportResponse(
        imported_count=len(imported),
        updated_count=updated_count,
        skipped_count=skipped_count,
        unsupported_count=unsupported_count,
        sources=imported,
        items=items,
    )


@router.post("/import/preview", response_model=SourceImportPreviewResponse)
def preview_import_sources(
    payload: SourceImportRequest,
    current_user: User = Depends(get_current_user),
) -> SourceImportPreviewResponse:
    del current_user
    try:
        configs = parse_source_json(payload.content)
    except SourceParseError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    items = [
        SourceImportItem(**config["classification"], action="imported")
        for config in configs
    ]
    return SourceImportPreviewResponse(
        total_count=len(items),
        ready_count=sum(item.status == "ready" for item in items),
        unsupported_count=sum(item.status not in {"ready", "invalid"} for item in items),
        invalid_count=sum(item.status == "invalid" for item in items),
        items=items,
    )


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
    limit: int = Query(default=100, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[BookSource]:
    return list_sources_service(db, user_id=current_user.id, limit=limit, offset=offset)


@router.delete("/{source_id}")
def delete_source(
    source_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, bool | int]:
    try:
        delete_source_service(db, source_id=source_id, user_id=current_user.id)
    except SourceNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return {"deleted": True, "id": source_id}


@router.patch("/{source_id}", response_model=SourceRead)
def update_source(
    source_id: int,
    payload: SourceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> BookSource:
    try:
        return update_source_service(
            db,
            source_id=source_id,
            user_id=current_user.id,
            changes=payload.model_dump(exclude_unset=True),
        )
    except SourceNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except SourceConflictError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc


@router.get("/{source_id}/session", response_model=SourceSessionRead)
def get_source_session(
    source_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SourceSessionRead:
    try:
        session = get_source_session_service(db, source_id=source_id, user_id=current_user.id)
    except SourceNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return source_session_to_read(session) if session else empty_source_session(source_id)


@router.put("/{source_id}/session", response_model=SourceSessionRead)
def save_source_session(
    source_id: int,
    payload: SourceSessionWrite,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SourceSessionRead:
    try:
        session = save_source_session_service(
            db,
            source_id=source_id,
            user_id=current_user.id,
            values=payload.model_dump(),
        )
    except SourceNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except SourceConflictError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    return source_session_to_read(session)


@router.delete("/{source_id}/session", response_model=SourceSessionDeleteResponse)
def delete_source_session(
    source_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SourceSessionDeleteResponse:
    try:
        deleted, owned_source_id = delete_source_session_service(
            db,
            source_id=source_id,
            user_id=current_user.id,
        )
    except SourceNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return SourceSessionDeleteResponse(deleted=deleted, source_id=owned_source_id)


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
        books = await search_source(source_to_parser_dict(source, db), payload.keyword, payload.page)
    except (SourceParseError, json.JSONDecodeError, ValueError) as exc:
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
        book = await load_book_info(source_to_parser_dict(source, db), payload.model_dump())
    except (SourceParseError, json.JSONDecodeError, ValueError) as exc:
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
        chapters = await load_toc(source_to_parser_dict(source, db), payload.book_url, payload.toc_url)
    except (SourceParseError, json.JSONDecodeError, ValueError) as exc:
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
        content = await load_content(source_to_parser_dict(source, db), payload.chapter_url)
    except (SourceParseError, json.JSONDecodeError, ValueError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except httpx.HTTPError as exc:
        raise_source_bad_gateway(exc)
    return SourceContentResponse(content=content)
