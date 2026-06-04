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
