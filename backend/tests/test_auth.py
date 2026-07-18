import os
import sys
from pathlib import Path

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
    assert response.headers["X-Access-Token"] == body["access_token"]


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


def test_me_accepts_x_access_token_header():
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
        headers={"X-Access-Token": token},
    )

    assert response.status_code == 200
    assert response.json()["username"] == "reader"


def test_me_rejects_access_token_query_parameter_by_default():
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

    response = client.get(f"/api/auth/me?access_token={token}")

    assert response.status_code == 401


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


def test_login_returns_refresh_token_and_expiry():
    client.post(
        "/api/auth/register",
        json={"username": "reader", "email": "reader@example.com", "password": "secret123"},
    )

    response = client.post(
        "/api/auth/login",
        json={"username": "reader", "password": "secret123"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["refresh_token"]
    assert body["refresh_token"] != body["access_token"]
    assert body["expires_in"] > 0


def test_refresh_rotates_token_and_rejects_replay():
    client.post(
        "/api/auth/register",
        json={"username": "reader", "email": "reader@example.com", "password": "secret123"},
    )
    login = client.post(
        "/api/auth/login",
        json={"username": "reader", "password": "secret123"},
    ).json()

    refreshed = client.post(
        "/api/auth/refresh",
        json={"refresh_token": login["refresh_token"]},
    )
    replay = client.post(
        "/api/auth/refresh",
        json={"refresh_token": login["refresh_token"]},
    )

    assert refreshed.status_code == 200
    assert refreshed.json()["access_token"] != login["access_token"]
    assert refreshed.json()["refresh_token"] != login["refresh_token"]
    assert replay.status_code == 401

    # A replay invalidates the complete active token family.
    successor = client.post(
        "/api/auth/refresh",
        json={"refresh_token": refreshed.json()["refresh_token"]},
    )
    assert successor.status_code == 401


def test_logout_revokes_only_current_users_refresh_token():
    client.post(
        "/api/auth/register",
        json={"username": "reader", "email": "reader@example.com", "password": "secret123"},
    )
    owner_login = client.post(
        "/api/auth/login",
        json={"username": "reader", "password": "secret123"},
    ).json()
    client.post(
        "/api/auth/register",
        json={"username": "other", "email": "other@example.com", "password": "secret123"},
    )
    other_login = client.post(
        "/api/auth/login",
        json={"username": "other", "password": "secret123"},
    ).json()

    cross_user = client.post(
        "/api/auth/logout",
        headers={"Authorization": f"Bearer {other_login['access_token']}"},
        json={"refresh_token": owner_login["refresh_token"]},
    )
    logout = client.post(
        "/api/auth/logout",
        headers={"Authorization": f"Bearer {owner_login['access_token']}"},
        json={"refresh_token": owner_login["refresh_token"]},
    )
    refresh_after_logout = client.post(
        "/api/auth/refresh",
        json={"refresh_token": owner_login["refresh_token"]},
    )

    assert cross_user.status_code == 200
    assert cross_user.json() == {"revoked": False}
    assert logout.status_code == 200
    assert logout.json() == {"revoked": True}
    assert refresh_after_logout.status_code == 401
