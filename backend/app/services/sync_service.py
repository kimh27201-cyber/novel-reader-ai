import json
from datetime import UTC, datetime, timedelta
from typing import Any

from fastapi.encoders import jsonable_encoder
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.models import (
    Book,
    BookSource,
    ReadingHistory,
    SyncChange,
    SyncDevice,
    SyncMutation,
    make_source_identity_hash,
)
from app.schemas.sync import SyncMutationRequest
from app.services.source_secrets import protect_source_secrets, redact_source_secrets


def now_utc() -> datetime:
    return datetime.now(UTC)


def parse_client_datetime(value: Any) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=UTC)
    except ValueError:
        return None


def serialize_entity(entity_type: str, entity: Any, db: Session | None = None) -> dict[str, Any]:
    if entity_type == "book":
        return jsonable_encoder({
            "sync_id": entity.sync_id,
            "version": entity.version,
            "title": entity.title,
            "author": entity.author,
            "cover_url": entity.cover_url,
            "description": entity.description,
            "book_url": entity.book_url,
            "toc_url": entity.toc_url,
            "source_sync_id": entity.source.sync_id if entity.source else None,
            "updated_at": entity.updated_at,
        })
    if entity_type == "source":
        try:
            raw = json.loads(entity.raw_json)
        except json.JSONDecodeError:
            raw = {}
        return jsonable_encoder({
            "sync_id": entity.sync_id,
            "version": entity.version,
            "name": entity.name,
            "base_url": entity.base_url,
            "group": entity.group,
            "enabled": entity.enabled,
            "raw": redact_source_secrets(raw),
            "compatibility": entity.compatibility,
            "updated_at": entity.updated_at,
        })
    if entity_type == "reading_history":
        book_sync_id = entity.book.sync_id if entity.book else ""
        return jsonable_encoder({
            "sync_id": entity.sync_id,
            "version": entity.version,
            "book_sync_id": book_sync_id,
            "chapter_index": entity.chapter_index,
            "page_index": entity.page_index,
            "progress_percent": entity.progress_percent,
            "updated_at": entity.updated_at,
        })
    raise ValueError(f"Unsupported sync entity: {entity_type}")


def record_change(
    db: Session,
    *,
    user_id: int,
    entity_type: str,
    sync_id: str,
    operation: str,
    version: int,
    payload: dict[str, Any],
) -> SyncChange:
    change = SyncChange(
        user_id=user_id,
        entity_type=entity_type,
        sync_id=sync_id,
        operation=operation,
        version=version,
        payload_json=json.dumps(jsonable_encoder(payload), ensure_ascii=False),
    )
    db.add(change)
    db.flush()
    return change


def _find_entity(db: Session, entity_type: str, user_id: int, sync_id: str) -> Any | None:
    model = {"book": Book, "source": BookSource, "reading_history": ReadingHistory}[entity_type]
    return db.query(model).filter(model.user_id == user_id, model.sync_id == sync_id).first()


def _source_for_sync_id(db: Session, user_id: int, sync_id: str | None) -> BookSource | None:
    if not sync_id:
        return None
    return db.query(BookSource).filter(
        BookSource.user_id == user_id,
        BookSource.sync_id == sync_id,
        BookSource.deleted_at.is_(None),
    ).first()


def _book_for_sync_id(db: Session, user_id: int, sync_id: str) -> Book | None:
    return db.query(Book).filter(
        Book.user_id == user_id,
        Book.sync_id == sync_id,
        Book.deleted_at.is_(None),
    ).first()


def _merge_existing_identity(db: Session, entity_type: str, user_id: int, payload: dict[str, Any]) -> Any | None:
    if entity_type == "book" and payload.get("book_url"):
        source = _source_for_sync_id(db, user_id, payload.get("source_sync_id"))
        return db.query(Book).filter(
            Book.user_id == user_id,
            Book.source_id == (source.id if source else None),
            Book.book_url == str(payload["book_url"]).strip(),
            Book.deleted_at.is_(None),
        ).first()
    if entity_type == "source" and payload.get("name") and payload.get("base_url"):
        identity_hash = make_source_identity_hash(str(payload["name"]), str(payload["base_url"]))
        return db.query(BookSource).filter(
            BookSource.user_id == user_id,
            BookSource.identity_hash == identity_hash,
            BookSource.deleted_at.is_(None),
        ).first()
    if entity_type == "reading_history" and payload.get("book_sync_id"):
        book = _book_for_sync_id(db, user_id, str(payload["book_sync_id"]))
        if book:
            return db.query(ReadingHistory).filter(
                ReadingHistory.user_id == user_id,
                ReadingHistory.book_id == book.id,
                ReadingHistory.deleted_at.is_(None),
            ).first()
    return None


def _create_entity(db: Session, mutation: SyncMutationRequest, user_id: int) -> Any:
    payload = mutation.payload
    if mutation.entity_type == "book":
        if not str(payload.get("title") or "").strip():
            raise ValueError("Book title is required")
        source = _source_for_sync_id(db, user_id, payload.get("source_sync_id"))
        if payload.get("source_sync_id") and source is None:
            raise ValueError("Book source does not exist")
        return Book(user_id=user_id, source_id=source.id if source else None, sync_id=mutation.sync_id)
    if mutation.entity_type == "source":
        if not str(payload.get("name") or "").strip() or not str(payload.get("base_url") or "").strip():
            raise ValueError("Source name and base_url are required")
        return BookSource(user_id=user_id, sync_id=mutation.sync_id, raw_json="{}")
    book = _book_for_sync_id(db, user_id, str(payload.get("book_sync_id") or ""))
    if not book:
        raise ValueError("Reading history book does not exist")
    return ReadingHistory(user_id=user_id, book_id=book.id, sync_id=mutation.sync_id)


def _apply_payload(db: Session, entity_type: str, entity: Any, payload: dict[str, Any], user_id: int) -> None:
    if entity_type == "book":
        source = _source_for_sync_id(db, user_id, payload.get("source_sync_id"))
        if payload.get("source_sync_id") and source is None:
            raise ValueError("Book source does not exist")
        entity.source_id = source.id if source else None
        entity.title = str(payload.get("title") or entity.title or "未命名").strip()
        entity.author = str(payload.get("author") or entity.author or "未知作者").strip()
        for field in ["cover_url", "description", "book_url", "toc_url"]:
            if field in payload:
                setattr(entity, field, str(payload.get(field) or "").strip())
    elif entity_type == "source":
        for field in ["name", "group", "compatibility"]:
            if field in payload:
                setattr(entity, field, str(payload.get(field) or "").strip())
        if "base_url" in payload:
            entity.base_url = str(payload.get("base_url") or "").strip().rstrip("/")
        if "enabled" in payload:
            entity.enabled = bool(payload["enabled"])
        if "raw" in payload:
            entity.raw_json = json.dumps(protect_source_secrets(payload.get("raw") or {}), ensure_ascii=False)
        entity.identity_hash = make_source_identity_hash(entity.name, entity.base_url)
    else:
        book = _book_for_sync_id(db, user_id, str(payload.get("book_sync_id") or ""))
        if not book:
            raise ValueError("Reading history book does not exist")
        entity.book_id = book.id
        entity.chapter_id = None
        entity.chapter_index = max(0, int(payload.get("chapter_index") or 0))
        entity.page_index = max(0, int(payload.get("page_index") or 0))
        entity.progress_percent = min(100, max(0, float(payload.get("progress_percent") or 0)))


def apply_mutation(db: Session, mutation: SyncMutationRequest, user_id: int) -> dict[str, Any]:
    previous = db.query(SyncMutation).filter(
        SyncMutation.user_id == user_id,
        SyncMutation.mutation_id == mutation.mutation_id,
    ).first()
    if previous:
        return json.loads(previous.result_json)

    entity = _find_entity(db, mutation.entity_type, user_id, mutation.sync_id)
    identity_merge = False
    if entity is None and mutation.operation == "upsert" and mutation.base_version == 0:
        entity = _merge_existing_identity(db, mutation.entity_type, user_id, mutation.payload)
        identity_merge = entity is not None
    canonical_sync_id = entity.sync_id if entity is not None else mutation.sync_id
    incoming_updated_at = parse_client_datetime(mutation.payload.get("updated_at"))
    server_updated_at = None
    if entity is not None and getattr(entity, "updated_at", None) is not None:
        server_updated_at = entity.updated_at
        if server_updated_at.tzinfo is None:
            server_updated_at = server_updated_at.replace(tzinfo=UTC)
    server_wins_initial_merge = bool(
        identity_merge
        and mutation.operation == "upsert"
        and (incoming_updated_at is None or (server_updated_at is not None and incoming_updated_at <= server_updated_at))
    )

    if server_wins_initial_merge:
        result = {
            "mutation_id": mutation.mutation_id,
            "status": "applied",
            "entity_type": mutation.entity_type,
            "sync_id": canonical_sync_id,
            "version": entity.version,
            "error_code": "",
            "message": "Server copy was newer during initial merge",
            "server_payload": serialize_entity(mutation.entity_type, entity, db),
        }
    elif entity is not None and mutation.base_version != entity.version and not (identity_merge and mutation.base_version == 0):
        result = {
            "mutation_id": mutation.mutation_id,
            "status": "conflict",
            "entity_type": mutation.entity_type,
            "sync_id": canonical_sync_id,
            "version": entity.version,
            "error_code": "version_conflict",
            "message": "Server version has changed",
            "server_payload": serialize_entity(mutation.entity_type, entity, db),
        }
    else:
        savepoint = db.begin_nested()
        try:
            if mutation.operation == "delete":
                version = (entity.version + 1) if entity is not None else max(1, mutation.base_version + 1)
                if entity is not None:
                    entity.deleted_at = now_utc()
                    entity.version = version
                    if hasattr(entity, "enabled"):
                        entity.enabled = False
                payload = {}
                record_change(
                    db,
                    user_id=user_id,
                    entity_type=mutation.entity_type,
                    sync_id=canonical_sync_id,
                    operation="delete",
                    version=version,
                    payload=payload,
                )
            else:
                if entity is None:
                    entity = _create_entity(db, mutation, user_id)
                    db.add(entity)
                    version = 1
                else:
                    version = entity.version + 1 if (mutation.base_version or identity_merge) else entity.version
                _apply_payload(db, mutation.entity_type, entity, mutation.payload, user_id)
                entity.deleted_at = None
                entity.version = max(1, version)
                db.flush()
                canonical_sync_id = entity.sync_id
                payload = serialize_entity(mutation.entity_type, entity, db)
                record_change(
                    db,
                    user_id=user_id,
                    entity_type=mutation.entity_type,
                    sync_id=canonical_sync_id,
                    operation="upsert",
                    version=entity.version,
                    payload=payload,
                )
            savepoint.commit()
            result = {
                "mutation_id": mutation.mutation_id,
                "status": "applied",
                "entity_type": mutation.entity_type,
                "sync_id": canonical_sync_id,
                "version": version,
                "error_code": "",
                "message": "",
                "server_payload": payload or None,
            }
        except (TypeError, ValueError) as exc:
            savepoint.rollback()
            result = {
                "mutation_id": mutation.mutation_id,
                "status": "rejected",
                "entity_type": mutation.entity_type,
                "sync_id": canonical_sync_id,
                "version": 0,
                "error_code": "invalid_payload",
                "message": str(exc),
                "server_payload": None,
            }

    db.add(SyncMutation(
        user_id=user_id,
        mutation_id=mutation.mutation_id,
        result_json=json.dumps(jsonable_encoder(result), ensure_ascii=False),
    ))
    return result


def update_device_cursor(db: Session, user_id: int, device_id: str, cursor: int) -> SyncDevice:
    device = db.query(SyncDevice).filter(
        SyncDevice.user_id == user_id,
        SyncDevice.device_id == device_id,
    ).first()
    if not device:
        device = SyncDevice(user_id=user_id, device_id=device_id)
        db.add(device)
    device.last_cursor = max(device.last_cursor or 0, cursor)
    device.last_seen_at = now_utc()
    return device


def latest_cursor(db: Session, user_id: int) -> int:
    return int(db.query(func.max(SyncChange.id)).filter(SyncChange.user_id == user_id).scalar() or 0)


def cleanup_synced_tombstones(db: Session, user_id: int) -> None:
    devices = db.query(SyncDevice).filter(SyncDevice.user_id == user_id).all()
    if not devices:
        return
    minimum_cursor = min(device.last_cursor for device in devices)
    cutoff = now_utc() - timedelta(days=30)
    tombstones = db.query(SyncChange).filter(
        SyncChange.user_id == user_id,
        SyncChange.operation == "delete",
        SyncChange.id <= minimum_cursor,
        SyncChange.created_at < cutoff,
    ).all()
    for change in tombstones:
        entity = _find_entity(db, change.entity_type, user_id, change.sync_id)
        if entity is not None and entity.deleted_at is not None and entity.version == change.version:
            db.delete(entity)
        db.query(SyncChange).filter(
            SyncChange.user_id == user_id,
            SyncChange.entity_type == change.entity_type,
            SyncChange.sync_id == change.sync_id,
            SyncChange.id <= change.id,
        ).delete(synchronize_session=False)
