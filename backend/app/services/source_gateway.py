import asyncio
import hashlib
import ipaddress
import json
import logging
import socket
import time
from collections import OrderedDict
from dataclasses import dataclass
from typing import Any
from urllib.parse import urljoin, urlparse, urlsplit, urlunsplit

import httpx

from app.core.config import get_settings


_client: httpx.AsyncClient | None = None
_rate_lock = asyncio.Lock()
_last_request_at: dict[str, float] = {}
_cache: OrderedDict[str, tuple[float, httpx.Response]] = OrderedDict()
logger = logging.getLogger("novel_reader.upstream")


class UpstreamResponseTooLarge(ValueError):
    pass


@dataclass(frozen=True)
class ResolvedTarget:
    logical_url: str
    request_url: str
    host_header: str
    sni_hostname: str


def get_http_client() -> httpx.AsyncClient:
    global _client
    settings = get_settings()
    if _client is None or getattr(_client, "is_closed", False):
        _client = httpx.AsyncClient(
            follow_redirects=False,
            timeout=httpx.Timeout(
                max(settings.source_timeout_seconds, settings.proxy_timeout_seconds),
                connect=min(4.0, settings.source_timeout_seconds),
            ),
            # The connection URL is pinned to a validated IP. Reusing that
            # connection for another hostname on the same CDN address could
            # reuse the wrong TLS/SNI session, so pinned connections are not
            # kept alive across requests.
            limits=httpx.Limits(max_connections=40, max_keepalive_connections=0),
        )
    return _client


async def close_http_client() -> None:
    global _client
    if _client is not None and not getattr(_client, "is_closed", False):
        close = getattr(_client, "aclose", None)
        if close:
            await close()
    _client = None
    _cache.clear()


def _blocked(address: str) -> bool:
    return not ipaddress.ip_address(address).is_global


async def resolve_target(url: str, *, allow_private: bool | None = None) -> ResolvedTarget:
    parsed = urlsplit(url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError("Only http and https URLs are allowed")
    if parsed.username is not None or parsed.password is not None:
        raise ValueError("Credentials in upstream URLs are not allowed")
    if allow_private is None:
        allow_private = get_settings().proxy_allow_private_networks
    host = parsed.hostname or ""
    port = parsed.port or (443 if parsed.scheme == "https" else 80)
    try:
        infos = await asyncio.get_running_loop().getaddrinfo(
            host,
            port,
            type=socket.SOCK_STREAM,
        )
    except OSError as exc:
        raise httpx.ConnectError("Target DNS lookup failed") from exc
    addresses = {item[4][0] for item in infos}
    if not addresses:
        raise httpx.ConnectError("Target DNS lookup returned no addresses")
    if not allow_private and any(_blocked(address) for address in addresses):
        raise ValueError("Private network targets are blocked")

    # Connect to the address that was just validated instead of resolving the
    # hostname for a second time. This closes the DNS-rebinding window between
    # validation and the actual connection.
    address = sorted(addresses, key=lambda value: (":" in value, value))[0]
    address_netloc = f"[{address}]" if ":" in address else address
    if parsed.port is not None:
        address_netloc = f"{address_netloc}:{parsed.port}"
    hostname = host.encode("idna").decode("ascii")
    host_header = f"[{hostname}]" if ":" in hostname else hostname
    if parsed.port is not None:
        host_header = f"{host_header}:{parsed.port}"
    request_url = urlunsplit((parsed.scheme, address_netloc, parsed.path or "/", parsed.query, ""))
    return ResolvedTarget(
        logical_url=urlunsplit((parsed.scheme, parsed.netloc, parsed.path or "/", parsed.query, "")),
        request_url=request_url,
        host_header=host_header,
        sni_hostname=hostname,
    )


async def validate_target(url: str, *, allow_private: bool | None = None) -> None:
    await resolve_target(url, allow_private=allow_private)


async def _throttle(url: str, interval_ms: int | None) -> None:
    interval = (get_settings().source_request_interval_ms if interval_ms is None else interval_ms) / 1000
    if interval <= 0:
        return
    host = urlparse(url).netloc.lower()
    async with _rate_lock:
        now = time.monotonic()
        wait_for = interval - (now - _last_request_at.get(host, 0))
        if wait_for > 0:
            await asyncio.sleep(wait_for)
        _last_request_at[host] = time.monotonic()


def _cache_key(method: str, url: str, headers: dict[str, str], content: bytes | None) -> str:
    material = json.dumps(
        {"method": method, "url": url, "headers": headers, "body": (content or b"").decode("utf-8", errors="replace")},
        ensure_ascii=False,
        sort_keys=True,
    )
    return hashlib.sha256(material.encode("utf-8")).hexdigest()


def _get_cached(key: str) -> httpx.Response | None:
    cached = _cache.get(key)
    if not cached:
        return None
    expires_at, response = cached
    if expires_at <= time.monotonic():
        _cache.pop(key, None)
        return None
    _cache.move_to_end(key)
    return response


def _put_cached(key: str, response: httpx.Response, ttl_seconds: int) -> None:
    _cache[key] = (time.monotonic() + ttl_seconds, response)
    _cache.move_to_end(key)
    while len(_cache) > get_settings().source_cache_max_entries:
        _cache.popitem(last=False)


async def _request_limited(
    method: str,
    url: str,
    *,
    headers: dict[str, str],
    content: bytes | None,
    allow_private: bool | None,
) -> httpx.Response:
    current_url = url
    current_method = method
    current_content = content
    current_headers = dict(headers)
    max_response_bytes = get_settings().proxy_max_response_bytes

    for redirect_count in range(6):
        target = await resolve_target(current_url, allow_private=allow_private)
        request_headers = {key: value for key, value in current_headers.items() if key.lower() != "host"}
        request_headers["Host"] = target.host_header
        client = get_http_client()
        async with client.stream(
            current_method,
            target.request_url,
            headers=request_headers,
            content=current_content,
            follow_redirects=False,
            extensions={"sni_hostname": target.sni_hostname},
        ) as upstream:
            declared_length = upstream.headers.get("content-length")
            if declared_length:
                try:
                    parsed_length = int(declared_length)
                except ValueError:
                    parsed_length = 0
                if parsed_length > max_response_bytes:
                    raise UpstreamResponseTooLarge("Upstream response is too large")
            chunks: list[bytes] = []
            received = 0
            async for chunk in upstream.aiter_bytes():
                received += len(chunk)
                if received > max_response_bytes:
                    raise UpstreamResponseTooLarge("Upstream response is too large")
                chunks.append(chunk)
            response = httpx.Response(
                upstream.status_code,
                headers=upstream.headers,
                content=b"".join(chunks),
                request=httpx.Request(current_method, target.logical_url, headers=current_headers),
                extensions=upstream.extensions,
            )

        if response.status_code not in {301, 302, 303, 307, 308}:
            return response
        location = response.headers.get("location")
        if not location:
            return response
        if redirect_count == 5:
            raise httpx.TooManyRedirects("Too many upstream redirects", request=response.request)

        next_url = urljoin(current_url, location)
        previous = urlparse(current_url)
        following = urlparse(next_url)
        if (previous.scheme, previous.hostname, previous.port) != (
            following.scheme,
            following.hostname,
            following.port,
        ):
            current_headers = {
                key: value
                for key, value in current_headers.items()
                if key.lower() not in {"authorization", "cookie", "proxy-authorization"}
            }
        if response.status_code == 303 or (response.status_code in {301, 302} and current_method == "POST"):
            current_method = "GET"
            current_content = None
            current_headers = {
                key: value
                for key, value in current_headers.items()
                if key.lower() not in {"content-length", "content-type"}
            }
        current_url = next_url

    raise httpx.TooManyRedirects("Too many upstream redirects")


async def fetch(
    method: str,
    url: str,
    *,
    headers: dict[str, str] | None = None,
    content: bytes | None = None,
    throttle_ms: int | None = None,
    cache_ttl_seconds: int = 0,
    force_refresh: bool = False,
    allow_private: bool | None = None,
) -> httpx.Response:
    method = method.upper()
    if method not in {"GET", "POST"}:
        raise ValueError("Only GET and POST upstream requests are allowed")
    if len(content or b"") > get_settings().proxy_max_request_bytes:
        raise ValueError("Upstream request body is too large")
    headers = {str(key): str(value) for key, value in (headers or {}).items()}
    key = _cache_key(method, url, headers, content)
    if method == "GET" and cache_ttl_seconds > 0 and not force_refresh:
        cached = _get_cached(key)
        if cached is not None:
            return cached
    await _throttle(url, throttle_ms)
    attempts = 1 + (get_settings().source_retry_count if method == "GET" else 0)
    last_error: httpx.RequestError | None = None
    for attempt in range(attempts):
        started_at = time.perf_counter()
        try:
            response = await _request_limited(
                method,
                url,
                headers=headers,
                content=content,
                allow_private=allow_private,
            )
            if method == "GET" and cache_ttl_seconds > 0 and response.is_success:
                _put_cached(key, response, cache_ttl_seconds)
            logger.info(json.dumps({
                "event": "upstream_request",
                "method": method,
                "host": urlparse(url).hostname,
                "status_code": response.status_code,
                "duration_ms": int((time.perf_counter() - started_at) * 1000),
                "attempt": attempt + 1,
            }, ensure_ascii=False))
            return response
        except httpx.RequestError as exc:
            last_error = exc
            logger.warning(json.dumps({
                "event": "upstream_request_failed",
                "method": method,
                "host": urlparse(url).hostname,
                "duration_ms": int((time.perf_counter() - started_at) * 1000),
                "attempt": attempt + 1,
                "error_code": exc.__class__.__name__,
            }, ensure_ascii=False))
            if attempt + 1 < attempts:
                await asyncio.sleep(0.15 * (attempt + 1))
    assert last_error is not None
    raise last_error


def cache_size() -> int:
    return len(_cache)
