import logging

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, Response, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import InvalidTokenError
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.core.config import get_settings
from app.db.session import get_db
from app.models.models import User
from app.schemas.auth import LogoutRequest, LogoutResponse, RefreshTokenRequest, Token, UserLogin, UserRead, UserRegister
from app.services.auth_service import (
    DuplicateUserError,
    InvalidCredentialsError,
    get_active_user,
    login_user as login_user_service,
    logout_user as logout_user_service,
    refresh_access_token as refresh_access_token_service,
    register_user as register_user_service,
)
from app.services.token_service import RefreshTokenError


router = APIRouter(prefix="/api/auth", tags=["auth"])
bearer_scheme = HTTPBearer(auto_error=False)
logger = logging.getLogger("novel_reader.auth")


def normalize_bearer_token(value: str) -> str:
    token = value.strip().strip('"').strip("'").strip()
    while token.lower().startswith("bearer "):
        token = token[7:].strip()
    return token


def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    x_access_token: str | None = Header(default=None, alias="X-Access-Token"),
    access_token: str | None = Query(default=None),
    db: Session = Depends(get_db),
) -> User:
    query_token = access_token if get_settings().allow_query_token_auth else None
    token_source = "authorization" if credentials else "x-access-token" if x_access_token else "query" if query_token else "missing"
    logger.info("auth token source=%s", token_source)
    token = credentials.credentials if credentials else x_access_token or query_token
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    try:
        payload = decode_access_token(normalize_bearer_token(token))
        user_id = int(payload.get("sub", 0))
    except (InvalidTokenError, ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
        )

    user = get_active_user(db, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or disabled",
        )
    request.state.user_id = user.id
    return user


@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def register_user(payload: UserRegister, db: Session = Depends(get_db)) -> User:
    try:
        return register_user_service(
            db,
            username=payload.username,
            email=payload.email,
            password=payload.password,
        )
    except DuplicateUserError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc


@router.post("/login", response_model=Token)
def login_user(payload: UserLogin, response: Response, db: Session = Depends(get_db)) -> Token:
    try:
        pair = login_user_service(db, username=payload.username, password=payload.password)
    except InvalidCredentialsError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
        ) from exc
    response.headers["X-Access-Token"] = str(pair["access_token"])
    response.headers["Access-Control-Expose-Headers"] = "X-Access-Token"
    return Token(**pair)


@router.post("/refresh", response_model=Token)
def refresh_access_token(payload: RefreshTokenRequest, db: Session = Depends(get_db)) -> Token:
    try:
        pair = refresh_access_token_service(db, payload.refresh_token)
    except RefreshTokenError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc
    return Token(**pair)


@router.post("/logout", response_model=LogoutResponse)
def logout_user(
    payload: LogoutRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LogoutResponse:
    revoked = logout_user_service(db, payload.refresh_token, current_user.id)
    return LogoutResponse(revoked=revoked)


@router.get("/me", response_model=UserRead)
def read_current_user(current_user: User = Depends(get_current_user)) -> User:
    return current_user
