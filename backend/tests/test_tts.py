import base64
import asyncio
import os
import sys
import threading
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

TESTS_DIR = Path(__file__).resolve().parent
sys.path.append(str(TESTS_DIR))

from helpers import configure_test_environment, reset_database


BACKEND_DIR = configure_test_environment(__file__)
sys.path.append(str(BACKEND_DIR))

from fastapi.testclient import TestClient

from app.core.config import Settings
from app.db.session import Base, SessionLocal, engine
from app.main import app
from app.models.models import TtsCallLog
from app.services.tts_service import ProviderAudio, TtsServiceError, _decode_streamed_audio


client = TestClient(app)


def setup_function():
    reset_database(Base, engine)


def auth_headers(username="ttsuser", email="tts@example.com"):
    registered = client.post(
        "/api/auth/register",
        json={"username": username, "email": email, "password": "secret123"},
    )
    assert registered.status_code == 201
    login = client.post(
        "/api/auth/login",
        json={"username": username, "password": "secret123"},
    )
    assert login.status_code == 200
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


def enabled_settings(tmp_path: Path, **overrides) -> Settings:
    values = {
        "app_env": "test",
        "jwt_secret_key": "test-secret-key",
        "tts_enabled": True,
        "tts_app_id": "test-app",
        "tts_access_token": "test-access-token",
        "tts_cache_dir": str(tmp_path / "tts-cache"),
        "tts_retry_count": 0,
    }
    values.update(overrides)
    return Settings(_env_file=None, **values)


def test_tts_endpoints_require_login(tmp_path, monkeypatch):
    monkeypatch.setattr("app.api.tts.get_settings", lambda: enabled_settings(tmp_path))

    voices = client.get("/api/tts/voices")
    synthesis = client.post(
        "/api/tts/synthesize",
        json={"text": "测试正文", "voice_id": "loli", "rate": 1},
    )

    assert voices.status_code == 401
    assert synthesis.status_code == 401


def test_list_cloud_voices_uses_stable_logical_ids(tmp_path, monkeypatch):
    settings = enabled_settings(tmp_path)
    monkeypatch.setattr("app.api.tts.get_settings", lambda: settings)
    response = client.get("/api/tts/voices", headers=auth_headers())

    assert response.status_code == 200
    body = response.json()
    assert body["provider"] == "volcengine"
    assert body["available"] is False
    assert [voice["id"] for voice in body["voices"]] == ["loli", "uncle", "youth", "shota", "recital"]
    assert body["voices"][0]["networkRequired"] is True
    assert body["voices"][0]["isDefault"] is True
    assert body["voices"][0]["verified"] is False
    assert body["voices"][0]["unavailable_reason"] == "not_verified"
    assert all("speaker_id" not in voice for voice in body["voices"])


def test_disabled_cloud_voices_are_visible_but_unavailable(tmp_path, monkeypatch):
    settings = enabled_settings(tmp_path, tts_enabled=False, tts_app_id="", tts_access_token="")
    monkeypatch.setattr("app.api.tts.get_settings", lambda: settings)
    headers = auth_headers()

    voices = client.get("/api/tts/voices", headers=headers)
    synthesis = client.post(
        "/api/tts/synthesize",
        headers=headers,
        json={"text": "测试正文", "voice_id": "loli", "rate": 1},
    )

    assert voices.status_code == 200
    assert voices.json()["available"] is False
    assert all(voice["available"] is False for voice in voices.json()["voices"])
    assert synthesis.status_code == 503


def test_synthesize_cache_ticket_and_range(tmp_path, monkeypatch):
    settings = enabled_settings(tmp_path)
    monkeypatch.setattr("app.api.tts.get_settings", lambda: settings)
    calls = []

    async def fake_upstream(settings, *, text, voice, rate, request_id):
        calls.append((text, voice.speaker_id, rate, request_id))
        return b"ID3-realistic-audio"

    monkeypatch.setattr("app.services.tts_service.request_volcengine_audio", fake_upstream)
    headers = auth_headers()
    payload = {"text": "夜色落在长街上。", "voice_id": "recital", "rate": 1.2}

    first = client.post("/api/tts/synthesize", headers=headers, json=payload)
    second = client.post("/api/tts/synthesize", headers=headers, json=payload)

    assert first.status_code == 200
    assert first.json()["audio_format"] == "mp3"
    assert first.json()["provider"] == "volcengine"
    assert first.json()["voice"]["id"] == "recital"
    assert first.json()["cache_hit"] is False
    assert second.status_code == 200
    assert second.json()["cache_hit"] is True
    assert len(calls) == 1

    audio_url = first.json()["audio_url"]
    full_audio = client.get(audio_url)
    ranged_audio = client.get(audio_url, headers={"Range": "bytes=4-12"})
    suffix_audio = client.get(audio_url, headers={"Range": "bytes=-5"})

    assert full_audio.status_code == 200
    assert full_audio.content == b"ID3-realistic-audio"
    assert full_audio.headers["accept-ranges"] == "bytes"
    assert ranged_audio.status_code == 206
    assert ranged_audio.content == b"realistic"
    assert ranged_audio.headers["content-range"] == "bytes 4-12/19"
    assert suffix_audio.status_code == 206
    assert suffix_audio.content == b"audio"

    with SessionLocal() as db:
        logs = db.query(TtsCallLog).order_by(TtsCallLog.id).all()
        assert len(logs) == 2
        assert logs[0].cache_hit is False
        assert logs[1].cache_hit is True
        assert logs[0].character_count == len(payload["text"])
        assert not hasattr(logs[0], "text")


def test_audio_ticket_tampering_and_invalid_range_are_rejected(tmp_path, monkeypatch):
    settings = enabled_settings(tmp_path)
    monkeypatch.setattr("app.api.tts.get_settings", lambda: settings)

    async def fake_upstream(settings, **kwargs):
        return b"1234567890"

    monkeypatch.setattr("app.services.tts_service.request_volcengine_audio", fake_upstream)
    response = client.post(
        "/api/tts/synthesize",
        headers=auth_headers(),
        json={"text": "测试", "voice_id": "loli", "rate": 1},
    )
    audio_url = response.json()["audio_url"]
    parsed = urlsplit(audio_url)
    ticket = parse_qs(parsed.query)["ticket"][0]

    tampered_suffix = "0" if ticket[-1] != "0" else "1"
    tampered = client.get(f"{parsed.path}?ticket={ticket[:-1]}{tampered_suffix}")
    invalid_range = client.get(audio_url, headers={"Range": "bytes=100-200"})

    assert tampered.status_code == 403
    assert invalid_range.status_code == 416
    assert invalid_range.headers["content-range"] == "bytes */10"


def test_tts_text_limits_and_voice_whitelist(tmp_path, monkeypatch):
    settings = enabled_settings(tmp_path)
    monkeypatch.setattr("app.api.tts.get_settings", lambda: settings)
    headers = auth_headers()

    too_many_characters = client.post(
        "/api/tts/synthesize",
        headers=headers,
        json={"text": "a" * 301, "voice_id": "loli", "rate": 1},
    )
    too_many_bytes = client.post(
        "/api/tts/synthesize",
        headers=headers,
        json={"text": "😀" * 226, "voice_id": "loli", "rate": 1},
    )
    invalid_voice = client.post(
        "/api/tts/synthesize",
        headers=headers,
        json={"text": "测试", "voice_id": "provider-speaker-id", "rate": 1},
    )

    assert too_many_characters.status_code == 422
    assert too_many_bytes.status_code == 422
    assert invalid_voice.status_code == 400


def test_daily_uncached_quota_rejects_without_calling_provider(tmp_path, monkeypatch):
    settings = enabled_settings(tmp_path, tts_daily_uncached_characters=2)
    monkeypatch.setattr("app.api.tts.get_settings", lambda: settings)
    called = False

    async def fake_upstream(settings, **kwargs):
        nonlocal called
        called = True
        return b"audio"

    monkeypatch.setattr("app.services.tts_service.request_volcengine_audio", fake_upstream)
    response = client.post(
        "/api/tts/synthesize",
        headers=auth_headers(),
        json={"text": "三个字", "voice_id": "loli", "rate": 1},
    )

    assert response.status_code == 429
    assert called is False
    with SessionLocal() as db:
        log = db.query(TtsCallLog).one()
        assert log.status == "failed"
        assert log.error_code == "user_daily_quota_exceeded"


def test_provider_timeout_is_sanitized_and_logged(tmp_path, monkeypatch):
    settings = enabled_settings(tmp_path)
    monkeypatch.setattr("app.api.tts.get_settings", lambda: settings)

    async def fake_upstream(settings, **kwargs):
        raise TtsServiceError("TTS provider request timed out", status_code=504, error_code="timeout")

    monkeypatch.setattr("app.services.tts_service.request_volcengine_audio", fake_upstream)
    response = client.post(
        "/api/tts/synthesize",
        headers=auth_headers(),
        json={"text": "不得写入日志的正文", "voice_id": "uncle", "rate": 1},
    )

    assert response.status_code == 504
    with SessionLocal() as db:
        log = db.query(TtsCallLog).one()
        assert log.status == "failed"
        assert log.error_code == "timeout"
        assert set(log.__table__.columns.keys()).isdisjoint({"text", "content", "error_message"})


def test_provider_failure_metadata_is_logged_without_raw_message(tmp_path, monkeypatch):
    settings = enabled_settings(tmp_path)
    monkeypatch.setattr("app.api.tts.get_settings", lambda: settings)

    async def fake_upstream(settings, **kwargs):
        raise TtsServiceError(
            "TTS voice is not authorized or unavailable",
            status_code=400,
            error_code="voice_unavailable",
            provider_request_id="provider-log-failure",
            upstream_status=403,
        )

    monkeypatch.setattr("app.services.tts_service.request_volcengine_audio", fake_upstream)
    response = client.post(
        "/api/tts/synthesize",
        headers=auth_headers(),
        json={"text": "安全日志", "voice_id": "uncle", "rate": 1},
    )

    assert response.status_code == 400
    with SessionLocal() as db:
        log = db.query(TtsCallLog).one()
        assert log.provider_request_id == "provider-log-failure"
        assert log.upstream_status == 403
        assert log.audio_bytes == 0
        assert log.error_code == "voice_unavailable"
        assert "authorized" not in " ".join(str(value) for value in log.__dict__.values())


def test_streamed_provider_json_audio_is_combined():
    first = base64.b64encode(b"first").decode()
    second = base64.b64encode(b"-second").decode()
    content = (
        json_line({"code": 0, "data": first})
        + b"\n"
        + json_line({"code": 0, "data": second, "sequence": -1})
    )

    assert _decode_streamed_audio(content, "application/json") == b"first-second"


def test_streamed_provider_json_without_newlines_is_combined():
    first = base64.b64encode(b"first").decode()
    second = base64.b64encode(b"-second").decode()
    content = json_line({"code": 0, "data": first}) + json_line({"code": 0, "data": second})

    assert _decode_streamed_audio(content, "application/json") == b"first-second"


def test_default_voices_use_matching_resource_ids(tmp_path):
    from app.services.tts_service import configured_voices

    voices = {voice.descriptor.id: voice for voice in configured_voices(enabled_settings(tmp_path))}

    assert voices["loli"].speaker_id == "ICL_zh_female_keainvsheng_tob"
    assert voices["loli"].resource_id == "seed-icl-2.0"
    assert voices["uncle"].resource_id == "seed-icl-1.0"
    assert voices["youth"].resource_id == "seed-tts-1.0"
    assert voices["shota"].speaker_id == "ICL_zh_male_xiaonaigou_edf58cf28b8b_tob"
    assert voices["recital"].resource_id == "seed-icl-1.0"


def test_v3_request_uses_voice_resource_and_speed_ratio(tmp_path, monkeypatch):
    from app.services.tts_service import get_voice, request_volcengine_audio

    settings = enabled_settings(tmp_path)
    captured = {}
    encoded = base64.b64encode(b"audio").decode()

    class FakeResponse:
        status_code = 200
        headers = {"content-type": "application/json"}

        async def aread(self):
            return json_line({"code": 0, "data": encoded})

    class FakeStream:
        async def __aenter__(self):
            return FakeResponse()

        async def __aexit__(self, exc_type, exc, traceback):
            return False

    class FakeClient:
        def stream(self, method, url, *, headers, json):
            captured.update({"method": method, "url": url, "headers": headers, "json": json})
            return FakeStream()

    async def fake_client(_settings):
        return FakeClient()

    monkeypatch.setattr("app.services.tts_service.get_http_client", fake_client)
    voice = get_voice(settings, "loli")
    result = asyncio.run(
        request_volcengine_audio(
            settings,
            text="测试",
            voice=voice,
            rate=1.2,
            request_id="request-id",
        )
    )

    assert result.audio == b"audio"
    assert captured["headers"]["X-Api-Resource-Id"] == "seed-icl-2.0"
    assert captured["json"]["req_params"]["speed_ratio"] == 1.2
    assert "speech_rate" not in captured["json"]["req_params"]["audio_params"]


def test_v3_request_captures_provider_log_id(tmp_path, monkeypatch):
    from app.services.tts_service import get_voice, request_volcengine_audio

    settings = enabled_settings(tmp_path)
    encoded = base64.b64encode(b"audio").decode()

    class FakeResponse:
        status_code = 200
        headers = {"content-type": "application/json", "X-Tt-Logid": "provider-log-123"}

        async def aread(self):
            return json_line({"code": 0, "data": encoded})

    class FakeStream:
        async def __aenter__(self):
            return FakeResponse()

        async def __aexit__(self, exc_type, exc, traceback):
            return False

    class FakeClient:
        def stream(self, *args, **kwargs):
            return FakeStream()

    async def fake_client(_settings):
        return FakeClient()

    monkeypatch.setattr("app.services.tts_service.get_http_client", fake_client)
    result = asyncio.run(
        request_volcengine_audio(
            settings,
            text="测试",
            voice=get_voice(settings, "loli"),
            rate=1,
            request_id="local-request",
        )
    )

    assert isinstance(result, ProviderAudio)
    assert result.provider_request_id == "provider-log-123"
    assert result.upstream_status == 200


def test_provider_errors_are_classified_and_sanitized(tmp_path, monkeypatch):
    from app.services.tts_service import get_voice, request_volcengine_audio

    settings = enabled_settings(tmp_path)

    class FakeResponse:
        status_code = 403
        headers = {"content-type": "application/json", "X-Tt-Logid": "safe-log-id"}

        async def aread(self):
            return json_line({"code": 40101, "message": "invalid access token SECRET"})

    class FakeStream:
        async def __aenter__(self):
            return FakeResponse()

        async def __aexit__(self, exc_type, exc, traceback):
            return False

    class FakeClient:
        def stream(self, *args, **kwargs):
            return FakeStream()

    async def fake_client(_settings):
        return FakeClient()

    monkeypatch.setattr("app.services.tts_service.get_http_client", fake_client)
    try:
        asyncio.run(
            request_volcengine_audio(
                settings,
                text="测试",
                voice=get_voice(settings, "loli"),
                rate=1,
                request_id="local-request",
            )
        )
        assert False, "expected provider authentication error"
    except TtsServiceError as exc:
        assert exc.error_code == "provider_auth_failed"
        assert exc.provider_request_id == "safe-log-id"
        assert exc.upstream_status == 403
        assert "SECRET" not in str(exc)


def test_provider_voice_permission_error_is_not_misclassified_as_authentication():
    from app.services.tts_service import classify_provider_error

    error = classify_provider_error(
        http_status=403,
        provider_code="speaker_permission_denied",
        provider_message="speaker is not authorized",
        provider_request_id="voice-log-id",
    )

    assert error.status_code == 400
    assert error.error_code == "voice_unavailable"
    assert error.provider_request_id == "voice-log-id"


def test_status_and_voice_verification_are_based_on_real_uncached_success(tmp_path, monkeypatch):
    settings = enabled_settings(tmp_path)
    monkeypatch.setattr("app.api.tts.get_settings", lambda: settings)

    async def fake_upstream(settings, **kwargs):
        return ProviderAudio(b"ID3-audio", "volc-log-1", 200)

    monkeypatch.setattr("app.services.tts_service.request_volcengine_audio", fake_upstream)
    headers = auth_headers()
    initial = client.get("/api/tts/status", headers=headers)
    assert initial.status_code == 200
    assert initial.json()["verified_voice_count"] == 0
    assert initial.json()["quota"]["user_daily_remaining"] == 10_000

    synthesis = client.post(
        "/api/tts/synthesize",
        headers=headers,
        json={"text": "真实探测", "voice_id": "loli", "rate": 1},
    )
    assert synthesis.status_code == 200
    assert synthesis.json()["request_id"] == "volc-log-1"

    status_response = client.get("/api/tts/status", headers=headers)
    voices_response = client.get("/api/tts/voices", headers=headers)
    assert status_response.json()["verified_voice_count"] == 1
    assert status_response.json()["last_verified_at"]
    assert status_response.json()["quota"]["user_daily_used"] == 4
    loli = next(voice for voice in voices_response.json()["voices"] if voice["id"] == "loli")
    assert loli["available"] is True
    assert loli["verified"] is True
    assert loli["unavailable_reason"] == ""

    with SessionLocal() as db:
        log = db.query(TtsCallLog).one()
        assert log.provider_request_id == "volc-log-1"
        assert log.upstream_status == 200
        assert log.audio_bytes == len(b"ID3-audio")
        assert set(log.__table__.columns.keys()).isdisjoint(
            {"text", "content", "token", "access_token", "error_message"}
        )


def test_global_daily_and_monthly_quotas_are_independent(tmp_path, monkeypatch):
    async def fake_upstream(settings, **kwargs):
        return b"audio"

    monkeypatch.setattr("app.services.tts_service.request_volcengine_audio", fake_upstream)

    daily_settings = enabled_settings(
        tmp_path,
        tts_daily_uncached_characters=100,
        tts_global_daily_uncached_characters=4,
        tts_global_monthly_uncached_characters=100,
    )
    monkeypatch.setattr("app.api.tts.get_settings", lambda: daily_settings)
    headers = auth_headers()
    assert client.post(
        "/api/tts/synthesize",
        headers=headers,
        json={"text": "1234", "voice_id": "loli", "rate": 1},
    ).status_code == 200
    daily_rejected = client.post(
        "/api/tts/synthesize",
        headers=headers,
        json={"text": "5", "voice_id": "uncle", "rate": 1},
    )
    assert daily_rejected.status_code == 429
    assert daily_rejected.json()["detail"] == "Global daily TTS character quota exceeded"

    reset_database(Base, engine)
    monthly_settings = enabled_settings(
        tmp_path / "monthly",
        tts_daily_uncached_characters=100,
        tts_global_daily_uncached_characters=100,
        tts_global_monthly_uncached_characters=3,
    )
    monkeypatch.setattr("app.api.tts.get_settings", lambda: monthly_settings)
    monthly_headers = auth_headers(username="monthly", email="monthly@example.com")
    monthly_rejected = client.post(
        "/api/tts/synthesize",
        headers=monthly_headers,
        json={"text": "1234", "voice_id": "loli", "rate": 1},
    )
    assert monthly_rejected.status_code == 429
    with SessionLocal() as db:
        assert db.query(TtsCallLog).one().error_code == "global_monthly_quota_exceeded"


def test_global_concurrency_gate_times_out_without_blocking_event_loop():
    from app.services.tts_service import acquire_concurrency_gate

    gate = threading.BoundedSemaphore(1)
    assert gate.acquire(blocking=False) is True
    assert asyncio.run(acquire_concurrency_gate(gate, timeout_seconds=0.01)) is False
    gate.release()
    assert asyncio.run(acquire_concurrency_gate(gate, timeout_seconds=0.01)) is True
    gate.release()


def json_line(payload):
    import json

    return json.dumps(payload).encode()
