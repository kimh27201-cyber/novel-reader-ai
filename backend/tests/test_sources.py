import json
import os
import sys
from pathlib import Path

import httpx

BACKEND_DIR = Path(__file__).resolve().parents[1]

os.environ["DATABASE_URL"] = f"sqlite:///{BACKEND_DIR / 'data' / 'test_novel_reader.db'}"
os.environ["JWT_SECRET_KEY"] = "test-secret-key"

sys.path.append(str(BACKEND_DIR))

from fastapi.testclient import TestClient

from app.db.session import Base, engine
from app.main import app


client = TestClient(app)


def setup_function():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)


def auth_headers():
    client.post(
        "/api/auth/register",
        json={"username": "sourceuser", "email": "source@example.com", "password": "secret123"},
    )
    login = client.post(
        "/api/auth/login",
        json={"username": "sourceuser", "password": "secret123"},
    )
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


def sample_source_json():
    return json.dumps(
        {
            "bookSourceName": "测试小说源",
            "bookSourceUrl": "https://example.com",
            "bookSourceGroup": "测试源",
            "searchUrl": "https://example.com/search?q={{key}}&page={{page}}",
            "ruleSearch": {
                "bookList": ".result-list li",
                "name": "h3 a@text",
                "author": ".author@text",
                "bookUrl": "h3 a@href",
            },
            "ruleToc": {
                "chapterList": ".chapter-list a",
                "chapterName": "@text",
                "chapterUrl": "@href",
            },
            "ruleContent": {
                "content": "#content@text",
            },
        },
        ensure_ascii=False,
    )


def import_sample_source(headers):
    response = client.post(
        "/api/sources/import",
        headers=headers,
        json={"content": sample_source_json()},
    )
    assert response.status_code == 201
    return response.json()["sources"][0]


def test_import_and_list_sources():
    headers = auth_headers()

    imported = import_sample_source(headers)
    listed = client.get("/api/sources", headers=headers)

    assert imported["name"] == "测试小说源"
    assert imported["base_url"] == "https://example.com"
    assert imported["compatibility"] == "v1 compatible"
    assert listed.status_code == 200
    assert listed.json()[0]["name"] == "测试小说源"


def test_search_source_parses_html_results(monkeypatch):
    headers = auth_headers()
    source = import_sample_source(headers)

    html = """
    <ul class="result-list">
      <li><h3><a href="/book/1">星轨图书馆</a></h3><span class="author">示例作者</span></li>
      <li><h3><a href="/book/2">风停在旧城</a></h3><span class="author">另一作者</span></li>
    </ul>
    """

    async def fake_request_text(spec):
        assert spec["url"] == "https://example.com/search?q=%E6%98%9F%E8%BD%A8&page=1"
        return html

    monkeypatch.setattr("app.services.source_parser.request_text", fake_request_text)

    response = client.post(
        f"/api/sources/{source['id']}/search",
        headers=headers,
        json={"keyword": "星轨", "page": 1},
    )

    assert response.status_code == 200
    books = response.json()["books"]
    assert len(books) == 2
    assert books[0]["title"] == "星轨图书馆"
    assert books[0]["author"] == "示例作者"
    assert books[0]["book_url"] == "https://example.com/book/1"


def test_toc_and_content_parser_endpoints(monkeypatch):
    headers = auth_headers()
    source = import_sample_source(headers)

    toc_html = """
    <div class="chapter-list">
      <a href="/book/1/0">第一章 失重借阅证</a>
      <a href="/book/1/1">第二章 梦的索引</a>
    </div>
    """
    content_html = """
    <main id="content">
      凌晨四点，星轨图书馆经过城市上空。<br>
      安禾第一次看见它时，以为那只是一颗移动得过慢的星星。
    </main>
    """

    async def fake_request_text(spec):
        if spec["url"].endswith("/catalog"):
            return toc_html
        return content_html

    monkeypatch.setattr("app.services.source_parser.request_text", fake_request_text)

    toc_response = client.post(
        f"/api/sources/{source['id']}/toc",
        headers=headers,
        json={"book_url": "https://example.com/book/1", "toc_url": "https://example.com/book/1/catalog"},
    )
    content_response = client.post(
        f"/api/sources/{source['id']}/content",
        headers=headers,
        json={"chapter_url": "https://example.com/book/1/0"},
    )

    assert toc_response.status_code == 200
    assert toc_response.json()["chapters"][0]["title"] == "第一章 失重借阅证"
    assert toc_response.json()["chapters"][0]["url"] == "https://example.com/book/1/0"
    assert content_response.status_code == 200
    assert "星轨图书馆经过城市上空" in content_response.json()["content"]


def test_toc_upstream_request_failure_returns_bad_gateway(monkeypatch):
    headers = auth_headers()
    source = import_sample_source(headers)

    async def fake_request_text(spec):
        raise httpx.ConnectError("connection failed")

    monkeypatch.setattr("app.services.source_parser.request_text", fake_request_text)

    response = client.post(
        f"/api/sources/{source['id']}/toc",
        headers=headers,
        json={"book_url": "https://example.com/book/1", "toc_url": "https://example.com/book/1/catalog"},
    )

    assert response.status_code == 502
    body = response.json()
    assert body["error"]["code"] == "bad_gateway"
    assert "Source request failed" in body["error"]["message"]


def test_content_empty_error_includes_diagnostics(monkeypatch):
    headers = auth_headers()
    source = import_sample_source(headers)

    async def fake_request_text(spec):
        return "<html><body><main id=\"other\">没有正文命中</main></body></html>"

    monkeypatch.setattr("app.services.source_parser.request_text", fake_request_text)

    response = client.post(
        f"/api/sources/{source['id']}/content",
        headers=headers,
        json={"chapter_url": "https://example.com/book/1/empty"},
    )

    assert response.status_code == 400
    detail = response.json()["error"]["message"]
    assert "正文解析为空" in detail
    assert "https://example.com/book/1/empty" in detail
    assert "ruleContent.content" in detail
    assert "响应长度" in detail
