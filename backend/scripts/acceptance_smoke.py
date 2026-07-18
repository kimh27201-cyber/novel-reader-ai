"""Repeatable end-to-end acceptance flow for a running development API."""

import os
import time

import httpx


BASE_URL = os.getenv("ACCEPTANCE_BASE_URL", "http://127.0.0.1:8000").rstrip("/")


def require(response: httpx.Response, expected: int = 200) -> dict:
    if response.status_code != expected:
        raise RuntimeError(f"{response.request.method} {response.request.url} -> {response.status_code}: {response.text}")
    return response.json()


def main() -> None:
    suffix = str(int(time.time() * 1000))[-10:]
    username = f"accept_{suffix}"
    password = "acceptance-secret-123"
    device_a = f"accept-device-a-{suffix}"
    device_b = f"accept-device-b-{suffix}"

    with httpx.Client(base_url=BASE_URL, timeout=20) as client:
        require(client.get("/api/health/ready"))
        require(client.post("/api/auth/register", json={
            "username": username,
            "email": f"{username}@example.com",
            "password": password,
        }), 201)
        tokens = require(client.post("/api/auth/login", json={"username": username, "password": password}))
        headers = {"Authorization": f"Bearer {tokens['access_token']}"}

        imported = require(client.post("/api/sources/import-demo", headers=headers), 201)
        source = imported["sources"][0]
        searched = require(client.post("/api/search/books", headers=headers, json={
            "keyword": "星轨",
            "source_ids": [source["id"]],
            "force_refresh": True,
        }))
        book_result = searched["books"][0]
        book_info = require(client.post(
            f"/api/sources/{source['id']}/book-info",
            headers=headers,
            json=book_result,
        ))
        toc = require(client.post(
            f"/api/sources/{source['id']}/toc",
            headers=headers,
            json={"book_url": book_info["book_url"], "toc_url": book_info["toc_url"]},
        ))
        chapter_result = toc["chapters"][0]
        content = require(client.post(
            f"/api/sources/{source['id']}/content",
            headers=headers,
            json={"chapter_url": chapter_result["url"]},
        ))
        if not content["content"].strip():
            raise RuntimeError("Demo chapter content was empty")

        book = require(client.post("/api/books", headers=headers, json={
            "source_id": source["id"],
            "title": book_info["title"],
            "author": book_info["author"],
            "cover_url": book_info["cover_url"],
            "description": book_info["intro"],
            "book_url": book_info["book_url"],
            "toc_url": book_info["toc_url"],
        }), 201)
        chapter = require(client.post(f"/api/books/{book['id']}/chapters", headers=headers, json={
            "chapter_index": chapter_result["index"],
            "title": chapter_result["title"],
            "url": chapter_result["url"],
            "content": content["content"],
            "is_cached": True,
        }), 201)
        require(client.post("/api/reading-history", headers=headers, json={
            "book_id": book["id"],
            "chapter_id": chapter["id"],
            "chapter_index": chapter["chapter_index"],
            "page_index": 0,
            "progress_percent": 5,
        }))

        require(client.post("/api/sync/push", headers=headers, json={
            "device_id": device_a,
            "mutations": [],
        }))
        second_device = require(client.get(
            "/api/sync/pull",
            headers=headers,
            params={"device_id": device_b, "cursor": 0},
        ))
        entity_types = {change["entity_type"] for change in second_device["changes"]}
        if not {"source", "book", "reading_history"}.issubset(entity_types):
            raise RuntimeError(f"Second device did not receive all sync entities: {sorted(entity_types)}")

    print("Acceptance flow passed: auth -> source -> search -> book -> toc -> content -> library -> progress -> sync")


if __name__ == "__main__":
    main()
