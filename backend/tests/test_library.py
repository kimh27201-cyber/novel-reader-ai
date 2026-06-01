import os
import sys
from pathlib import Path

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


def auth_headers(username="reader", email="reader@example.com"):
    client.post(
        "/api/auth/register",
        json={"username": username, "email": email, "password": "secret123"},
    )
    login = client.post(
        "/api/auth/login",
        json={"username": username, "password": "secret123"},
    )
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


def create_book(headers, title="星轨图书馆"):
    response = client.post(
        "/api/books",
        headers=headers,
        json={
            "title": title,
            "author": "示例作者",
            "description": "一本用于测试的小说",
            "book_url": "https://example.com/book/1",
            "toc_url": "https://example.com/book/1/catalog",
        },
    )
    assert response.status_code == 201
    return response.json()


def create_chapter(headers, book_id, index=0, title="第一章 失重借阅证"):
    response = client.post(
        f"/api/books/{book_id}/chapters",
        headers=headers,
        json={
            "chapter_index": index,
            "title": title,
            "url": f"https://example.com/book/1/{index}",
            "content": "凌晨四点，星轨图书馆经过城市上空。",
            "is_cached": True,
        },
    )
    assert response.status_code == 201
    return response.json()


def test_create_and_list_books_for_current_user():
    headers = auth_headers()

    created = create_book(headers)
    response = client.get("/api/books", headers=headers)

    assert response.status_code == 200
    books = response.json()
    assert len(books) == 1
    assert books[0]["id"] == created["id"]
    assert books[0]["title"] == "星轨图书馆"
    assert books[0]["author"] == "示例作者"


def test_books_are_isolated_by_user():
    first_headers = auth_headers()
    second_headers = auth_headers("other", "other@example.com")
    create_book(first_headers, title="只属于第一个用户")

    response = client.get("/api/books", headers=second_headers)

    assert response.status_code == 200
    assert response.json() == []


def test_create_and_list_chapters_for_book():
    headers = auth_headers()
    book = create_book(headers)

    chapter = create_chapter(headers, book["id"])
    response = client.get(f"/api/books/{book['id']}/chapters", headers=headers)

    assert response.status_code == 200
    chapters = response.json()
    assert len(chapters) == 1
    assert chapters[0]["id"] == chapter["id"]
    assert chapters[0]["title"] == "第一章 失重借阅证"
    assert chapters[0]["content"] == "凌晨四点，星轨图书馆经过城市上空。"


def test_get_chapter_requires_current_user_ownership():
    first_headers = auth_headers()
    second_headers = auth_headers("other", "other@example.com")
    book = create_book(first_headers)
    chapter = create_chapter(first_headers, book["id"])

    response = client.get(f"/api/chapters/{chapter['id']}", headers=second_headers)

    assert response.status_code == 404


def test_update_chapter_content_caches_owned_chapter():
    headers = auth_headers()
    book = create_book(headers)
    chapter = create_chapter(headers, book["id"])

    response = client.patch(
        f"/api/chapters/{chapter['id']}/content",
        headers=headers,
        json={"content": "新的正文内容\n第二段。"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["content"] == "新的正文内容\n第二段。"
    assert body["is_cached"] is True


def test_update_chapter_content_rejects_empty_content():
    headers = auth_headers()
    book = create_book(headers)
    chapter = create_chapter(headers, book["id"])

    response = client.patch(
        f"/api/chapters/{chapter['id']}/content",
        headers=headers,
        json={"content": "   "},
    )

    assert response.status_code == 422


def test_update_chapter_content_requires_current_user_ownership():
    first_headers = auth_headers()
    second_headers = auth_headers("other", "other@example.com")
    book = create_book(first_headers)
    chapter = create_chapter(first_headers, book["id"])

    response = client.patch(
        f"/api/chapters/{chapter['id']}/content",
        headers=second_headers,
        json={"content": "不应该写入的正文"},
    )

    assert response.status_code == 404


def test_save_and_read_reading_history():
    headers = auth_headers()
    book = create_book(headers)
    chapter = create_chapter(headers, book["id"])

    saved = client.post(
        "/api/reading-history",
        headers=headers,
        json={
            "book_id": book["id"],
            "chapter_id": chapter["id"],
            "chapter_index": 0,
            "page_index": 3,
            "progress_percent": 18.5,
        },
    )
    loaded = client.get(
        f"/api/reading-history?book_id={book['id']}",
        headers=headers,
    )

    assert saved.status_code == 200
    assert loaded.status_code == 200
    assert loaded.json()["book_id"] == book["id"]
    assert loaded.json()["chapter_id"] == chapter["id"]
    assert loaded.json()["page_index"] == 3
    assert loaded.json()["progress_percent"] == 18.5
