import json
from datetime import UTC, datetime

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.models import Book, BookSource, SourceSession, make_source_identity_hash
from app.services.session_crypto import decrypt_session_value, encrypt_session_value
from app.services.source_secrets import protect_source_secrets, reveal_source_secrets
from app.services.source_parser import compatibility_for
from app.services.sync_service import record_change, serialize_entity


class SourceNotFoundError(LookupError):
    pass


class SourceConflictError(ValueError):
    pass


def get_owned_source(db: Session, *, source_id: int, user_id: int) -> BookSource:
    source = db.query(BookSource).filter(
        BookSource.id == source_id,
        BookSource.user_id == user_id,
        BookSource.deleted_at.is_(None),
    ).first()
    if not source:
        raise SourceNotFoundError("Source not found")
    return source


def source_to_parser_dict(source: BookSource, db: Session | None = None) -> dict:
    session_headers: dict[str, str] = {}
    if db is not None:
        saved_session = db.query(SourceSession).filter(
            SourceSession.user_id == source.user_id,
            SourceSession.source_id == source.id,
            SourceSession.status == "active",
        ).first()
        if saved_session:
            cookie = decrypt_session_value(saved_session.cookie)
            if cookie:
                session_headers["Cookie"] = cookie
            if saved_session.user_agent:
                session_headers["User-Agent"] = saved_session.user_agent
            if saved_session.referer:
                session_headers["Referer"] = saved_session.referer
    return {
        "id": source.id,
        "name": source.name,
        "base_url": source.base_url,
        "group": source.group,
        "raw": reveal_source_secrets(json.loads(source.raw_json)),
        "session_headers": session_headers,
    }


def list_sources(db: Session, *, user_id: int, limit: int, offset: int) -> list[BookSource]:
    return (
        db.query(BookSource)
        .filter(BookSource.user_id == user_id, BookSource.deleted_at.is_(None))
        .order_by(BookSource.updated_at.desc(), BookSource.id.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )


def save_source_configs(db: Session, *, configs: list[dict], user_id: int) -> list[BookSource]:
    imported: list[BookSource] = []
    for config in configs:
        identity_hash = make_source_identity_hash(config["name"], config["base_url"])
        existing = db.query(BookSource).filter(
            BookSource.user_id == user_id,
            BookSource.identity_hash == identity_hash,
        ).first()
        source = existing or BookSource(user_id=user_id)
        source.name = config["name"]
        source.base_url = config["base_url"]
        source.group = config["group"]
        source.enabled = config["enabled"]
        source.raw_json = json.dumps(protect_source_secrets(config["raw"]), ensure_ascii=False)
        source.compatibility = config["compatibility"]
        source.health_status = config.get("health_status", source.health_status or "unknown")
        source.identity_hash = identity_hash
        source.deleted_at = None
        if existing:
            source.version += 1
        else:
            db.add(source)
        imported.append(source)

    try:
        db.flush()
        for source in imported:
            record_change(
                db,
                user_id=user_id,
                entity_type="source",
                sync_id=source.sync_id,
                operation="upsert",
                version=source.version,
                payload=serialize_entity("source", source, db),
            )
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise SourceConflictError("Source conflicts with existing data") from exc
    for source in imported:
        db.refresh(source)
    return imported


def delete_source(db: Session, *, source_id: int, user_id: int) -> BookSource:
    source = get_owned_source(db, source_id=source_id, user_id=user_id)
    db.query(SourceSession).filter(
        SourceSession.user_id == user_id,
        SourceSession.source_id == source.id,
    ).delete(synchronize_session=False)
    db.query(Book).filter(Book.user_id == user_id, Book.source_id == source.id).update(
        {Book.source_id: None},
        synchronize_session=False,
    )
    source.deleted_at = datetime.now(UTC)
    source.enabled = False
    source.version += 1
    record_change(
        db,
        user_id=user_id,
        entity_type="source",
        sync_id=source.sync_id,
        operation="delete",
        version=source.version,
        payload={},
    )
    db.commit()
    return source


def update_source(
    db: Session,
    *,
    source_id: int,
    user_id: int,
    changes: dict,
) -> BookSource:
    source = get_owned_source(db, source_id=source_id, user_id=user_id)
    raw = changes.pop("raw", None)
    for field, value in changes.items():
        if isinstance(value, str):
            value = value.strip()
        if field == "base_url" and isinstance(value, str):
            value = value.rstrip("/")
        setattr(source, field, value)
    if raw is not None:
        source.raw_json = json.dumps(protect_source_secrets(raw), ensure_ascii=False)
        source.compatibility = compatibility_for(raw)
    source.identity_hash = make_source_identity_hash(source.name, source.base_url)
    source.version += 1
    try:
        db.flush()
        record_change(
            db,
            user_id=user_id,
            entity_type="source",
            sync_id=source.sync_id,
            operation="upsert",
            version=source.version,
            payload=serialize_entity("source", source, db),
        )
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise SourceConflictError("Source conflicts with existing data") from exc
    db.refresh(source)
    return source


def get_source_session(db: Session, *, source_id: int, user_id: int) -> SourceSession | None:
    source = get_owned_source(db, source_id=source_id, user_id=user_id)
    return db.query(SourceSession).filter(
        SourceSession.user_id == user_id,
        SourceSession.source_id == source.id,
    ).first()


def save_source_session(
    db: Session,
    *,
    source_id: int,
    user_id: int,
    values: dict,
) -> SourceSession:
    source = get_owned_source(db, source_id=source_id, user_id=user_id)
    session = db.query(SourceSession).filter(
        SourceSession.user_id == user_id,
        SourceSession.source_id == source.id,
    ).first()
    if not session:
        session = SourceSession(user_id=user_id, source_id=source.id)
        db.add(session)

    session.origin = values["origin"]
    session.cookie = encrypt_session_value(values["cookie"])
    session.user_agent = values["user_agent"]
    session.referer = values["referer"]
    session.storage_state_json = encrypt_session_value(values["storage_state_json"])
    session.local_storage_json = encrypt_session_value(values["local_storage_json"])
    session.session_storage_json = encrypt_session_value(values["session_storage_json"])
    session.expires_at = values["expires_at"]
    session.last_verified_at = values["last_verified_at"]
    session.status = values["status"] or "active"
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise SourceConflictError("Source session conflicts with existing data") from exc
    db.refresh(session)
    return session


def delete_source_session(db: Session, *, source_id: int, user_id: int) -> tuple[bool, int]:
    source = get_owned_source(db, source_id=source_id, user_id=user_id)
    deleted = db.query(SourceSession).filter(
        SourceSession.user_id == user_id,
        SourceSession.source_id == source.id,
    ).delete(synchronize_session=False)
    db.commit()
    return deleted > 0, source.id
