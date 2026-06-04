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


class ProxyFetchRequest(BaseModel):
    url: str = Field(..., min_length=1)
    method: str = "GET"
    headers: dict[str, str] = Field(default_factory=dict)
    body: str | None = None
    charset: str | None = ""


class ProxyFetchResponse(BaseModel):
    text: str
    status_code: int
    final_url: str
    headers: dict[str, str]


@router.get("/health")
def proxy_health() -> dict[str, str]:
    return {"status": "ok"}


@router.post("/fetch", response_model=ProxyFetchResponse)
async def proxy_fetch(payload: ProxyFetchRequest) -> ProxyFetchResponse:
    validate_proxy_request(payload)
    await throttle_by_host(payload.url)
    request_headers = sanitize_headers(payload.headers)

    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=15.0) as client:
            response = await client.request(
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

    return ProxyFetchResponse(
        text=decode_response_text(response, payload.charset or ""),
        status_code=response.status_code,
        final_url=str(response.url),
        headers=filter_response_headers(response.headers),
    )


def validate_proxy_request(payload: ProxyFetchRequest) -> None:
    parsed = urlparse(payload.url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only http and https URLs can be proxied")
    if payload.method.upper() not in ALLOWED_METHODS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Unsupported method: {payload.method}")


async def throttle_by_host(url: str) -> None:
    host = urlparse(url).netloc.lower()
    async with _rate_lock:
        now = time.monotonic()
        wait_for = REQUEST_INTERVAL_SECONDS - (now - _last_request_at.get(host, 0))
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
            return response.content.decode(encoding)
        except (LookupError, UnicodeDecodeError):
            continue
    return response.content.decode("utf-8", errors="replace")


def filter_response_headers(headers: httpx.Headers) -> dict[str, str]:
    return {
        key: value
        for key, value in headers.items()
        if key.lower() not in {"set-cookie", "transfer-encoding", "content-encoding"}
    }
