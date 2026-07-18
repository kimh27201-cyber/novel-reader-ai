import re
from typing import Any

from app.services.session_crypto import PREFIX, decrypt_session_value, encrypt_session_value


SENSITIVE_KEYS = {
    "authorization",
    "cookie",
    "set-cookie",
    "token",
    "access_token",
    "refresh_token",
    "password",
    "apikey",
    "api_key",
}


def _sensitive(key: str) -> bool:
    normalized = str(key).strip().lower().replace("-", "_")
    return normalized in {item.replace("-", "_") for item in SENSITIVE_KEYS}


EMBEDDED_SECRET_PATTERN = re.compile(
    r"(?:authorization|cookie|access[_-]?token|refresh[_-]?token|password|api[_-]?key)\s*['\"]?\s*[:=]",
    re.IGNORECASE,
)


def _contains_embedded_secret(value: Any) -> bool:
    return isinstance(value, str) and bool(EMBEDDED_SECRET_PATTERN.search(value))


def protect_source_secrets(value: Any) -> Any:
    if isinstance(value, list):
        return [protect_source_secrets(item) for item in value]
    if isinstance(value, dict):
        return {
            key: encrypt_session_value(str(item))
            if item and (_sensitive(key) or _contains_embedded_secret(item))
            else protect_source_secrets(item)
            for key, item in value.items()
        }
    return value


def reveal_source_secrets(value: Any) -> Any:
    if isinstance(value, str) and value.startswith(PREFIX):
        return decrypt_session_value(value)
    if isinstance(value, list):
        return [reveal_source_secrets(item) for item in value]
    if isinstance(value, dict):
        return {
            key: decrypt_session_value(str(item))
            if _sensitive(key) and item
            else reveal_source_secrets(item)
            for key, item in value.items()
        }
    return value


def redact_source_secrets(value: Any) -> Any:
    if isinstance(value, list):
        return [redact_source_secrets(item) for item in value]
    if isinstance(value, dict):
        return {
            key: ""
            if item and (_sensitive(key) or _contains_embedded_secret(item) or (isinstance(item, str) and item.startswith(PREFIX)))
            else redact_source_secrets(item)
            for key, item in value.items()
        }
    return value
