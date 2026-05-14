import os
import sys
from pathlib import Path

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


def test_health_check():
    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_register_user():
    response = client.post(
        "/api/auth/register",
        json={
            "username": "reader",
            "email": "reader@example.com",
            "password": "secret123",
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["username"] == "reader"
    assert body["email"] == "reader@example.com"
    assert "hashed_password" not in body


def test_register_rejects_duplicate_username_or_email():
    payload = {
        "username": "reader",
        "email": "reader@example.com",
        "password": "secret123",
    }
    first = client.post("/api/auth/register", json=payload)
    duplicate = client.post("/api/auth/register", json=payload)

    assert first.status_code == 201
    assert duplicate.status_code == 400
    assert "already" in duplicate.json()["detail"].lower()


def test_login_returns_bearer_token():
    client.post(
        "/api/auth/register",
        json={
            "username": "reader",
            "email": "reader@example.com",
            "password": "secret123",
        },
    )

    response = client.post(
        "/api/auth/login",
        json={"username": "reader", "password": "secret123"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["token_type"] == "bearer"
    assert body["access_token"]


def test_login_rejects_wrong_password():
    client.post(
        "/api/auth/register",
        json={
            "username": "reader",
            "email": "reader@example.com",
            "password": "secret123",
        },
    )

    response = client.post(
        "/api/auth/login",
        json={"username": "reader", "password": "bad-password"},
    )

    assert response.status_code == 401


def test_me_returns_current_user_with_token():
    client.post(
        "/api/auth/register",
        json={
            "username": "reader",
            "email": "reader@example.com",
            "password": "secret123",
        },
    )
    login = client.post(
        "/api/auth/login",
        json={"username": "reader", "password": "secret123"},
    )
    token = login.json()["access_token"]

    response = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    assert response.json()["username"] == "reader"


def test_me_accepts_token_pasted_with_bearer_prefix_in_swagger():
    client.post(
        "/api/auth/register",
        json={
            "username": "reader",
            "email": "reader@example.com",
            "password": "secret123",
        },
    )
    login = client.post(
        "/api/auth/login",
        json={"username": "reader", "password": "secret123"},
    )
    token = login.json()["access_token"]

    response = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer Bearer {token}"},
    )

    assert response.status_code == 200
    assert response.json()["username"] == "reader"
