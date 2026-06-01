import os
import sys
from pathlib import Path

TESTS_DIR = Path(__file__).resolve().parent
sys.path.append(str(TESTS_DIR))

from helpers import configure_test_environment


BACKEND_DIR = configure_test_environment(__file__)
os.environ["AI_PROVIDER"] = "mock"
os.environ["AI_API_KEY"] = ""

sys.path.append(str(BACKEND_DIR))

from fastapi.testclient import TestClient

from app.db.session import Base, SessionLocal, engine
from app.main import app
from app.models.models import AiCallLog, AiSummary, ChatRecord
from app.services.ai_client import AIProviderTimeoutError


client = TestClient(app)


def setup_function():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)


def auth_headers(username="aiuser", email="ai@example.com"):
    client.post(
        "/api/auth/register",
        json={"username": username, "email": email, "password": "secret123"},
    )
    login = client.post(
        "/api/auth/login",
        json={"username": username, "password": "secret123"},
    )
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


def create_book_and_chapter(headers):
    book = client.post(
        "/api/books",
        headers=headers,
        json={
            "title": "星轨图书馆",
            "author": "示例作者",
            "book_url": "https://example.com/book/1",
            "toc_url": "https://example.com/book/1/catalog",
        },
    )
    assert book.status_code == 201
    chapter = client.post(
        f"/api/books/{book.json()['id']}/chapters",
        headers=headers,
        json={
            "chapter_index": 0,
            "title": "第一章 失重借阅证",
            "url": "https://example.com/book/1/0",
            "content": "凌晨四点，星轨图书馆经过城市上空。安禾第一次看见它时，以为那只是一颗移动得过慢的星星。",
            "is_cached": True,
        },
    )
    assert chapter.status_code == 201
    return book.json(), chapter.json()


def test_create_ai_summary_with_mock_provider():
    headers = auth_headers()
    book, chapter = create_book_and_chapter(headers)

    response = client.post(
        "/api/ai/summary",
        headers=headers,
        json={
            "book_id": book["id"],
            "chapter_id": chapter["id"],
            "chapter_text": chapter["content"],
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["book_id"] == book["id"]
    assert body["chapter_id"] == chapter["id"]
    assert body["provider"] == "mock"
    assert "星轨图书馆经过城市上空" in body["summary"]
    assert "安禾" in body["characters"]
    assert body["key_points"]

    with SessionLocal() as db:
        assert db.query(AiSummary).count() == 1
        call_log = db.query(AiCallLog).one()
        assert call_log.call_type == "summary"
        assert call_log.status == "success"
        assert call_log.provider == "mock"
        assert call_log.error_code == ""


def test_create_ai_chat_with_mock_provider():
    headers = auth_headers()
    book, chapter = create_book_and_chapter(headers)

    response = client.post(
        "/api/ai/chat",
        headers=headers,
        json={
            "book_id": book["id"],
            "chapter_id": chapter["id"],
            "question": "安禾看到了什么？",
            "context": chapter["content"],
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["question"] == "安禾看到了什么？"
    assert body["provider"] == "mock"
    assert "根据当前上下文" in body["answer"]

    with SessionLocal() as db:
        assert db.query(ChatRecord).count() == 1
        call_log = db.query(AiCallLog).one()
        assert call_log.call_type == "chat"
        assert call_log.status == "success"
        assert call_log.provider == "mock"
        assert call_log.error_code == ""


def test_list_ai_summaries_for_current_user_only():
    first_headers = auth_headers()
    second_headers = auth_headers("otherai", "otherai@example.com")
    book, chapter = create_book_and_chapter(first_headers)
    client.post(
        "/api/ai/summary",
        headers=first_headers,
        json={
            "book_id": book["id"],
            "chapter_id": chapter["id"],
            "chapter_text": chapter["content"],
        },
    )

    first_list = client.get(f"/api/ai/summaries?book_id={book['id']}", headers=first_headers)
    second_list = client.get("/api/ai/summaries", headers=second_headers)

    assert first_list.status_code == 200
    assert len(first_list.json()) == 1
    assert first_list.json()[0]["chapter_id"] == chapter["id"]
    assert second_list.status_code == 200
    assert second_list.json() == []


def test_list_ai_chats_for_current_user_only():
    first_headers = auth_headers()
    second_headers = auth_headers("otherai", "otherai@example.com")
    book, chapter = create_book_and_chapter(first_headers)
    client.post(
        "/api/ai/chat",
        headers=first_headers,
        json={
            "book_id": book["id"],
            "chapter_id": chapter["id"],
            "question": "安禾看到了什么？",
            "context": chapter["content"],
        },
    )

    first_list = client.get(f"/api/ai/chats?chapter_id={chapter['id']}", headers=first_headers)
    second_list = client.get("/api/ai/chats", headers=second_headers)

    assert first_list.status_code == 200
    assert len(first_list.json()) == 1
    assert first_list.json()[0]["question"] == "安禾看到了什么？"
    assert second_list.status_code == 200
    assert second_list.json() == []


def test_ai_history_filter_requires_current_user_ownership():
    first_headers = auth_headers()
    second_headers = auth_headers("otherai", "otherai@example.com")
    book, chapter = create_book_and_chapter(first_headers)

    summaries = client.get(f"/api/ai/summaries?book_id={book['id']}", headers=second_headers)
    chats = client.get(f"/api/ai/chats?chapter_id={chapter['id']}", headers=second_headers)

    assert summaries.status_code == 404
    assert chats.status_code == 404


def test_ai_summary_requires_current_user_ownership():
    first_headers = auth_headers()
    second_headers = auth_headers("otherai", "otherai@example.com")
    book, chapter = create_book_and_chapter(first_headers)

    response = client.post(
        "/api/ai/summary",
        headers=second_headers,
        json={
            "book_id": book["id"],
            "chapter_id": chapter["id"],
            "chapter_text": chapter["content"],
        },
    )

    assert response.status_code == 404


def test_ai_endpoints_require_login():
    summary = client.post("/api/ai/summary", json={"chapter_text": "测试正文"})
    chat = client.post("/api/ai/chat", json={"question": "发生了什么？", "context": "测试上下文"})

    assert summary.status_code == 401
    assert chat.status_code == 401


def test_ai_summary_timeout_returns_gateway_timeout_and_logs_failure(monkeypatch):
    headers = auth_headers()
    book, chapter = create_book_and_chapter(headers)

    async def fail_summary(chapter_text, settings):
        raise AIProviderTimeoutError("AI provider request timed out")

    monkeypatch.setattr("app.api.ai.summarize_chapter", fail_summary)

    response = client.post(
        "/api/ai/summary",
        headers=headers,
        json={
            "book_id": book["id"],
            "chapter_id": chapter["id"],
            "chapter_text": chapter["content"],
        },
    )

    assert response.status_code == 504
    body = response.json()
    assert body["error"]["code"] == "gateway_timeout"
    assert body["error"]["message"] == "AI provider request timed out"

    with SessionLocal() as db:
        call_log = db.query(AiCallLog).one()
        assert call_log.call_type == "summary"
        assert call_log.status == "failed"
        assert call_log.error_code == "timeout"
        assert call_log.error_message == "AI provider request timed out"


def test_list_ai_call_logs_for_current_user_only():
    first_headers = auth_headers()
    second_headers = auth_headers("callother", "callother@example.com")
    book, chapter = create_book_and_chapter(first_headers)
    client.post(
        "/api/ai/chat",
        headers=first_headers,
        json={
            "book_id": book["id"],
            "chapter_id": chapter["id"],
            "question": "安禾看到了什么？",
            "context": chapter["content"],
        },
    )

    first_list = client.get("/api/ai/calls", headers=first_headers)
    second_list = client.get("/api/ai/calls", headers=second_headers)

    assert first_list.status_code == 200
    assert len(first_list.json()) == 1
    assert first_list.json()[0]["call_type"] == "chat"
    assert first_list.json()[0]["status"] == "success"
    assert second_list.status_code == 200
    assert second_list.json() == []
