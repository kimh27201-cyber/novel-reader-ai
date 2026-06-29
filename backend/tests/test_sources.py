import json
import os
import sys
from pathlib import Path

import httpx

TESTS_DIR = Path(__file__).resolve().parent
sys.path.append(str(TESTS_DIR))

from helpers import configure_test_environment


BACKEND_DIR = configure_test_environment(__file__)

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


def auth_headers_for(username: str, email: str):
    client.post(
        "/api/auth/register",
        json={"username": username, "email": email, "password": "secret123"},
    )
    login = client.post(
        "/api/auth/login",
        json={"username": username, "password": "secret123"},
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
            "ruleBookInfo": {
                "name": "h1@text",
                "author": ".author@text",
                "intro": "#intro@text",
                "coverUrl": ".cover img@src",
                "tocUrl": ".catalog@href",
                "latestChapter": ".latest@text",
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


def test_delete_source_removes_owned_source_and_hides_from_list():
    headers = auth_headers()
    source = import_sample_source(headers)

    response = client.delete(f"/api/sources/{source['id']}", headers=headers)
    listed = client.get("/api/sources", headers=headers)
    search = client.post(
        f"/api/sources/{source['id']}/search",
        headers=headers,
        json={"keyword": "星轨", "page": 1},
    )

    assert response.status_code == 200
    assert response.json()["deleted"] is True
    assert response.json()["id"] == source["id"]
    assert listed.status_code == 200
    assert listed.json() == []
    assert search.status_code == 404


def test_source_session_can_be_saved_loaded_and_cleared():
    headers = auth_headers()
    source = import_sample_source(headers)

    payload = {
        "origin": "https://example.com",
        "cookie": "sid=abc; theme=dark",
        "user_agent": "NovelReaderTest/1.0",
        "referer": "https://example.com/login",
        "expires_at": 4102444800000,
        "status": "active",
    }
    saved = client.put(f"/api/sources/{source['id']}/session", headers=headers, json=payload)
    loaded = client.get(f"/api/sources/{source['id']}/session", headers=headers)
    cleared = client.delete(f"/api/sources/{source['id']}/session", headers=headers)
    empty = client.get(f"/api/sources/{source['id']}/session", headers=headers)

    assert saved.status_code == 200
    assert saved.json()["exists"] is True
    assert saved.json()["source_id"] == source["id"]
    assert loaded.status_code == 200
    assert loaded.json()["cookie"] == "sid=abc; theme=dark"
    assert loaded.json()["user_agent"] == "NovelReaderTest/1.0"
    assert loaded.json()["referer"] == "https://example.com/login"
    assert loaded.json()["expires_at"] == 4102444800000
    assert cleared.status_code == 200
    assert cleared.json() == {"deleted": True, "source_id": source["id"]}
    assert empty.status_code == 200
    assert empty.json()["exists"] is False


def test_source_session_is_user_scoped_and_deleted_with_source():
    owner_headers = auth_headers_for("owner", "owner@example.com")
    other_headers = auth_headers_for("other", "other@example.com")
    source = import_sample_source(owner_headers)

    saved = client.put(
        f"/api/sources/{source['id']}/session",
        headers=owner_headers,
        json={"cookie": "owner-cookie=1", "origin": "https://example.com"},
    )
    other = client.get(f"/api/sources/{source['id']}/session", headers=other_headers)
    deleted_source = client.delete(f"/api/sources/{source['id']}", headers=owner_headers)
    after_delete = client.get(f"/api/sources/{source['id']}/session", headers=owner_headers)

    assert saved.status_code == 200
    assert other.status_code == 404
    assert deleted_source.status_code == 200
    assert after_delete.status_code == 404


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


def test_book_info_parser_endpoint_enriches_search_result(monkeypatch):
    headers = auth_headers()
    source = import_sample_source(headers)

    html = """
    <section>
      <h1>Star Archive</h1>
      <span class="author">Example Author</span>
      <div class="cover"><img src="/cover/star.jpg" /></div>
      <a class="catalog" href="/book/1/catalog">Catalog</a>
      <p class="latest">Chapter 2: Dream Index</p>
      <div id="intro">A test novel decoded from a source detail page.</div>
    </section>
    """

    async def fake_request_text(spec):
        assert spec["url"] == "https://example.com/book/1"
        return html

    monkeypatch.setattr("app.services.source_parser.request_text", fake_request_text)

    response = client.post(
        f"/api/sources/{source['id']}/book-info",
        headers=headers,
        json={
            "book_url": "https://example.com/book/1",
            "title": "Fallback",
            "author": "Unknown",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["source_id"] == source["id"]
    assert body["source_name"] == source["name"]
    assert body["title"] == "Star Archive"
    assert body["author"] == "Example Author"
    assert body["book_url"] == "https://example.com/book/1"
    assert body["toc_url"] == "https://example.com/book/1/catalog"
    assert body["cover_url"] == "https://example.com/cover/star.jpg"
    assert body["latest_chapter"] == "Chapter 2: Dream Index"
    assert body["intro"] == "A test novel decoded from a source detail page."


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
