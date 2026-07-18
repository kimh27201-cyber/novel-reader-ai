import sys
from pathlib import Path

TESTS_DIR = Path(__file__).resolve().parent
sys.path.append(str(TESTS_DIR))

from helpers import configure_test_environment


BACKEND_DIR = configure_test_environment(__file__)
sys.path.append(str(BACKEND_DIR))

from fastapi.testclient import TestClient

import app.main as main_module


client = TestClient(main_module.app)


class FakeScalarResult:
    def __init__(self, value):
        self.value = value

    def scalar_one_or_none(self):
        return self.value


class FakeConnection:
    def __init__(self, migration_version):
        self.migration_version = migration_version

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def execute(self, statement):
        assert "alembic_version" in str(statement)
        return FakeScalarResult(self.migration_version)


class FakeEngine:
    def __init__(self, migration_version=None, error=None):
        self.migration_version = migration_version
        self.error = error

    def connect(self):
        if self.error:
            raise self.error
        return FakeConnection(self.migration_version)


def test_liveness_does_not_depend_on_database():
    response = client.get("/api/health/live")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_readiness_accepts_connected_database_at_migration_head(monkeypatch):
    monkeypatch.setattr(main_module, "engine", FakeEngine("0004"))
    monkeypatch.setattr(main_module, "expected_migration_head", lambda: "0004")

    response = client.get("/api/health/ready")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "ready", "migration": "0004"}


def test_readiness_rejects_database_connection_failure(monkeypatch):
    monkeypatch.setattr(main_module, "engine", FakeEngine(error=RuntimeError("database offline")))

    response = client.get("/api/health/ready")

    assert response.status_code == 503
    assert "not ready" in str(response.json()).lower()


def test_readiness_rejects_outdated_migration(monkeypatch):
    monkeypatch.setattr(main_module, "engine", FakeEngine("0003"))
    monkeypatch.setattr(main_module, "expected_migration_head", lambda: "0004")

    response = client.get("/api/health/ready")

    assert response.status_code == 503
    body = response.json()
    assert "migration" in str(body).lower()
    assert "0003" in str(body)
    assert "0004" in str(body)
