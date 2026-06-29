import asyncio
import time
from typing import Any
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field


router = APIRouter(prefix="/api/proxy", tags=["proxy"])

ALLOWED_METHODS = {"GET", "POST", "PUT", "PATCH", "DELETE"}
BLOCKED_REQUEST_HEADERS = {
    "host",
    "content-length",
    "connection",
    "transfer-encoding",
    "accept-encoding",
}
REQUEST_INTERVAL_SECONDS = 0.5
_last_request_at: dict[str, float] = {}
_rate_lock = asyncio.Lock()
_proxy_http_client: httpx.AsyncClient | None = None


class ProxyFetchRequest(BaseModel):
    url: str = Field(..., min_length=1)
    method: str = "GET"
    headers: dict[str, str] = Field(default_factory=dict)
    body: str | None = None
    charset: str | None = ""
    throttle_ms: int | None = Field(default=None, ge=0, le=10000)


class ProxyFetchResponse(BaseModel):
    text: str
    status_code: int
    final_url: str
    headers: dict[str, str]
    elapsed_ms: int
    content_bytes: int
    encoding: str


@router.get("/health")
def proxy_health() -> dict[str, str]:
    return {"status": "ok"}


@router.post("/fetch", response_model=ProxyFetchResponse)
async def proxy_fetch(payload: ProxyFetchRequest) -> ProxyFetchResponse:
    validate_proxy_request(payload)
    started_at = time.monotonic()
    await throttle_by_host(payload.url, payload.throttle_ms)
    request_headers = sanitize_headers(payload.headers)

    try:
        response = await get_proxy_http_client().request(
            payload.method.upper(),
            payload.url,
            headers=request_headers,
            content=payload.body.encode("utf-8") if payload.body is not None else None,
        )
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Proxy request failed: {exc}",
        ) from exc

    decoded_text, encoding = decode_response_text_with_encoding(response, payload.charset or "")
    return ProxyFetchResponse(
        text=decoded_text,
        status_code=response.status_code,
        final_url=str(response.url),
        headers=filter_response_headers(response.headers),
        elapsed_ms=max(0, int((time.monotonic() - started_at) * 1000)),
        content_bytes=len(response.content or b""),
        encoding=encoding,
    )


def get_proxy_http_client() -> httpx.AsyncClient:
    global _proxy_http_client
    if _proxy_http_client is None or getattr(_proxy_http_client, "is_closed", False):
        _proxy_http_client = httpx.AsyncClient(
            follow_redirects=True,
            timeout=15.0,
            limits=httpx.Limits(max_connections=40, max_keepalive_connections=20),
        )
    return _proxy_http_client


def validate_proxy_request(payload: ProxyFetchRequest) -> None:
    parsed = urlparse(payload.url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only http and https URLs can be proxied")
    if payload.method.upper() not in ALLOWED_METHODS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Unsupported method: {payload.method}")


async def throttle_by_host(url: str, throttle_ms: int | None = None) -> None:
    interval_seconds = REQUEST_INTERVAL_SECONDS if throttle_ms is None else max(0, throttle_ms) / 1000
    if interval_seconds <= 0:
        return
    host = urlparse(url).netloc.lower()
    async with _rate_lock:
        now = time.monotonic()
        wait_for = interval_seconds - (now - _last_request_at.get(host, 0))
        if wait_for > 0:
            await asyncio.sleep(wait_for)
        _last_request_at[host] = time.monotonic()


def sanitize_headers(headers: dict[str, Any]) -> dict[str, str]:
    sanitized: dict[str, str] = {}
    for key, value in (headers or {}).items():
        normalized = str(key).strip()
        if not normalized or normalized.lower() in BLOCKED_REQUEST_HEADERS:
            continue
        sanitized[normalized] = str(value)
    return sanitized


def decode_response_text(response: httpx.Response, charset: str = "") -> str:
    return decode_response_text_with_encoding(response, charset)[0]


def decode_response_text_with_encoding(response: httpx.Response, charset: str = "") -> tuple[str, str]:
    encodings = [
        charset,
        response.encoding,
        "utf-8",
        "gb18030",
        "gbk",
        "gb2312",
    ]
    for encoding in encodings:
        if not encoding:
            continue
        try:
            return response.content.decode(encoding), encoding
        except (LookupError, UnicodeDecodeError):
            continue
    return response.content.decode("utf-8", errors="replace"), "utf-8"


def filter_response_headers(headers: httpx.Headers) -> dict[str, str]:
    return {
        key: value
        for key, value in headers.items()
        if key.lower() not in {"set-cookie", "transfer-encoding", "content-encoding"}
    }
