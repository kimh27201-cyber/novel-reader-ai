from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import InvalidTokenError
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.security import create_access_token, decode_access_token, hash_password, verify_password
from app.db.session import get_db
from app.models.models import User
from app.schemas.auth import Token, UserLogin, UserRead, UserRegister


router = APIRouter(prefix="/api/auth", tags=["auth"])
bearer_scheme = HTTPBearer()


def normalize_bearer_token(value: str) -> str:
    token = value.strip().strip('"').strip("'").strip()
    while token.lower().startswith("bearer "):
        token = token[7:].strip()
    return token


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    try:
        payload = decode_access_token(normalize_bearer_token(credentials.credentials))
        user_id = int(payload.get("sub", 0))
    except (InvalidTokenError, ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
        )

    user = db.get(User, user_id)
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or disabled",
        )
    return user


@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def register_user(payload: UserRegister, db: Session = Depends(get_db)) -> User:
    username = payload.username.strip()
    email = payload.email.strip().lower()
    existing = db.query(User).filter(or_(User.username == username, User.email == email)).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username or email already registered",
        )

    user = User(
        username=username,
        email=email,
        hashed_password=hash_password(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=Token)
def login_user(payload: UserLogin, db: Session = Depends(get_db)) -> Token:
    user = db.query(User).filter(User.username == payload.username.strip()).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )
    return Token(access_token=create_access_token(str(user.id)))


@router.get("/me", response_model=UserRead)
def read_current_user(current_user: User = Depends(get_current_user)) -> User:
    return current_user
