import pytest
from pydantic import ValidationError

from app.core.config import Settings


VALID_PRODUCTION = {
    "app_env": "production",
    "jwt_secret_key": "production-jwt-secret-key-at-least-32-characters",
    "cors_allow_origins": "https://reader.example.com",
    "proxy_allow_private_networks": False,
    "session_encryption_key": "production-session-key-not-a-placeholder",
}


def build_settings(**values):
    return Settings(_env_file=None, **values)


@pytest.mark.parametrize(
    ("overrides", "message"),
    [
        ({"jwt_secret_key": "change-me-in-local-dev"}, "JWT_SECRET_KEY"),
        ({"cors_allow_origins": "*"}, "CORS_ALLOW_ORIGINS"),
        ({"proxy_allow_private_networks": True}, "PROXY_ALLOW_PRIVATE_NETWORKS"),
        ({"session_encryption_key": "change-this-before-production"}, "SESSION_ENCRYPTION_KEY"),
    ],
)
def test_production_rejects_unsafe_defaults(overrides, message):
    with pytest.raises(ValidationError, match=message):
        build_settings(**{**VALID_PRODUCTION, **overrides})


def test_production_accepts_explicit_safe_settings():
    settings = build_settings(**VALID_PRODUCTION)

    assert settings.is_production is True
    assert settings.allow_query_token_auth is False
    assert settings.source_max_concurrency == 5


def test_production_requires_credentials_when_cloud_tts_is_enabled():
    with pytest.raises(ValidationError, match="TTS_APP_ID"):
        build_settings(**{**VALID_PRODUCTION, "tts_enabled": True})


def test_cloud_tts_is_disabled_by_default():
    settings = build_settings(app_env="test")

    assert settings.tts_enabled is False
    assert settings.tts_max_concurrency == 2
    assert settings.tts_daily_uncached_characters == 10_000
    assert settings.tts_global_daily_uncached_characters == 12_000
    assert settings.tts_global_monthly_uncached_characters == 20_000
