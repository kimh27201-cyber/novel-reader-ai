import sys

import httpx

from pathlib import Path

TESTS_DIR = Path(__file__).resolve().parent
sys.path.append(str(TESTS_DIR))

from helpers import configure_test_environment


BACKEND_DIR = configure_test_environment(__file__)

sys.path.append(str(BACKEND_DIR))

from fastapi.testclient import TestClient

from app.api import proxy
from app.main import app


client = TestClient(app)


def test_proxy_health():
    response = client.get("/api/proxy/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_proxy_rejects_non_http_url():
    response = client.post(
        "/api/proxy/fetch",
        json={"url": "file:///etc/passwd"},
    )

    assert response.status_code == 400
    assert "http" in response.json()["detail"].lower()


def test_proxy_rejects_unsupported_method():
    response = client.post(
        "/api/proxy/fetch",
        json={"url": "https://example.com", "method": "TRACE"},
    )

    assert response.status_code == 400
    assert "unsupported method" in response.json()["detail"].lower()


def test_proxy_fetch_returns_timing_and_decode_diagnostics(monkeypatch):
    class FakeAsyncClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def request(self, method, url, headers=None, content=None):
            return httpx.Response(
                200,
                content="chapter text".encode("utf-8"),
                headers={"content-type": "text/plain; charset=utf-8"},
                request=httpx.Request(method, url),
            )

    monkeypatch.setattr(proxy.httpx, "AsyncClient", FakeAsyncClient)

    response = client.post(
        "/api/proxy/fetch",
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

    class FakeAsyncClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def request(self, method, url, headers=None, content=None):
            return httpx.Response(
                200,
                content=b"ok",
                request=httpx.Request(method, url),
            )

    async def fake_sleep(seconds):
        slept.append(seconds)

    proxy._last_request_at["example.com"] = proxy.time.monotonic()
    monkeypatch.setattr(proxy.httpx, "AsyncClient", FakeAsyncClient)
    monkeypatch.setattr(proxy.asyncio, "sleep", fake_sleep)

    response = client.post(
        "/api/proxy/fetch",
        json={"url": "https://example.com/chapter", "throttle_ms": 0},
    )

    assert response.status_code == 200
    assert slept == []


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
