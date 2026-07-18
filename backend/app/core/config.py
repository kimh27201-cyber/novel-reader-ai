from functools import lru_cache

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_env: str = "development"
    app_name: str = "Novel Reader AI Backend"
    app_version: str = "0.1.0"
    database_url: str = "sqlite:///./data/novel_reader.db"
    jwt_secret_key: str = "change-me-in-local-dev"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440
    refresh_token_expire_days: int = 30
    allow_query_token_auth: bool = False
    bcrypt_rounds: int = 12
    ai_provider: str = "mock"
    ai_api_key: str = ""
    ai_base_url: str = ""
    ai_model: str = ""
    ai_timeout_seconds: float = 30.0
    cors_allow_origins: str = "*"
    proxy_allow_private_networks: bool = True
    proxy_timeout_seconds: float = Field(default=15.0, gt=0, le=120)
    proxy_max_request_bytes: int = Field(default=1_048_576, ge=1024, le=10_485_760)
    proxy_max_response_bytes: int = Field(default=5_242_880, ge=1024, le=52_428_800)
    source_timeout_seconds: float = Field(default=8.0, gt=0, le=120)
    source_max_concurrency: int = Field(default=5, ge=1, le=20)
    source_retry_count: int = Field(default=1, ge=0, le=3)
    source_request_interval_ms: int = Field(default=500, ge=0, le=10_000)
    source_cache_max_entries: int = Field(default=1000, ge=1, le=10_000)
    session_encryption_key: str = ""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    @property
    def is_production(self) -> bool:
        return self.app_env.strip().lower() in {"production", "prod"}

    @model_validator(mode="after")
    def validate_production_settings(self) -> "Settings":
        if not self.is_production:
            return self
        if self.jwt_secret_key.lower().startswith("change-") or len(self.jwt_secret_key) < 32:
            raise ValueError("JWT_SECRET_KEY must be changed and at least 32 characters in production")
        origins = [origin.strip() for origin in self.cors_allow_origins.split(",") if origin.strip()]
        if not origins or "*" in origins:
            raise ValueError("CORS_ALLOW_ORIGINS cannot be '*' in production")
        if self.proxy_allow_private_networks:
            raise ValueError("PROXY_ALLOW_PRIVATE_NETWORKS must be false in production")
        if (
            not self.session_encryption_key
            or len(self.session_encryption_key) < 32
            or self.session_encryption_key.lower().startswith("change-")
        ):
            raise ValueError("SESSION_ENCRYPTION_KEY must be changed and at least 32 characters in production")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
