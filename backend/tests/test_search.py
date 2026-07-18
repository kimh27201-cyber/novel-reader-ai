import json
import sys
from pathlib import Path

import httpx

TESTS_DIR = Path(__file__).resolve().parent
sys.path.append(str(TESTS_DIR))

from helpers import configure_test_environment, reset_database


BACKEND_DIR = configure_test_environment(__file__)
sys.path.append(str(BACKEND_DIR))

from fastapi.testclient import TestClient

from app.db.session import Base, engine
from app.main import app
from app.api.search import _safe_error_message
from app.services.source_parser import SourceParseError


client = TestClient(app)


def setup_function():
    reset_database(Base, engine)


def auth_headers(username="search-user", email="search@example.com"):
    client.post(
        "/api/auth/register",
        json={"username": username, "email": email, "password": "secret123"},
    )
    login = client.post(
        "/api/auth/login",
        json={"username": username, "password": "secret123"},
    )
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


def import_source(headers, name, base_url):
    config = {
        "bookSourceName": name,
        "bookSourceUrl": base_url,
        "searchUrl": f"{base_url}/search?q={{{{key}}}}",
        "ruleSearch": {"bookList": ".book", "name": ".name@text", "author": ".author@text", "bookUrl": "a@href"},
        "ruleBookInfo": {"name": "h1@text", "tocUrl": ".toc@href"},
        "ruleToc": {"chapterList": ".chapter", "chapterName": "@text", "chapterUrl": "@href"},
        "ruleContent": {"content": "#content@text"},
    }
    response = client.post(
        "/api/sources/import",
        headers=headers,
        json={"content": json.dumps(config)},
    )
    assert response.status_code == 201
    return response.json()["sources"][0]


def search_book(source, url_suffix="book-1"):
    return {
        "title": "The Star Archive",
        "author": "Test Author",
        "book_url": f"{source['base_url']}/{url_suffix}",
        "kind": "fantasy",
        "latest_chapter": "Chapter 2",
        "intro": "A test book",
        "cover_url": "",
    }


def test_multi_source_search_deduplicates_and_keeps_alternatives(monkeypatch):
    headers = auth_headers()
    first = import_source(headers, "Source A", "https://a.example.com")
    second = import_source(headers, "Source B", "https://b.example.com")

    async def fake_search(source, keyword, page, force_refresh=False):
        assert keyword == "star"
        assert page == 1
        return [search_book(source)]

    monkeypatch.setattr("app.api.search.search_source", fake_search)
    response = client.post(
        "/api/search/books",
        headers=headers,
        json={"keyword": "star", "source_ids": [first["id"], second["id"]]},
    )

    assert response.status_code == 200
    body = response.json()
    assert len(body["books"]) == 1
    assert body["books"][0]["source_id"] == first["id"]
    assert body["books"][0]["alternatives"] == [{
        "source_id": second["id"],
        "source_name": "Source B",
        "book_url": "https://b.example.com/book-1",
    }]
    assert [item["status"] for item in body["source_results"]] == ["success", "success"]
    assert body["duration_ms"] >= 0


def test_multi_source_search_returns_partial_results_when_one_source_fails(monkeypatch):
    headers = auth_headers()
    first = import_source(headers, "Working", "https://working.example.com")
    second = import_source(headers, "Broken", "https://broken.example.com")

    async def fake_search(source, keyword, page, force_refresh=False):
        if source["name"] == "Broken":
            raise httpx.ConnectError("upstream unavailable")
        return [search_book(source)]

    monkeypatch.setattr("app.api.search.search_source", fake_search)
    response = client.post(
        "/api/search/books",
        headers=headers,
        json={"keyword": "star", "source_ids": [first["id"], second["id"]]},
    )

    assert response.status_code == 200
    body = response.json()
    assert len(body["books"]) == 1
    results = {item["source_name"]: item for item in body["source_results"]}
    assert results["Working"]["status"] == "success"
    assert results["Broken"]["status"] == "failed"
    assert results["Broken"]["error_code"] == "source_error"


def test_multi_source_search_rejects_foreign_or_disabled_sources():
    owner_headers = auth_headers()
    other_headers = auth_headers("other-search", "other-search@example.com")
    foreign = import_source(other_headers, "Foreign", "https://foreign.example.com")
    owned = import_source(owner_headers, "Disabled", "https://disabled.example.com")
    client.patch(f"/api/sources/{owned['id']}", headers=owner_headers, json={"enabled": False})

    foreign_response = client.post(
        "/api/search/books",
        headers=owner_headers,
        json={"keyword": "star", "source_ids": [foreign["id"]]},
    )
    disabled_response = client.post(
        "/api/search/books",
        headers=owner_headers,
        json={"keyword": "star", "source_ids": [owned["id"]]},
    )

    assert foreign_response.status_code == 404
    assert disabled_response.status_code == 404


def test_source_diagnostic_runs_search_info_toc_and_content(monkeypatch):
    headers = auth_headers()
    source = import_source(headers, "Healthy", "https://healthy.example.com")

    async def fake_search(parser_source, keyword, page, force_refresh=False):
        return [search_book(parser_source)]

    async def fake_book_info(parser_source, book, force_refresh=False):
        return {**book, "toc_url": "https://healthy.example.com/book-1/toc"}

    async def fake_toc(parser_source, book_url, toc_url, force_refresh=False):
        return [{"title": "Chapter 1", "url": "https://healthy.example.com/chapter-1", "index": 0}]

    async def fake_content(parser_source, chapter_url, force_refresh=False):
        return "chapter text"

    monkeypatch.setattr("app.api.search.search_source", fake_search)
    monkeypatch.setattr("app.api.search.load_book_info", fake_book_info)
    monkeypatch.setattr("app.api.search.load_toc", fake_toc)
    monkeypatch.setattr("app.api.search.load_content", fake_content)

    response = client.post(
        f"/api/sources/{source['id']}/diagnostics",
        headers=headers,
        json={"keyword": "star"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "healthy"
    assert body["failed_stage"] == ""
    assert [stage["stage"] for stage in body["stages"]] == ["search", "book_info", "toc", "content"]
    assert all(stage["status"] == "success" for stage in body["stages"])


def test_batch_diagnostic_reports_per_source_failure(monkeypatch):
    headers = auth_headers()
    healthy = import_source(headers, "Healthy", "https://healthy.example.com")
    broken = import_source(headers, "Broken", "https://broken.example.com")

    async def fake_search(parser_source, keyword, page, force_refresh=False):
        if parser_source["name"] == "Broken":
            raise httpx.ConnectError("offline")
        return [search_book(parser_source)]

    async def fake_book_info(parser_source, book, force_refresh=False):
        return {**book, "toc_url": f"{parser_source['base_url']}/toc"}

    async def fake_toc(parser_source, book_url, toc_url, force_refresh=False):
        return [{"title": "Chapter 1", "url": f"{parser_source['base_url']}/chapter-1", "index": 0}]

    async def fake_content(parser_source, chapter_url, force_refresh=False):
        return "chapter text"

    monkeypatch.setattr("app.api.search.search_source", fake_search)
    monkeypatch.setattr("app.api.search.load_book_info", fake_book_info)
    monkeypatch.setattr("app.api.search.load_toc", fake_toc)
    monkeypatch.setattr("app.api.search.load_content", fake_content)
    response = client.post(
        "/api/sources/diagnostics",
        headers=headers,
        json={"keyword": "star", "source_ids": [healthy["id"], broken["id"]]},
    )

    assert response.status_code == 200
    diagnostics = {item["source_name"]: item for item in response.json()["diagnostics"]}
    assert diagnostics["Healthy"]["status"] == "healthy"
    assert diagnostics["Broken"]["status"] == "unavailable"
    assert diagnostics["Broken"]["failed_stage"] == "search"
    assert diagnostics["Broken"]["error_code"] == "source_error"


def test_source_error_messages_redact_url_queries():
    message = _safe_error_message(
        SourceParseError("failed at https://example.com/chapter?token=private-value&cookie=secret")
    )

    assert message == "failed at https://example.com/chapter?<redacted>"
    assert "private-value" not in message
    assert "secret" not in message
