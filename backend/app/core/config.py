import os
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
    tts_enabled: bool = False
    tts_app_id: str = ""
    tts_access_token: str = ""
    tts_base_url: str = "https://openspeech.bytedance.com/api/v3/tts/unidirectional"
    tts_resource_id: str = "seed-tts-1.0"
    tts_model: str = "volcengine-v3"
    tts_voices_json: str = ""
    tts_timeout_seconds: float = Field(default=20.0, gt=0, le=120)
    tts_retry_count: int = Field(default=1, ge=0, le=3)
    tts_max_concurrency: int = Field(default=2, ge=1, le=10)
    tts_concurrency_wait_seconds: float = Field(default=1.0, gt=0, le=30)
    tts_daily_uncached_characters: int = Field(default=10_000, ge=1, le=10_000_000)
    tts_global_daily_uncached_characters: int = Field(default=12_000, ge=1, le=100_000_000)
    tts_global_monthly_uncached_characters: int = Field(default=20_000, ge=1, le=1_000_000_000)
    tts_cache_dir: str = "./data/tts-cache"
    tts_cache_ttl_seconds: int = Field(default=604_800, ge=60, le=31_536_000)
    tts_cache_max_bytes: int = Field(default=1_073_741_824, ge=1_048_576)
    tts_ticket_expire_seconds: int = Field(default=300, ge=30, le=3600)
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
        if self.tts_enabled and (not self.tts_app_id or not self.tts_access_token):
            raise ValueError("TTS_APP_ID and TTS_ACCESS_TOKEN are required when TTS_ENABLED=true")
        return self


@lru_cache
def get_settings() -> Settings:
    app_env = os.getenv("APP_ENV", "").strip().lower()
    if app_env in {"test", "testing"}:
        return Settings(_env_file=None)
    return Settings()
