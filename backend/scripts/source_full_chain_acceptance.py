"""Live, opt-in source import and offline-snapshot acceptance.

The script records metadata and lengths only. It does not save chapter text,
cookies, tokens, or source-session secrets in the report.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import time
from uuid import uuid4
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import httpx


YCK_JSON_URL = "https://www.yckceo.com/yuedu/shuyuan/json/id/{source_id}.json"
DEFAULT_SOURCE_IDS = (7037, 3135, 6776)


def require(response: httpx.Response, expected: int | tuple[int, ...] = 200) -> Any:
    accepted = (expected,) if isinstance(expected, int) else expected
    if response.status_code not in accepted:
        raise RuntimeError(
            f"{response.request.method} {response.request.url} -> "
            f"{response.status_code}: {response.text[:500]}"
        )
    return response.json()


def post_with_transient_retry(
    client: httpx.Client,
    url: str,
    *,
    headers: dict[str, str],
    payload: dict[str, Any],
    attempts: int = 3,
) -> Any:
    last_error: Exception | None = None
    for attempt in range(attempts):
        try:
            return require(client.post(url, headers=headers, json=payload))
        except RuntimeError as exc:
            last_error = exc
            transient = any(token in str(exc) for token in ("ConnectTimeout", "ReadTimeout", "bad_gateway"))
            if not transient or attempt + 1 >= attempts:
                raise
            time.sleep(0.6 * (attempt + 1))
    raise last_error or RuntimeError("Transient source request failed")


def fetch_source(
    client: httpx.Client,
    source_id: int,
    headers: dict[str, str],
) -> tuple[str, dict[str, Any]]:
    url = YCK_JSON_URL.format(source_id=source_id)
    try:
        response = client.get(url, timeout=30, follow_redirects=True)
        response.raise_for_status()
        content = response.text.strip()
    except httpx.HTTPError:
        proxied = require(
            client.post(
                "/api/proxy/fetch",
                headers=headers,
                json={"url": url, "method": "GET", "throttle_ms": 500},
            )
        )
        if int(proxied["status_code"]) >= 400:
            raise RuntimeError(f"YCK {source_id} returned HTTP {proxied['status_code']}")
        content = str(proxied["text"]).strip()
    parsed = json.loads(content)
    item = parsed[0] if isinstance(parsed, list) else parsed
    if not isinstance(item, dict):
        raise RuntimeError(f"YCK {source_id} did not return a source object")
    return content, item


def authenticate(client: httpx.Client) -> dict[str, str]:
    suffix = str(int(time.time() * 1000))[-10:]
    username = f"source_accept_{suffix}"
    password = "source-acceptance-123"
    require(
        client.post(
            "/api/auth/register",
            json={
                "username": username,
                "email": f"{username}@example.com",
                "password": password,
            },
        ),
        201,
    )
    token = require(client.post("/api/auth/login", json={"username": username, "password": password}))
    return {"Authorization": f"Bearer {token['access_token']}"}


def run_demo_control(client: httpx.Client, headers: dict[str, str]) -> dict[str, Any]:
    imported = require(client.post("/api/sources/import-demo", headers=headers), 201)
    source = imported["sources"][0]
    diagnostic = require(
        client.post(
            f"/api/sources/{source['id']}/diagnostics",
            headers=headers,
            json={"keyword": "星轨", "force_refresh": True},
        )
    )
    search = require(
        client.post(f"/api/sources/{source['id']}/search", headers=headers, json={"keyword": "星轨", "page": 1})
    )
    selected = search["books"][0]
    info = require(client.post(f"/api/sources/{source['id']}/book-info", headers=headers, json=selected))
    toc = require(
        client.post(
            f"/api/sources/{source['id']}/toc",
            headers=headers,
            json={"book_url": info["book_url"], "toc_url": info["toc_url"]},
        )
    )
    created_book = require(
        client.post(
            "/api/books",
            headers=headers,
            json={
                "source_id": source["id"],
                "title": info["title"],
                "author": info["author"],
                "cover_url": info["cover_url"],
                "description": info["intro"],
                "book_url": info["book_url"],
                "toc_url": info["toc_url"],
            },
        ),
        201,
    )
    chapters = toc["chapters"]
    indexes = sorted({0, len(chapters) // 2, max(0, len(chapters) - 1)})
    samples = []
    first_created = None
    for index in indexes:
        chapter = chapters[index]
        loaded = require(
            client.post(
                f"/api/sources/{source['id']}/content",
                headers=headers,
                json={"chapter_url": chapter["url"]},
            )
        )
        created = require(
            client.post(
                f"/api/books/{created_book['id']}/chapters",
                headers=headers,
                json={
                    "chapter_index": chapter["index"],
                    "title": chapter["title"],
                    "url": chapter["url"],
                    "content": loaded["content"],
                    "is_cached": True,
                },
            ),
            201,
        )
        first_created = first_created or created
        samples.append({"chapter_index": chapter["index"], "content_length": len(loaded["content"].strip())})
    require(
        client.post(
            "/api/reading-history",
            headers=headers,
            json={
                "book_id": created_book["id"],
                "chapter_id": first_created["id"],
                "chapter_index": first_created["chapter_index"],
                "page_index": 1,
                "progress_percent": 5,
            },
        )
    )
    snapshot = require(client.get("/api/library/offline-snapshot", headers=headers))
    return {
        "source_id": source["id"],
        "status": diagnostic["status"],
        "stages": diagnostic["stages"],
        "library": {
            "book_id": created_book["id"],
            "snapshot_books": len(snapshot["books"]),
            "sampled_chapters": samples,
            "sync_cursor": snapshot["sync_cursor"],
        },
    }


def run_live_source(
    client: httpx.Client,
    headers: dict[str, str],
    source_id: int,
    keyword: str,
) -> dict[str, Any]:
    started = time.perf_counter()
    content, raw = fetch_source(client, source_id, headers)
    digest = hashlib.sha256(content.encode("utf-8")).hexdigest()
    first_import = require(client.post("/api/sources/import", headers=headers, json={"content": content}), 201)
    second_import = require(client.post("/api/sources/import", headers=headers, json={"content": content}), 201)
    source = first_import["sources"][0]
    duplicate_source = second_import["sources"][0]
    if source["id"] != duplicate_source["id"]:
        raise RuntimeError("Repeated source import created a duplicate source")

    report: dict[str, Any] = {
        "catalog_id": source_id,
        "catalog_url": YCK_JSON_URL.format(source_id=source_id),
        "fetched_at": datetime.now(UTC).isoformat(),
        "sha256": digest,
        "name": source["name"],
        "base_url": source["base_url"],
        "compatibility": source["compatibility"],
        "deduplicated": True,
        "stages": [],
    }

    if source["compatibility"].startswith("unsupported"):
        report["status"] = "safely_rejected"
        report["elapsed_ms"] = round((time.perf_counter() - started) * 1000)
        return report

    diagnostic = require(
        client.post(
            f"/api/sources/{source['id']}/diagnostics",
            headers=headers,
            json={"keyword": keyword, "force_refresh": True},
        )
    )
    report["status"] = diagnostic["status"]
    report["stages"] = diagnostic["stages"]
    report["failed_stage"] = diagnostic.get("failed_stage", "")
    report["error_code"] = diagnostic.get("error_code", "")

    if diagnostic["status"] == "healthy":
        search = require(
            client.post(
                f"/api/sources/{source['id']}/search",
                headers=headers,
                json={"keyword": keyword, "page": 1},
            )
        )
        if not search["books"]:
            raise RuntimeError("Healthy diagnostic returned no searchable books")
        selected = search["books"][0]
        info = require(
            client.post(f"/api/sources/{source['id']}/book-info", headers=headers, json=selected)
        )
        toc = require(
            client.post(
                f"/api/sources/{source['id']}/toc",
                headers=headers,
                json={"book_url": info["book_url"], "toc_url": info["toc_url"]},
            )
        )
        chapters = toc["chapters"]
        indexes = sorted({0, len(chapters) // 2, max(0, len(chapters) - 1)})
        samples = []
        created_book = require(
            client.post(
                "/api/books",
                headers=headers,
                json={
                    "source_id": source["id"],
                    "title": info["title"],
                    "author": info["author"],
                    "cover_url": info["cover_url"],
                    "description": info["intro"],
                    "book_url": info["book_url"],
                    "toc_url": info["toc_url"],
                },
            ),
            201,
        )
        first_created_chapter = None
        for index in indexes:
            chapter = chapters[index]
            loaded = post_with_transient_retry(
                client,
                f"/api/sources/{source['id']}/content",
                headers=headers,
                payload={"chapter_url": chapter["url"]},
            )
            body_length = len(loaded["content"].strip())
            if body_length < 20:
                raise RuntimeError(f"Chapter sample {index} was too short")
            created = require(
                client.post(
                    f"/api/books/{created_book['id']}/chapters",
                    headers=headers,
                    json={
                        "chapter_index": chapter["index"],
                        "title": chapter["title"],
                        "url": chapter["url"],
                        "content": loaded["content"],
                        "is_cached": True,
                    },
                ),
                201,
            )
            first_created_chapter = first_created_chapter or created
            samples.append({"chapter_index": chapter["index"], "content_length": body_length})
        require(
            client.post(
                "/api/reading-history",
                headers=headers,
                json={
                    "book_id": created_book["id"],
                    "chapter_id": first_created_chapter["id"],
                    "chapter_index": first_created_chapter["chapter_index"],
                    "page_index": 1,
                    "progress_percent": 5,
                },
            )
        )
        snapshot = require(client.get("/api/library/offline-snapshot", headers=headers))
        report["library"] = {
            "book_id": created_book["id"],
            "snapshot_books": len(snapshot["books"]),
            "sampled_chapters": samples,
            "sync_cursor": snapshot["sync_cursor"],
        }

    report["elapsed_ms"] = round((time.perf_counter() - started) * 1000)
    return report


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://127.0.0.1:8765")
    parser.add_argument("--keyword", default="西游记")
    parser.add_argument("--source-id", action="append", type=int, dest="source_ids")
    parser.add_argument("--output", default="artifacts/source-full-chain-acceptance.json")
    parser.add_argument("--allow-live", action="store_true")
    args = parser.parse_args()
    if not args.allow_live:
        raise SystemExit("Live source access is opt-in; rerun with --allow-live")

    report: dict[str, Any] = {
        "started_at": datetime.now(UTC).isoformat(),
        "base_url": args.base_url.rstrip("/"),
        "keyword": args.keyword,
        "trace_id": f"source-acceptance-{uuid4().hex}",
        "demo_control": {},
        "sources": [],
    }
    with httpx.Client(base_url=args.base_url.rstrip("/"), timeout=45, follow_redirects=True) as client:
        require(client.get("/api/health/ready"))
        headers = authenticate(client)
        headers["X-Request-ID"] = report["trace_id"]
        report["demo_control"] = run_demo_control(client, headers)
        for source_id in args.source_ids or DEFAULT_SOURCE_IDS:
            try:
                report["sources"].append(run_live_source(client, headers, source_id, args.keyword))
            except Exception as exc:
                report["sources"].append({
                    "catalog_id": source_id,
                    "status": "failed",
                    "error_type": exc.__class__.__name__,
                    "message": str(exc)[:500],
                })

    report["ended_at"] = datetime.now(UTC).isoformat()
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    rendered = json.dumps(report, ensure_ascii=False, indent=2)
    try:
        print(rendered)
    except UnicodeEncodeError:
        print(rendered.encode("gbk", errors="replace").decode("gbk"))
    if report["demo_control"].get("status") != "healthy":
        raise SystemExit(2)


if __name__ == "__main__":
    main()
