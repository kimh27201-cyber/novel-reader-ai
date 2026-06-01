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


def test_request_id_header_is_returned_and_reused():
    response = client.get("/api/health", headers={"X-Request-ID": "test-request-id"})

    assert response.status_code == 200
    assert response.headers["X-Request-ID"] == "test-request-id"


def test_http_errors_include_unified_error_body_and_request_id():
    response = client.get("/api/books", headers={"X-Request-ID": "auth-missing"})

    assert response.status_code == 401
    assert response.headers["X-Request-ID"] == "auth-missing"
    assert response.json()["detail"] == "Not authenticated"
    assert response.json()["error"] == {
        "code": "unauthorized",
        "message": "Not authenticated",
        "request_id": "auth-missing",
    }


def test_validation_errors_include_unified_error_body_and_fields():
    response = client.post(
        "/api/auth/register",
        headers={"X-Request-ID": "validation-case"},
        json={"username": "reader"},
    )

    body = response.json()

    assert response.status_code == 422
    assert response.headers["X-Request-ID"] == "validation-case"
    assert body["error"]["code"] == "validation_error"
    assert body["error"]["message"] == "Request validation failed"
    assert body["error"]["request_id"] == "validation-case"
    assert body["error"]["fields"]
    assert body["detail"]
