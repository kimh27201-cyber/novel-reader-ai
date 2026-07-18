from datetime import datetime

from pydantic import BaseModel, Field


class UserRegister(BaseModel):
    username: str = Field(min_length=2, max_length=50)
    email: str = Field(min_length=5, max_length=255, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    password: str = Field(min_length=6, max_length=128)


class UserLogin(BaseModel):
    username: str = Field(min_length=2, max_length=50)
    password: str = Field(min_length=6, max_length=128)


class UserRead(BaseModel):
    id: int
    username: str
    email: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class Token(BaseModel):
    access_token: str
    refresh_token: str | None = None
    token_type: str = "bearer"
    expires_in: int | None = None


class RefreshTokenRequest(BaseModel):
    refresh_token: str = Field(min_length=20, max_length=500)


class LogoutRequest(BaseModel):
    refresh_token: str = Field(min_length=20, max_length=500)


class LogoutResponse(BaseModel):
    revoked: bool
