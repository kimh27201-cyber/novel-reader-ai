import sys
from pathlib import Path


TESTS_DIR = Path(__file__).resolve().parent
sys.path.append(str(TESTS_DIR))

from helpers import configure_test_environment


BACKEND_DIR = configure_test_environment(__file__)
sys.path.append(str(BACKEND_DIR))

from app.services.session_crypto import PREFIX
from app.services.source_secrets import protect_source_secrets, redact_source_secrets, reveal_source_secrets


def test_source_secrets_encrypt_nested_and_embedded_credentials():
    raw = {
        "headers": {"Cookie": "sid=private", "User-Agent": "Reader/1.0"},
        "searchUrl": 'https://example.com/search,{"headers":{"Authorization":"Bearer private"}}',
        "ruleSearch": {"bookList": ".book"},
    }

    protected = protect_source_secrets(raw)

    assert protected["headers"]["Cookie"].startswith(PREFIX)
    assert protected["searchUrl"].startswith(PREFIX)
    assert "sid=private" not in str(protected)
    assert "Bearer private" not in str(protected)
    assert reveal_source_secrets(protected) == raw

    redacted = redact_source_secrets(protected)
    assert redacted["headers"]["Cookie"] == ""
    assert redacted["searchUrl"] == ""
    assert redacted["headers"]["User-Agent"] == "Reader/1.0"
