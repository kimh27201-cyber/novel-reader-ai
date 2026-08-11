import asyncio
import sys
from pathlib import Path
from types import SimpleNamespace

import httpx
import pytest


TESTS_DIR = Path(__file__).resolve().parent
sys.path.append(str(TESTS_DIR))

from helpers import configure_test_environment


BACKEND_DIR = configure_test_environment(__file__)
sys.path.append(str(BACKEND_DIR))

from app.services import source_gateway


def gateway_settings(*, max_response_bytes: int = 1024):
    return SimpleNamespace(
        proxy_max_response_bytes=max_response_bytes,
        proxy_max_request_bytes=1024,
        source_retry_count=0,
        source_cache_max_entries=10,
        source_request_interval_ms=0,
        proxy_allow_private_networks=False,
    )


def resolved(url: str) -> source_gateway.ResolvedTarget:
    parsed = httpx.URL(url)
    return source_gateway.ResolvedTarget(
        logical_url=url,
        request_url=url,
        host_header=parsed.host,
        sni_hostname=parsed.host,
    )


def test_gateway_revalidates_redirect_targets_and_blocks_private_destination(monkeypatch):
    visited: list[str] = []

    async def fake_resolve(url, *, allow_private=None):
        visited.append(url)
        if httpx.URL(url).host == "127.0.0.1":
            raise ValueError("Private network targets are blocked")
        return resolved(url)

    async def run():
        transport = httpx.MockTransport(
            lambda request: httpx.Response(302, headers={"location": "http://127.0.0.1/admin"})
        )
        async with httpx.AsyncClient(transport=transport) as client:
            monkeypatch.setattr(source_gateway, "get_http_client", lambda: client)
            with pytest.raises(ValueError, match="Private network"):
                await source_gateway.fetch("GET", "https://example.com/start", throttle_ms=0)

    monkeypatch.setattr(source_gateway, "get_settings", gateway_settings)
    monkeypatch.setattr(source_gateway, "resolve_target", fake_resolve)
    asyncio.run(run())

    assert visited == ["https://example.com/start", "http://127.0.0.1/admin"]


def test_gateway_stops_stream_when_response_exceeds_limit(monkeypatch):
    async def fake_resolve(url, *, allow_private=None):
        return resolved(url)

    async def run():
        transport = httpx.MockTransport(lambda request: httpx.Response(200, content=b"four"))
        async with httpx.AsyncClient(transport=transport) as client:
            monkeypatch.setattr(source_gateway, "get_http_client", lambda: client)
            with pytest.raises(source_gateway.UpstreamResponseTooLarge):
                await source_gateway.fetch("GET", "https://example.com/chapter", throttle_ms=0)

    monkeypatch.setattr(source_gateway, "get_settings", lambda: gateway_settings(max_response_bytes=3))
    monkeypatch.setattr(source_gateway, "resolve_target", fake_resolve)
    asyncio.run(run())


def test_resolve_target_pins_the_validated_address(monkeypatch):
    class FakeLoop:
        async def getaddrinfo(self, host, port, *, type):
            assert host == "example.com"
            return [(2, 1, 6, "", ("93.184.216.34", port))]

    monkeypatch.setattr(source_gateway.asyncio, "get_running_loop", lambda: FakeLoop())
    monkeypatch.setattr(source_gateway, "get_settings", gateway_settings)

    target = asyncio.run(source_gateway.resolve_target("https://example.com:8443/path?q=1"))

    assert target.logical_url == "https://example.com:8443/path?q=1"
    assert target.request_url == "https://93.184.216.34:8443/path?q=1"
    assert target.host_header == "example.com:8443"
    assert target.sni_hostname == "example.com"


def test_http_client_ignores_environment_proxy(monkeypatch):
    captured = {}

    class FakeClient:
        is_closed = False

    def fake_async_client(**kwargs):
        captured.update(kwargs)
        return FakeClient()

    monkeypatch.setattr(source_gateway, "_client", None)
    monkeypatch.setattr(source_gateway.httpx, "AsyncClient", fake_async_client)

    assert source_gateway.get_http_client().__class__ is FakeClient
    assert captured["trust_env"] is False
