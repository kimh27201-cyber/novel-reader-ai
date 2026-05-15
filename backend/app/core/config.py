from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Novel Reader AI Backend"
    app_version: str = "0.1.0"
    database_url: str = "sqlite:///./data/novel_reader.db"
    jwt_secret_key: str = "change-me-in-local-dev"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440
    ai_provider: str = "mock"
    ai_api_key: str = ""
    ai_base_url: str = ""
    ai_model: str = ""
    ai_timeout_seconds: float = 30.0
    cors_allow_origins: str = "*"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


@lru_cache
def get_settings() -> Settings:
    return Settings()
