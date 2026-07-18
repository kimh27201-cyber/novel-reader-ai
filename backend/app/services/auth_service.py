from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import hash_password, verify_password
from app.models.models import User
from app.services.token_service import (
    RefreshTokenError,
    issue_token_pair,
    revoke_refresh_token,
    rotate_refresh_token,
)


class DuplicateUserError(ValueError):
    pass


class InvalidCredentialsError(ValueError):
    pass


def get_active_user(db: Session, user_id: int) -> User | None:
    user = db.get(User, user_id)
    return user if user and user.is_active else None


def register_user(db: Session, *, username: str, email: str, password: str) -> User:
    normalized_username = username.strip()
    normalized_email = email.strip().lower()
    existing = db.query(User).filter(
        or_(User.username == normalized_username, User.email == normalized_email)
    ).first()
    if existing:
        raise DuplicateUserError("Username or email already registered")

    user = User(
        username=normalized_username,
        email=normalized_email,
        hashed_password=hash_password(password),
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise DuplicateUserError("Username or email already registered") from exc
    db.refresh(user)
    return user


def login_user(db: Session, *, username: str, password: str) -> dict[str, str | int]:
    user = db.query(User).filter(User.username == username.strip()).first()
    if not user or not user.is_active or not verify_password(password, user.hashed_password):
        raise InvalidCredentialsError("Incorrect username or password")
    pair = issue_token_pair(db, user)
    db.commit()
    return pair


def refresh_access_token(db: Session, raw_token: str) -> dict[str, str | int]:
    try:
        _, pair = rotate_refresh_token(db, raw_token)
        db.commit()
    except RefreshTokenError:
        # Replay detection revokes the active token family, so its transaction
        # must be persisted even though the request itself is rejected.
        db.commit()
        raise
    return pair


def logout_user(db: Session, raw_token: str, user_id: int) -> bool:
    revoked = revoke_refresh_token(db, raw_token, user_id)
    db.commit()
    return revoked
