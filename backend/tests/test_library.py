import os
import sys
from pathlib import Path
import json

TESTS_DIR = Path(__file__).resolve().parent
sys.path.append(str(TESTS_DIR))

from helpers import configure_test_environment, reset_database


BACKEND_DIR = configure_test_environment(__file__)

sys.path.append(str(BACKEND_DIR))

from fastapi.testclient import TestClient

from app.db.session import Base, engine
from app.main import app


client = TestClient(app)


def setup_function():
    reset_database(Base, engine)


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


def import_source(headers):
    response = client.post(
        "/api/sources/import",
        headers=headers,
        json={"content": json.dumps({
            "bookSourceName": "速读谷",
            "bookSourceUrl": "https://www.sudugu.org",
            "bookSourceGroup": "用户源",
            "searchUrl": "https://www.sudugu.org/search?q={{key}}",
            "ruleSearch": {"bookList": ".item", "name": "a@text", "bookUrl": "a@href"},
            "ruleBookInfo": {"name": "h1@text", "tocUrl": "#dir@href"},
            "ruleToc": {"chapterList": "#dir a", "chapterName": "@text", "chapterUrl": "@href"},
            "ruleContent": {"content": "#content@text"},
        }, ensure_ascii=False)},
    )
    assert response.status_code == 201
    return response.json()["sources"][0]


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


def test_create_book_upserts_existing_book_url_and_updates_source_id():
    headers = auth_headers()
    first_response = client.post(
        "/api/books",
        headers=headers,
        json={
            "title": "我有一枚命运魔骰",
            "author": "未知作者",
            "book_url": "https://www.sudugu.org/1844/",
            "toc_url": "https://www.sudugu.org/1844/#dir",
            "source_id": None,
        },
    )
    assert first_response.status_code == 201
    first = first_response.json()
    source = import_source(headers)

    response = client.post(
        "/api/books",
        headers=headers,
        json={
            "title": "我有一枚命运魔骰",
            "author": "未知作者",
            "book_url": "https://www.sudugu.org/1844/",
            "toc_url": "https://www.sudugu.org/1844/#dir",
            "source_id": source["id"],
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["id"] == first["id"]
    assert body["source_id"] == source["id"]
    listed = client.get("/api/books", headers=headers).json()
    assert len(listed) == 1


def test_create_chapter_upserts_existing_chapter_index():
    headers = auth_headers()
    book = create_book(headers)
    first = create_chapter(headers, book["id"], index=1, title="旧标题")

    response = client.post(
        f"/api/books/{book['id']}/chapters",
        headers=headers,
        json={
            "chapter_index": 1,
            "title": "第2章 红桃7",
            "url": "https://www.sudugu.org/1844/672920.html",
            "content": "",
            "is_cached": False,
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["id"] == first["id"]
    assert body["title"] == "第2章 红桃7"
    chapters = client.get(f"/api/books/{book['id']}/chapters", headers=headers).json()
    assert len(chapters) == 1


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


def test_update_and_delete_book_are_owner_scoped():
    owner_headers = auth_headers()
    other_headers = auth_headers("other", "other@example.com")
    book = create_book(owner_headers, title="Original title")

    cross_user_update = client.patch(
        f"/api/books/{book['id']}",
        headers=other_headers,
        json={"title": "Stolen title"},
    )
    updated = client.patch(
        f"/api/books/{book['id']}",
        headers=owner_headers,
        json={"title": "Updated title", "author": "Updated author"},
    )
    cross_user_delete = client.delete(
        f"/api/books/{book['id']}",
        headers=other_headers,
    )
    deleted = client.delete(
        f"/api/books/{book['id']}",
        headers=owner_headers,
    )

    assert cross_user_update.status_code == 404
    assert updated.status_code == 200
    assert updated.json()["title"] == "Updated title"
    assert updated.json()["author"] == "Updated author"
    assert updated.json()["version"] == book["version"] + 1
    assert cross_user_delete.status_code == 404
    assert deleted.status_code == 200
    assert client.get(f"/api/books/{book['id']}", headers=owner_headers).status_code == 404
    assert client.get("/api/books", headers=owner_headers).json() == []


def test_book_list_supports_limit_offset_and_validates_bounds():
    headers = auth_headers()
    created_ids = []
    for index in range(3):
        response = client.post(
            "/api/books",
            headers=headers,
            json={
                "title": f"Book {index}",
                "book_url": f"https://example.com/book/{index}",
            },
        )
        assert response.status_code == 201
        created_ids.append(response.json()["id"])

    first_page = client.get("/api/books?limit=2&offset=0", headers=headers)
    second_page = client.get("/api/books?limit=2&offset=2", headers=headers)
    too_large = client.get("/api/books?limit=201", headers=headers)
    negative_offset = client.get("/api/books?offset=-1", headers=headers)

    assert first_page.status_code == 200
    assert len(first_page.json()) == 2
    assert second_page.status_code == 200
    assert len(second_page.json()) == 1
    assert {book["id"] for book in first_page.json() + second_page.json()} == set(created_ids)
    assert too_large.status_code == 422
    assert negative_offset.status_code == 422


def test_reading_history_upserts_one_row_per_user_and_book():
    headers = auth_headers()
    book = create_book(headers)

    first = client.post(
        "/api/reading-history",
        headers=headers,
        json={"book_id": book["id"], "chapter_index": 1, "page_index": 2, "progress_percent": 10},
    )
    second = client.post(
        "/api/reading-history",
        headers=headers,
        json={"book_id": book["id"], "chapter_index": 3, "page_index": 4, "progress_percent": 50},
    )

    assert first.status_code == 200
    assert second.status_code == 200
    assert second.json()["id"] == first.json()["id"]
    assert second.json()["chapter_index"] == 3
    assert second.json()["progress_percent"] == 50


def test_book_rejects_source_owned_by_another_user():
    owner_headers = auth_headers()
    other_headers = auth_headers("source-owner", "source-owner@example.com")
    foreign_source = import_source(other_headers)

    response = client.post(
        "/api/books",
        headers=owner_headers,
        json={
            "title": "Foreign source book",
            "book_url": "https://example.com/foreign",
            "source_id": foreign_source["id"],
        },
    )

    assert response.status_code == 400
