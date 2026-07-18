import hashlib
import secrets
from datetime import UTC, datetime, timedelta

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import create_access_token
from app.models.models import RefreshToken, User


class RefreshTokenError(ValueError):
    pass


class RefreshTokenReplayError(RefreshTokenError):
    pass


def _now() -> datetime:
    return datetime.now(UTC)


def _aware(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=UTC)


def hash_refresh_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create_refresh_token_record(db: Session, user: User) -> tuple[str, RefreshToken]:
    settings = get_settings()
    raw_token = secrets.token_urlsafe(48)
    record = RefreshToken(
        user_id=user.id,
        token_hash=hash_refresh_token(raw_token),
        expires_at=_now() + timedelta(days=settings.refresh_token_expire_days),
    )
    db.add(record)
    db.flush()
    return raw_token, record


def issue_token_pair(db: Session, user: User) -> dict[str, str | int]:
    settings = get_settings()
    refresh_token, _ = create_refresh_token_record(db, user)
    return {
        "access_token": create_access_token(str(user.id)),
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "expires_in": settings.access_token_expire_minutes * 60,
    }


def rotate_refresh_token(db: Session, raw_token: str) -> tuple[User, dict[str, str | int]]:
    record = db.query(RefreshToken).filter(RefreshToken.token_hash == hash_refresh_token(raw_token)).first()
    if not record:
        raise RefreshTokenError("Invalid refresh token")
    if record.revoked_at is not None:
        if record.replaced_by_id is not None:
            db.query(RefreshToken).filter(
                RefreshToken.user_id == record.user_id,
                RefreshToken.revoked_at.is_(None),
            ).update({RefreshToken.revoked_at: _now()}, synchronize_session=False)
            raise RefreshTokenReplayError("Refresh token replay detected")
        raise RefreshTokenError("Refresh token has been revoked")
    if _aware(record.expires_at) <= _now():
        record.revoked_at = _now()
        raise RefreshTokenError("Refresh token has expired")
    user = db.get(User, record.user_id)
    if not user or not user.is_active:
        raise RefreshTokenError("User not found or disabled")
    record.revoked_at = _now()
    record.last_used_at = _now()
    pair = issue_token_pair(db, user)
    replacement = db.query(RefreshToken).filter(
        RefreshToken.token_hash == hash_refresh_token(str(pair["refresh_token"]))
    ).one()
    record.replaced_by_id = replacement.id
    return user, pair


def revoke_refresh_token(db: Session, raw_token: str, user_id: int) -> bool:
    record = db.query(RefreshToken).filter(
        RefreshToken.token_hash == hash_refresh_token(raw_token),
        RefreshToken.user_id == user_id,
    ).first()
    if not record or record.revoked_at is not None:
        return False
    record.revoked_at = _now()
    return True
