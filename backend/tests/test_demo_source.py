import os
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]

os.environ["DATABASE_URL"] = f"sqlite:///{BACKEND_DIR / 'data' / 'test_novel_reader.db'}"
os.environ["JWT_SECRET_KEY"] = "test-secret-key"

sys.path.append(str(BACKEND_DIR))

from fastapi.testclient import TestClient

from app.api.demo import demo_catalog, demo_chapter, demo_search
from app.db.session import Base, engine
from app.main import app
from app.services.demo_source import DEMO_BOOK_SLUG


client = TestClient(app)


def setup_function():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)


def auth_headers():
    client.post(
        "/api/auth/register",
        json={"username": "demouser", "email": "demo@example.com", "password": "secret123"},
    )
    login = client.post(
        "/api/auth/login",
        json={"username": "demouser", "password": "secret123"},
    )
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


def test_demo_html_endpoints_are_available():
    search = client.get("/demo-source/search?q=星轨&page=1")
    catalog = client.get(f"/demo-source/books/{DEMO_BOOK_SLUG}/catalog")
    chapter = client.get(f"/demo-source/books/{DEMO_BOOK_SLUG}/chapters/1")

    assert search.status_code == 200
    assert "星轨图书馆" in search.text
    assert catalog.status_code == 200
    assert "第一章 失重借阅证" in catalog.text
    assert chapter.status_code == 200
    assert "请在日出前归还你遗忘的梦" in chapter.text


def test_demo_source_json_can_be_copied_from_swagger():
    response = client.get("/api/demo/source-json")

    assert response.status_code == 200
    body = response.json()
    assert body["source"]["bookSourceName"] == "本地演示书源"
    assert body["source"]["searchUrl"].endswith("/demo-source/search?q={{key}}&page={{page}}")
    assert '"bookSourceName": "本地演示书源"' in body["content"]


def test_import_demo_source_and_parse_flow(monkeypatch):
    headers = auth_headers()
    imported = client.post("/api/sources/import-demo", headers=headers)

    assert imported.status_code == 201
    source = imported.json()["sources"][0]
    assert source["name"] == "本地演示书源"
    assert source["base_url"] == "http://testserver"

    async def fake_request_text(spec):
        url = spec["url"]
        if "/demo-source/search" in url:
            return demo_search(q="星轨", page=1)
        if url.endswith(f"/demo-source/books/{DEMO_BOOK_SLUG}/catalog"):
            return demo_catalog(book_slug=DEMO_BOOK_SLUG)
        if url.endswith(f"/demo-source/books/{DEMO_BOOK_SLUG}/chapters/1"):
            return demo_chapter(book_slug=DEMO_BOOK_SLUG, chapter_no=1)
        raise AssertionError(f"Unexpected demo request: {url}")

    monkeypatch.setattr("app.services.source_parser.request_text", fake_request_text)

    search = client.post(
        f"/api/sources/{source['id']}/search",
        headers=headers,
        json={"keyword": "星轨", "page": 1},
    )
    assert search.status_code == 200
    first_book = search.json()["books"][0]
    assert first_book["title"] == "星轨图书馆"
    assert first_book["book_url"] == f"http://testserver/demo-source/books/{DEMO_BOOK_SLUG}/catalog"

    toc = client.post(
        f"/api/sources/{source['id']}/toc",
        headers=headers,
        json={"book_url": first_book["book_url"], "toc_url": first_book["book_url"]},
    )
    assert toc.status_code == 200
    first_chapter = toc.json()["chapters"][0]
    assert first_chapter["title"] == "第一章 失重借阅证"

    content = client.post(
        f"/api/sources/{source['id']}/content",
        headers=headers,
        json={"chapter_url": first_chapter["url"]},
    )
    assert content.status_code == 200
    assert "星轨图书馆经过城市上空" in content.json()["content"]
