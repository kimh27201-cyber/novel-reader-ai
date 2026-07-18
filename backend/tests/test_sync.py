import sys
from datetime import UTC, datetime, timedelta
from pathlib import Path

TESTS_DIR = Path(__file__).resolve().parent
sys.path.append(str(TESTS_DIR))

from helpers import configure_test_environment, reset_database


BACKEND_DIR = configure_test_environment(__file__)
sys.path.append(str(BACKEND_DIR))

from fastapi.testclient import TestClient

from app.db.session import Base, SessionLocal, engine
from app.main import app
from app.models.models import Book, SyncChange
from app.services.sync_service import cleanup_synced_tombstones


client = TestClient(app)


def setup_function():
    reset_database(Base, engine)


def auth_headers(username="sync-user", email="sync@example.com"):
    client.post(
        "/api/auth/register",
        json={"username": username, "email": email, "password": "secret123"},
    )
    login = client.post(
        "/api/auth/login",
        json={"username": username, "password": "secret123"},
    )
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


def book_mutation(mutation_id="mutation-book-0001", sync_id="book-sync-0001", **overrides):
    mutation = {
        "mutation_id": mutation_id,
        "entity_type": "book",
        "sync_id": sync_id,
        "base_version": 0,
        "operation": "upsert",
        "payload": {
            "title": "Offline book",
            "author": "Test author",
            "book_url": "https://example.com/offline-book",
        },
    }
    mutation.update(overrides)
    return mutation


def push(headers, mutations, device_id="device-a"):
    return client.post(
        "/api/sync/push",
        headers=headers,
        json={"device_id": device_id, "mutations": mutations},
    )


def test_sync_requires_authentication():
    push_response = client.post(
        "/api/sync/push",
        json={"device_id": "device-a", "mutations": []},
    )
    pull_response = client.get("/api/sync/pull?device_id=device-a")

    assert push_response.status_code == 401
    assert pull_response.status_code == 401


def test_push_is_idempotent_and_pull_uses_cursor():
    headers = auth_headers()
    mutation = book_mutation()

    first = push(headers, [mutation])
    replay = push(headers, [mutation])
    pulled = client.get("/api/sync/pull?device_id=device-b&cursor=0", headers=headers)

    assert first.status_code == 200
    assert replay.status_code == 200
    assert first.json()["results"] == replay.json()["results"]
    assert first.json()["results"][0]["status"] == "applied"
    assert replay.json()["cursor"] == first.json()["cursor"]
    assert pulled.status_code == 200
    assert len(pulled.json()["changes"]) == 1
    assert pulled.json()["changes"][0]["sync_id"] == mutation["sync_id"]

    no_changes = client.get(
        f"/api/sync/pull?device_id=device-b&cursor={pulled.json()['next_cursor']}",
        headers=headers,
    )
    assert no_changes.status_code == 200
    assert no_changes.json()["changes"] == []


def test_stale_base_version_returns_conflict_with_server_payload():
    headers = auth_headers()
    created = push(headers, [book_mutation()])
    assert created.json()["results"][0]["version"] == 1

    conflict_mutation = book_mutation(
        mutation_id="mutation-book-stale",
        base_version=99,
        payload={"title": "Stale overwrite"},
    )
    conflict = push(headers, [conflict_mutation])

    assert conflict.status_code == 200
    result = conflict.json()["results"][0]
    assert result["status"] == "conflict"
    assert result["error_code"] == "version_conflict"
    assert result["version"] == 1
    assert result["server_payload"]["title"] == "Offline book"


def test_delete_creates_tombstone_and_hides_entity_from_library():
    headers = auth_headers()
    sync_id = "book-sync-delete"
    created = push(headers, [book_mutation(sync_id=sync_id)])
    version = created.json()["results"][0]["version"]

    deleted = push(
        headers,
        [book_mutation(
            mutation_id="mutation-book-delete",
            sync_id=sync_id,
            base_version=version,
            operation="delete",
            payload={},
        )],
    )
    pulled = client.get("/api/sync/pull?device_id=device-b&cursor=0", headers=headers)

    assert deleted.status_code == 200
    assert deleted.json()["results"][0]["status"] == "applied"
    assert deleted.json()["results"][0]["version"] == version + 1
    assert [change["operation"] for change in pulled.json()["changes"]] == ["upsert", "delete"]
    tombstone = pulled.json()["changes"][-1]
    assert tombstone["sync_id"] == sync_id
    assert tombstone["payload"] == {}
    assert client.get("/api/books", headers=headers).json() == []


def test_sync_is_user_scoped_and_batch_failure_is_isolated():
    owner_headers = auth_headers()
    other_headers = auth_headers("other-sync", "other-sync@example.com")
    invalid_history = {
        "mutation_id": "mutation-history-invalid",
        "entity_type": "reading_history",
        "sync_id": "history-sync-0001",
        "base_version": 0,
        "operation": "upsert",
        "payload": {"book_sync_id": "missing-book", "progress_percent": 10},
    }

    response = push(owner_headers, [book_mutation(), invalid_history])
    other_pull = client.get("/api/sync/pull?device_id=other-device", headers=other_headers)

    assert response.status_code == 200
    assert [item["status"] for item in response.json()["results"]] == ["applied", "rejected"]
    assert response.json()["results"][1]["error_code"] == "invalid_payload"
    assert other_pull.status_code == 200
    assert other_pull.json()["changes"] == []


def test_initial_identity_merge_keeps_newer_server_copy():
    headers = auth_headers()
    created = client.post(
        "/api/books",
        headers=headers,
        json={
            "title": "Server title",
            "author": "Server author",
            "book_url": "https://example.com/shared-book",
        },
    ).json()
    incoming = book_mutation(
        mutation_id="mutation-book-initial-merge",
        sync_id="different-client-sync-id",
        payload={
            "title": "Older client title",
            "author": "Client author",
            "book_url": "https://example.com/shared-book",
            "updated_at": "2000-01-01T00:00:00Z",
        },
    )

    response = push(headers, [incoming])

    result = response.json()["results"][0]
    assert result["status"] == "applied"
    assert result["sync_id"] == created["sync_id"]
    assert result["server_payload"]["title"] == "Server title"
    assert "newer" in result["message"].lower()
    assert client.get("/api/books", headers=headers).json()[0]["title"] == "Server title"


def test_tombstone_cleanup_removes_entity_and_all_older_changes_after_all_devices_pull():
    headers = auth_headers()
    sync_id = "book-sync-cleanup"
    created = push(headers, [book_mutation(sync_id=sync_id)])
    version = created.json()["results"][0]["version"]
    deleted = push(
        headers,
        [book_mutation(
            mutation_id="mutation-book-cleanup-delete",
            sync_id=sync_id,
            base_version=version,
            operation="delete",
            payload={},
        )],
    )
    assert deleted.json()["results"][0]["status"] == "applied"
    pulled = client.get("/api/sync/pull?device_id=device-b&cursor=0", headers=headers)
    assert pulled.status_code == 200

    db = SessionLocal()
    try:
        user_id = db.query(Book.user_id).filter(Book.sync_id == sync_id).scalar()
        db.query(SyncChange).filter(SyncChange.sync_id == sync_id).update(
            {SyncChange.created_at: datetime.now(UTC) - timedelta(days=31)},
            synchronize_session=False,
        )
        cleanup_synced_tombstones(db, user_id)
        db.commit()
        assert db.query(Book).filter(Book.sync_id == sync_id).count() == 0
        assert db.query(SyncChange).filter(SyncChange.sync_id == sync_id).count() == 0
    finally:
        db.close()
