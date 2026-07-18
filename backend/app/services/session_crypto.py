import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import get_settings


PREFIX = "enc:v1:"


def _fernet() -> Fernet:
    settings = get_settings()
    secret = settings.session_encryption_key or settings.jwt_secret_key
    try:
        key = secret.encode("ascii")
        if len(key) == 44:
            return Fernet(key)
    except UnicodeEncodeError:
        pass
    derived = base64.urlsafe_b64encode(hashlib.sha256(secret.encode("utf-8")).digest())
    return Fernet(derived)


def encrypt_session_value(value: str) -> str:
    text = str(value or "")
    if not text or text.startswith(PREFIX):
        return text
    return PREFIX + _fernet().encrypt(text.encode("utf-8")).decode("ascii")


def decrypt_session_value(value: str) -> str:
    text = str(value or "")
    if not text or not text.startswith(PREFIX):
        return text
    try:
        return _fernet().decrypt(text[len(PREFIX):].encode("ascii")).decode("utf-8")
    except (InvalidToken, ValueError, UnicodeError):
        return ""


def encrypt_legacy_source_sessions() -> int:
    from sqlalchemy.exc import SQLAlchemyError

    from app.db.session import SessionLocal
    from app.models.models import BookSource, SourceSession
    from app.services.source_secrets import protect_source_secrets
    import json

    db = SessionLocal()
    changed = 0
    try:
        for session in db.query(SourceSession).all():
            for field in ["cookie", "storage_state_json", "local_storage_json", "session_storage_json"]:
                value = getattr(session, field)
                encrypted = encrypt_session_value(value)
                if encrypted != value:
                    setattr(session, field, encrypted)
                    changed += 1
        for source in db.query(BookSource).all():
            try:
                raw = json.loads(source.raw_json)
            except json.JSONDecodeError:
                continue
            protected = json.dumps(protect_source_secrets(raw), ensure_ascii=False)
            if protected != source.raw_json:
                source.raw_json = protected
                changed += 1
        if changed:
            db.commit()
        return changed
    except SQLAlchemyError:
        db.rollback()
        return 0
    finally:
        db.close()
