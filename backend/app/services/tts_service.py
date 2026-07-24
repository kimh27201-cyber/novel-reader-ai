import asyncio
import base64
import binascii
from dataclasses import dataclass
from datetime import UTC, datetime
import hashlib
import hmac
import json
from pathlib import Path
import re
import threading
import time
from typing import Any
from uuid import uuid4

import httpx
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.models.models import TtsCallLog
from app.schemas.tts import VoiceDescriptor


CACHE_KEY_PATTERN = re.compile(r"^[0-9a-f]{64}$")
DEFAULT_VOICES = [
    {
        "id": "loli",
        "name": "可爱女生",
        "role": "萝莉",
        "speaker_id": "ICL_zh_female_keainvsheng_tob",
        "resource_id": "seed-icl-2.0",
        "is_default": True,
    },
    {
        "id": "uncle",
        "name": "胡子叔叔",
        "role": "大叔",
        "speaker_id": "ICL_zh_male_huzi_v1_tob",
        "resource_id": "seed-icl-1.0",
    },
    {
        "id": "youth",
        "name": "反卷青年",
        "role": "青年",
        "speaker_id": "zh_male_fanjuanqingnian_mars_bigtts",
        "resource_id": "seed-tts-1.0",
    },
    {
        "id": "shota",
        "name": "奶气小生",
        "role": "正太",
        "speaker_id": "ICL_zh_male_xiaonaigou_edf58cf28b8b_tob",
        "resource_id": "seed-icl-1.0",
    },
    {
        "id": "recital",
        "name": "内敛才俊",
        "role": "朗诵",
        "speaker_id": "ICL_zh_male_neiliancaijun_e991be511569_tob",
        "resource_id": "seed-icl-1.0",
    },
]


class TtsServiceError(Exception):
    def __init__(self, message: str, *, status_code: int, error_code: str) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.error_code = error_code


@dataclass(frozen=True)
class VoiceConfig:
    descriptor: VoiceDescriptor
    speaker_id: str
    resource_id: str


@dataclass(frozen=True)
class SynthesisResult:
    cache_key: str
    cache_hit: bool
    duration_ms: int
    request_id: str
    voice: VoiceDescriptor


_http_client: httpx.AsyncClient | None = None
_client_lock = asyncio.Lock()
_concurrency_lock = threading.Lock()
_concurrency_limit = 0
_concurrency_gate: threading.BoundedSemaphore | None = None
_quota_lock = threading.Lock()
_quota_reservations: dict[int, int] = {}


def cloud_tts_available(settings: Settings) -> bool:
    return bool(settings.tts_enabled and settings.tts_app_id.strip() and settings.tts_access_token.strip())


def _voice_items(settings: Settings) -> list[dict[str, Any]]:
    raw = settings.tts_voices_json.strip()
    if not raw:
        return [dict(item) for item in DEFAULT_VOICES]
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise TtsServiceError("TTS voice configuration is invalid", status_code=503, error_code="invalid_config") from exc
    if isinstance(parsed, dict):
        items: list[dict[str, Any]] = []
        for logical_id, value in parsed.items():
            if isinstance(value, str):
                items.append({"id": logical_id, "name": logical_id, "role": logical_id, "speaker_id": value})
            elif isinstance(value, dict):
                items.append({"id": logical_id, **value})
        return items
    if isinstance(parsed, list):
        return [item for item in parsed if isinstance(item, dict)]
    raise TtsServiceError("TTS voice configuration is invalid", status_code=503, error_code="invalid_config")


def configured_voices(settings: Settings) -> list[VoiceConfig]:
    service_available = cloud_tts_available(settings)
    voices: list[VoiceConfig] = []
    seen: set[str] = set()
    for index, item in enumerate(_voice_items(settings)):
        logical_id = str(item.get("id") or "").strip()
        speaker_id = str(item.get("speaker_id") or item.get("speakerId") or "").strip()
        if not logical_id or not speaker_id or logical_id in seen:
            continue
        seen.add(logical_id)
        voices.append(
            VoiceConfig(
                descriptor=VoiceDescriptor(
                    id=logical_id,
                    name=str(item.get("name") or logical_id).strip(),
                    lang=str(item.get("lang") or "zh-CN").strip(),
                    role=str(item.get("role") or item.get("name") or logical_id).strip(),
                    quality=str(item.get("quality") or "高清拟真").strip(),
                    latency=str(item.get("latency") or "云端").strip(),
                    networkRequired=True,
                    isDefault=bool(item.get("is_default", item.get("isDefault", index == 0))),
                    available=service_available,
                ),
                speaker_id=speaker_id,
                resource_id=str(
                    item.get("resource_id")
                    or item.get("resourceId")
                    or settings.tts_resource_id
                ).strip(),
            )
        )
    return voices


def get_voice(settings: Settings, voice_id: str) -> VoiceConfig:
    voice = next((item for item in configured_voices(settings) if item.descriptor.id == voice_id), None)
    if not voice:
        raise TtsServiceError("Voice is not allowed", status_code=400, error_code="invalid_voice")
    return voice


def cache_key_for(text: str, voice: VoiceConfig, rate: float, settings: Settings) -> str:
    canonical = json.dumps(
        {
            "text": text,
            "speaker": voice.speaker_id,
            "voice_id": voice.descriptor.id,
            "resource_id": voice.resource_id,
            "rate": round(rate, 2),
            "model": settings.tts_model,
            "format": "mp3",
            "sample_rate": 24000,
        },
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def cache_path(settings: Settings, cache_key: str) -> Path:
    if not CACHE_KEY_PATTERN.fullmatch(cache_key):
        raise TtsServiceError("Invalid audio cache key", status_code=404, error_code="invalid_cache_key")
    return Path(settings.tts_cache_dir).expanduser().resolve() / f"{cache_key}.mp3"


def cached_audio_path(settings: Settings, cache_key: str) -> Path | None:
    path = cache_path(settings, cache_key)
    if not path.is_file():
        return None
    age = max(0, time.time() - path.stat().st_mtime)
    if age > settings.tts_cache_ttl_seconds:
        path.unlink(missing_ok=True)
        return None
    return path


def _prune_cache(settings: Settings, incoming_bytes: int = 0) -> None:
    directory = Path(settings.tts_cache_dir).expanduser().resolve()
    if not directory.exists():
        return
    now = time.time()
    files: list[tuple[Path, int, float]] = []
    for path in directory.glob("*.mp3"):
        try:
            stat = path.stat()
        except OSError:
            continue
        if now - stat.st_mtime > settings.tts_cache_ttl_seconds:
            path.unlink(missing_ok=True)
        else:
            files.append((path, stat.st_size, stat.st_mtime))
    total = sum(size for _, size, _ in files)
    for path, size, _ in sorted(files, key=lambda item: item[2]):
        if total + incoming_bytes <= settings.tts_cache_max_bytes:
            break
        path.unlink(missing_ok=True)
        total -= size


def write_cached_audio(settings: Settings, cache_key: str, audio: bytes) -> Path:
    if not audio:
        raise TtsServiceError("TTS provider returned empty audio", status_code=502, error_code="empty_audio")
    if len(audio) > settings.tts_cache_max_bytes:
        raise TtsServiceError("TTS audio exceeds cache capacity", status_code=502, error_code="audio_too_large")
    path = cache_path(settings, cache_key)
    path.parent.mkdir(parents=True, exist_ok=True)
    _prune_cache(settings, len(audio))
    temporary = path.with_suffix(f".{uuid4().hex}.tmp")
    temporary.write_bytes(audio)
    temporary.replace(path)
    return path


def make_audio_ticket(settings: Settings, *, user_id: int, cache_key: str) -> tuple[str, int]:
    expires_at = int(time.time()) + settings.tts_ticket_expire_seconds
    payload = f"{user_id}:{cache_key}:{expires_at}"
    signature = hmac.new(
        settings.jwt_secret_key.encode("utf-8"),
        payload.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return f"{user_id}.{expires_at}.{signature}", expires_at


def validate_audio_ticket(settings: Settings, *, cache_key: str, ticket: str) -> int:
    try:
        raw_user_id, raw_expiry, signature = ticket.split(".", 2)
        user_id = int(raw_user_id)
        expires_at = int(raw_expiry)
    except (TypeError, ValueError):
        raise TtsServiceError("Invalid audio ticket", status_code=403, error_code="invalid_ticket")
    if expires_at < int(time.time()):
        raise TtsServiceError("Audio ticket has expired", status_code=403, error_code="expired_ticket")
    expected, _ = make_audio_ticket_for_expiry(
        settings,
        user_id=user_id,
        cache_key=cache_key,
        expires_at=expires_at,
    )
    if not hmac.compare_digest(expected, signature):
        raise TtsServiceError("Invalid audio ticket", status_code=403, error_code="invalid_ticket")
    return user_id


def make_audio_ticket_for_expiry(
    settings: Settings,
    *,
    user_id: int,
    cache_key: str,
    expires_at: int,
) -> tuple[str, int]:
    payload = f"{user_id}:{cache_key}:{expires_at}"
    signature = hmac.new(
        settings.jwt_secret_key.encode("utf-8"),
        payload.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return signature, expires_at


async def get_http_client(settings: Settings) -> httpx.AsyncClient:
    global _http_client
    async with _client_lock:
        if _http_client is None or _http_client.is_closed:
            _http_client = httpx.AsyncClient(timeout=settings.tts_timeout_seconds)
        return _http_client


async def close_tts_http_client() -> None:
    global _http_client
    if _http_client is not None and not _http_client.is_closed:
        await _http_client.aclose()
    _http_client = None


def _streamed_json_payloads(content: bytes) -> list[dict[str, Any]]:
    try:
        text = content.decode("utf-8")
    except UnicodeDecodeError:
        return []
    decoder = json.JSONDecoder()
    payloads: list[dict[str, Any]] = []
    index = 0
    while index < len(text):
        while index < len(text) and text[index].isspace():
            index += 1
        if text.startswith("data:", index):
            index += 5
            while index < len(text) and text[index].isspace():
                index += 1
        if index >= len(text):
            break
        try:
            payload, end = decoder.raw_decode(text, index)
        except json.JSONDecodeError:
            next_object = text.find("{", index + 1)
            if next_object < 0:
                break
            index = next_object
            continue
        if isinstance(payload, dict):
            payloads.append(payload)
        index = end
    return payloads


def _decode_streamed_audio(content: bytes, content_type: str) -> bytes:
    if content_type.lower().startswith("audio/"):
        return content
    audio_parts: list[bytes] = []
    provider_error = ""
    for payload in _streamed_json_payloads(content):
        code = payload.get("code")
        if code not in (None, 0, 20000000):
            provider_error = str(payload.get("message") or f"provider code {code}")
            continue
        encoded = payload.get("data")
        if isinstance(encoded, dict):
            encoded = encoded.get("audio") or encoded.get("data")
        if not isinstance(encoded, str) or not encoded:
            continue
        try:
            audio_parts.append(base64.b64decode(encoded, validate=True))
        except (binascii.Error, ValueError):
            provider_error = "provider returned invalid base64 audio"
    if audio_parts:
        return b"".join(audio_parts)
    raise TtsServiceError(
        provider_error or "TTS provider returned no audio",
        status_code=502,
        error_code="invalid_provider_response",
    )


async def request_volcengine_audio(
    settings: Settings,
    *,
    text: str,
    voice: VoiceConfig,
    rate: float,
    request_id: str,
) -> bytes:
    client = await get_http_client(settings)
    headers = {
        "Content-Type": "application/json",
        "X-Api-App-Id": settings.tts_app_id,
        "X-Api-Access-Key": settings.tts_access_token,
        "X-Api-Resource-Id": voice.resource_id,
        "X-Api-Request-Id": request_id,
    }
    payload = {
        "user": {"uid": "novel-reader"},
        "req_params": {
            "text": text,
            "speaker": voice.speaker_id,
            "audio_params": {
                "format": "mp3",
                "sample_rate": 24000,
            },
            "speed_ratio": rate,
        },
    }
    attempts = settings.tts_retry_count + 1
    for attempt in range(attempts):
        try:
            async with client.stream("POST", settings.tts_base_url, headers=headers, json=payload) as response:
                content = await response.aread()
                if response.status_code == 429:
                    raise TtsServiceError("TTS provider rate limit exceeded", status_code=429, error_code="provider_limit")
                if response.status_code >= 500 and attempt + 1 < attempts:
                    continue
                if response.status_code >= 400:
                    raise TtsServiceError("TTS provider rejected the request", status_code=502, error_code="provider_error")
                return _decode_streamed_audio(content, response.headers.get("content-type", ""))
        except (httpx.TimeoutException, httpx.NetworkError) as exc:
            if attempt + 1 < attempts:
                continue
            if isinstance(exc, httpx.TimeoutException):
                raise TtsServiceError("TTS provider request timed out", status_code=504, error_code="timeout") from exc
            raise TtsServiceError("TTS provider is unavailable", status_code=502, error_code="network_error") from exc
    raise TtsServiceError("TTS provider is unavailable", status_code=502, error_code="provider_error")


def _get_concurrency_gate(settings: Settings) -> threading.BoundedSemaphore:
    global _concurrency_gate, _concurrency_limit
    with _concurrency_lock:
        if _concurrency_gate is None or _concurrency_limit != settings.tts_max_concurrency:
            _concurrency_limit = settings.tts_max_concurrency
            _concurrency_gate = threading.BoundedSemaphore(settings.tts_max_concurrency)
        return _concurrency_gate


async def acquire_concurrency_gate(
    gate: threading.BoundedSemaphore,
    *,
    timeout_seconds: float,
) -> bool:
    deadline = time.monotonic() + timeout_seconds
    while True:
        if gate.acquire(blocking=False):
            return True
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            return False
        await asyncio.sleep(min(0.02, remaining))


def _today_start() -> datetime:
    now = datetime.now(UTC)
    return now.replace(hour=0, minute=0, second=0, microsecond=0)


def reserve_quota(db: Session, settings: Settings, *, user_id: int, character_count: int) -> None:
    with _quota_lock:
        used = (
            db.query(func.coalesce(func.sum(TtsCallLog.character_count), 0))
            .filter(
                TtsCallLog.user_id == user_id,
                TtsCallLog.cache_hit.is_(False),
                TtsCallLog.status == "success",
                TtsCallLog.created_at >= _today_start(),
            )
            .scalar()
            or 0
        )
        reserved = _quota_reservations.get(user_id, 0)
        if used + reserved + character_count > settings.tts_daily_uncached_characters:
            raise TtsServiceError("Daily TTS character quota exceeded", status_code=429, error_code="quota_exceeded")
        _quota_reservations[user_id] = reserved + character_count


def release_quota(*, user_id: int, character_count: int) -> None:
    with _quota_lock:
        remaining = max(0, _quota_reservations.get(user_id, 0) - character_count)
        if remaining:
            _quota_reservations[user_id] = remaining
        else:
            _quota_reservations.pop(user_id, None)


def add_call_log(
    db: Session,
    *,
    user_id: int,
    voice_id: str,
    resource_id: str,
    settings: Settings,
    character_count: int,
    cache_hit: bool,
    status: str,
    duration_ms: int,
    error_code: str = "",
) -> None:
    db.add(
        TtsCallLog(
            user_id=user_id,
            voice_id=voice_id,
            provider="volcengine",
            model=resource_id,
            character_count=character_count,
            cache_hit=cache_hit,
            status=status,
            error_code=error_code,
            duration_ms=duration_ms,
        )
    )
    db.commit()


async def synthesize(
    db: Session,
    settings: Settings,
    *,
    user_id: int,
    text: str,
    voice_id: str,
    rate: float,
) -> SynthesisResult:
    if not cloud_tts_available(settings):
        raise TtsServiceError("Cloud TTS is not configured", status_code=503, error_code="not_configured")
    voice = get_voice(settings, voice_id)
    request_id = uuid4().hex
    cache_key = cache_key_for(text, voice, rate, settings)
    started_at = time.perf_counter()
    if cached_audio_path(settings, cache_key):
        duration_ms = max(0, int((time.perf_counter() - started_at) * 1000))
        add_call_log(
            db,
            user_id=user_id,
            voice_id=voice_id,
            resource_id=voice.resource_id,
            settings=settings,
            character_count=len(text),
            cache_hit=True,
            status="success",
            duration_ms=duration_ms,
        )
        return SynthesisResult(cache_key, True, duration_ms, request_id, voice.descriptor)

    character_count = len(text)
    reserved = False
    gate: threading.BoundedSemaphore | None = None
    acquired = False
    try:
        reserve_quota(db, settings, user_id=user_id, character_count=character_count)
        reserved = True
        gate = _get_concurrency_gate(settings)
        acquired = await acquire_concurrency_gate(
            gate,
            timeout_seconds=settings.tts_concurrency_wait_seconds,
        )
        if not acquired:
            raise TtsServiceError("TTS service is busy", status_code=429, error_code="concurrency_limit")
        audio = await request_volcengine_audio(
            settings,
            text=text,
            voice=voice,
            rate=rate,
            request_id=request_id,
        )
        write_cached_audio(settings, cache_key, audio)
        duration_ms = max(0, int((time.perf_counter() - started_at) * 1000))
        add_call_log(
            db,
            user_id=user_id,
            voice_id=voice_id,
            resource_id=voice.resource_id,
            settings=settings,
            character_count=character_count,
            cache_hit=False,
            status="success",
            duration_ms=duration_ms,
        )
        return SynthesisResult(cache_key, False, duration_ms, request_id, voice.descriptor)
    except TtsServiceError as exc:
        duration_ms = max(0, int((time.perf_counter() - started_at) * 1000))
        add_call_log(
            db,
            user_id=user_id,
            voice_id=voice_id,
            resource_id=voice.resource_id,
            settings=settings,
            character_count=character_count,
            cache_hit=False,
            status="failed",
            duration_ms=duration_ms,
            error_code=exc.error_code,
        )
        raise
    finally:
        if acquired and gate is not None:
            gate.release()
        if reserved:
            release_quota(user_id=user_id, character_count=character_count)
