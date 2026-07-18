import sys
from types import SimpleNamespace

import httpx

from pathlib import Path

TESTS_DIR = Path(__file__).resolve().parent
sys.path.append(str(TESTS_DIR))

from helpers import configure_test_environment, reset_database


BACKEND_DIR = configure_test_environment(__file__)

sys.path.append(str(BACKEND_DIR))

from fastapi.testclient import TestClient

from app.api import proxy
from app.db.session import Base, engine
from app.main import app


client = TestClient(app)


def setup_function():
    reset_database(Base, engine)
    proxy._last_request_at.clear()


def auth_headers():
    client.post(
        "/api/auth/register",
        json={"username": "proxyuser", "email": "proxy@example.com", "password": "secret123"},
    )
    login = client.post(
        "/api/auth/login",
        json={"username": "proxyuser", "password": "secret123"},
    )
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


def test_proxy_health():
    response = client.get("/api/proxy/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_proxy_rejects_non_http_url():
    response = client.post(
        "/api/proxy/fetch",
        headers=auth_headers(),
        json={"url": "file:///etc/passwd"},
    )

    assert response.status_code == 400
    assert "http" in response.json()["detail"].lower()


def test_proxy_rejects_unsupported_method():
    response = client.post(
        "/api/proxy/fetch",
        headers=auth_headers(),
        json={"url": "https://example.com", "method": "TRACE"},
    )

    assert response.status_code == 400
    assert "unsupported method" in response.json()["detail"].lower()


def test_proxy_fetch_returns_timing_and_decode_diagnostics(monkeypatch):
    async def fake_validate_target(url):
        assert url == "https://example.com/chapter"

    async def fake_fetch(method, url, **kwargs):
        return httpx.Response(
            200,
            content="chapter text".encode("utf-8"),
            headers={"content-type": "text/plain; charset=utf-8"},
            request=httpx.Request(method, url),
        )

    monkeypatch.setattr(proxy, "validate_proxy_target", fake_validate_target)
    monkeypatch.setattr(proxy, "fetch", fake_fetch)

    response = client.post(
        "/api/proxy/fetch",
        headers=auth_headers(),
        json={"url": "https://example.com/chapter", "throttle_ms": 0},
    )

    body = response.json()
    assert response.status_code == 200
    assert body["text"] == "chapter text"
    assert body["elapsed_ms"] >= 0
    assert body["content_bytes"] == len("chapter text".encode("utf-8"))
    assert body["encoding"] == "utf-8"


def test_proxy_fetch_throttle_zero_skips_host_wait(monkeypatch):
    slept = []

    async def fake_validate_target(url):
        return None

    async def fake_fetch(method, url, **kwargs):
        return httpx.Response(200, content=b"ok", request=httpx.Request(method, url))

    async def fake_sleep(seconds):
        slept.append(seconds)

    proxy._last_request_at["example.com"] = proxy.time.monotonic()
    monkeypatch.setattr(proxy, "validate_proxy_target", fake_validate_target)
    monkeypatch.setattr(proxy, "fetch", fake_fetch)
    monkeypatch.setattr(proxy.asyncio, "sleep", fake_sleep)

    response = client.post(
        "/api/proxy/fetch",
        headers=auth_headers(),
        json={"url": "https://example.com/chapter", "throttle_ms": 0},
    )

    assert response.status_code == 200
    assert slept == []


def test_proxy_fetch_requires_authentication():
    response = client.post(
        "/api/proxy/fetch",
        json={"url": "https://example.com/chapter"},
    )

    assert response.status_code == 401


def test_proxy_rejects_private_network_target(monkeypatch):
    async def reject_private_target(url):
        raise ValueError("Private network targets are blocked")

    monkeypatch.setattr(proxy, "validate_target", reject_private_target)

    response = client.post(
        "/api/proxy/fetch",
        headers=auth_headers(),
        json={"url": "http://127.0.0.1/admin"},
    )

    assert response.status_code == 400
    assert "private network" in str(response.json()).lower()


def test_proxy_limits_request_and_response_size(monkeypatch):
    settings = SimpleNamespace(proxy_max_request_bytes=3, proxy_max_response_bytes=3)

    async def fake_validate_target(url):
        return None

    async def fake_fetch(method, url, **kwargs):
        return httpx.Response(200, content=b"four", request=httpx.Request(method, url))

    monkeypatch.setattr(proxy, "get_settings", lambda: settings)
    monkeypatch.setattr(proxy, "validate_proxy_target", fake_validate_target)
    monkeypatch.setattr(proxy, "fetch", fake_fetch)
    headers = auth_headers()

    request_too_large = client.post(
        "/api/proxy/fetch",
        headers=headers,
        json={"url": "https://example.com", "method": "POST", "body": "four"},
    )
    response_too_large = client.post(
        "/api/proxy/fetch",
        headers=headers,
        json={"url": "https://example.com", "throttle_ms": 0},
    )

    assert request_too_large.status_code == 413
    assert response_too_large.status_code == 413


def test_decode_response_uses_declared_charset():
    response = httpx.Response(
        200,
        content="章节内容".encode("gbk"),
        headers={"content-type": "text/html; charset=gbk"},
    )

    assert proxy.decode_response_text(response, "") == "章节内容"


def test_decode_response_prefers_requested_charset():
    response = httpx.Response(
        200,
        content="章节内容".encode("gbk"),
        headers={"content-type": "text/html; charset=utf-8"},
    )

    assert proxy.decode_response_text(response, "gbk") == "章节内容"
