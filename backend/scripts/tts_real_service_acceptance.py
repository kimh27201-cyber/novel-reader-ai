"""Probe real Volcengine V3 voices and create redacted acceptance artifacts.

This script intentionally calls the provider directly so a bad candidate voice
can be rejected before it is exposed by the application API. Credentials are
loaded from ``backend/.env`` through ``Settings`` and are never written to the
report.
"""

from __future__ import annotations

import asyncio
import base64
import binascii
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
import json
import os
from pathlib import Path
import sys
import time
from typing import Any
from uuid import uuid4

import httpx


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.core.config import Settings  # noqa: E402


ROLE_ORDER = ("loli", "uncle", "youth", "shota", "recital")
ROLE_LABELS = {
    "loli": "萝莉",
    "uncle": "大叔",
    "youth": "青年",
    "shota": "正太",
    "recital": "朗诵",
}
DEFAULT_VOICES = [
    {
        "id": "loli",
        "name": "可爱女生",
        "speaker_id": "ICL_zh_female_keainvsheng_tob",
        "resource_id": "seed-icl-2.0",
    },
    {
        "id": "uncle",
        "name": "胡子叔叔",
        "speaker_id": "ICL_zh_male_huzi_v1_tob",
        "resource_id": "seed-icl-1.0",
    },
    {
        "id": "youth",
        "name": "反卷青年",
        "speaker_id": "zh_male_fanjuanqingnian_mars_bigtts",
        "resource_id": "seed-tts-1.0",
    },
    {
        "id": "shota",
        "name": "奶气小生",
        "speaker_id": "ICL_zh_male_xiaonaigou_edf58cf28b8b_tob",
        "resource_id": "seed-icl-1.0",
    },
    {
        "id": "recital",
        "name": "内敛才俊",
        "speaker_id": "ICL_zh_male_neiliancaijun_e991be511569_tob",
        "resource_id": "seed-icl-1.0",
    },
]
DEFAULT_SAMPLE_TEXTS = {
    "loli": "雨后的窗台落着一颗亮晶晶的水珠，像藏着一个轻轻发光的小世界。",
    "uncle": "夜色沉下来，旧钟楼的回声越过长街，旅人也终于看见了归途的灯火。",
    "youth": "风从山谷穿过，我们沿着清晨的石阶向上，去迎接今天第一束阳光。",
    "shota": "小纸船顺着溪流转过弯角，我追着它跑，笑声惊醒了树梢上的鸟儿。",
    "recital": "岁月写在河流与群山之间，读书让我们听见远方，也重新认识自己的内心。",
}
MAX_PROVIDER_TEXT_BUDGET = min(
    2000,
    max(1, int(os.getenv("TTS_PROBE_MAX_CHARACTERS", "2000"))),
)
OUTPUT_DIR = Path(
    os.getenv("TTS_ACCEPTANCE_OUTPUT_DIR", str(BACKEND_DIR / "data" / "tts-acceptance"))
).resolve()


@dataclass(frozen=True)
class Candidate:
    speaker_id: str
    resource_id: str
    name: str


@dataclass
class ProbeAttempt:
    candidate_name: str
    speaker_id: str
    resource_id: str
    status: str
    error_code: str
    http_status: int | None
    provider_code: str
    duration_ms: int
    audio_bytes: int
    sample_rate_hz: int | None
    content_type: str
    request_id: str
    provider_log_id: str
    output_file: str


def _safe_json(raw: str, *, variable_name: str) -> Any:
    if not raw.strip():
        return {}
    try:
        return json.loads(raw)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"{variable_name} must be valid JSON") from exc


def _safe_json_object(raw: str, *, variable_name: str) -> dict[str, Any]:
    value = _safe_json(raw, variable_name=variable_name)
    if not isinstance(value, dict):
        raise RuntimeError(f"{variable_name} must be a JSON object")
    return value


def _candidate_from_value(value: Any, *, fallback_name: str, fallback_resource: str) -> Candidate | None:
    if isinstance(value, str):
        speaker_id = value.strip()
        return Candidate(speaker_id, fallback_resource, fallback_name) if speaker_id else None
    if not isinstance(value, dict):
        return None
    speaker_id = str(value.get("speaker_id") or value.get("speakerId") or "").strip()
    if not speaker_id:
        return None
    resource_id = str(
        value.get("resource_id") or value.get("resourceId") or fallback_resource
    ).strip()
    name = str(value.get("name") or fallback_name).strip()
    return Candidate(speaker_id, resource_id, name)


def load_candidates(settings: Settings) -> dict[str, list[Candidate]]:
    defaults = {str(item["id"]): item for item in DEFAULT_VOICES}
    configured = _safe_json(settings.tts_voices_json, variable_name="TTS_VOICES_JSON")
    if not isinstance(configured, (dict, list)):
        raise RuntimeError("TTS_VOICES_JSON must be a JSON object or array")
    probe_overrides = _safe_json_object(
        os.getenv("TTS_PROBE_CANDIDATES_JSON", ""),
        variable_name="TTS_PROBE_CANDIDATES_JSON",
    )
    result: dict[str, list[Candidate]] = {}
    for role_id in ROLE_ORDER:
        default = defaults[role_id]
        fallback_name = str(default.get("name") or ROLE_LABELS[role_id])
        fallback_resource = str(default.get("resource_id") or settings.tts_resource_id)
        values: list[Any] = []
        override = probe_overrides.get(role_id)
        if isinstance(override, list):
            values.extend(override)
        elif override is not None:
            values.append(override)
        if isinstance(configured, dict):
            configured_value = configured.get(role_id)
            if isinstance(configured_value, list):
                values.extend(configured_value)
            elif configured_value is not None:
                values.append(configured_value)
        else:
            values.extend(
                item
                for item in configured
                if isinstance(item, dict) and str(item.get("id") or "").strip() == role_id
            )
        values.append(default)

        candidates: list[Candidate] = []
        seen: set[tuple[str, str]] = set()
        for value in values:
            candidate = _candidate_from_value(
                value,
                fallback_name=fallback_name,
                fallback_resource=fallback_resource,
            )
            if candidate is None:
                continue
            key = (candidate.speaker_id, candidate.resource_id)
            if key not in seen:
                candidates.append(candidate)
                seen.add(key)
        result[role_id] = candidates
    return result


def _provider_error_code(http_status: int, provider_code: str) -> str:
    if http_status == 400:
        return "invalid_voice_or_request"
    if http_status == 401:
        return "provider_authentication_failed"
    if http_status == 403:
        return "voice_not_authorized_or_forbidden"
    if http_status == 402:
        return "account_payment_required"
    if http_status == 429:
        return "provider_quota_or_rate_limit"
    if http_status >= 500:
        return "provider_unavailable"
    code = provider_code.lower()
    if any(word in code for word in ("quota", "limit", "frequency")):
        return "provider_quota_or_rate_limit"
    if any(word in code for word in ("auth", "token", "permission", "resource")):
        return "provider_authentication_or_voice_permission"
    return "provider_rejected_request" if provider_code else "invalid_provider_response"


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


def _decode_audio(content: bytes, content_type: str) -> tuple[bytes, str]:
    if content_type.lower().startswith("audio/"):
        return content, ""
    parts: list[bytes] = []
    provider_code = ""
    for payload in _streamed_json_payloads(content):
        raw_code = payload.get("code")
        if raw_code not in (None, 0, 20000000):
            provider_code = str(raw_code)
            continue
        encoded = payload.get("data")
        if isinstance(encoded, dict):
            encoded = encoded.get("audio") or encoded.get("data")
        if not isinstance(encoded, str) or not encoded:
            continue
        try:
            parts.append(base64.b64decode(encoded, validate=True))
        except (binascii.Error, ValueError):
            provider_code = provider_code or "invalid_base64"
    return b"".join(parts), provider_code


def _mp3_sample_rate(audio: bytes) -> int | None:
    offset = 0
    if audio.startswith(b"ID3") and len(audio) >= 10:
        size = (
            ((audio[6] & 0x7F) << 21)
            | ((audio[7] & 0x7F) << 14)
            | ((audio[8] & 0x7F) << 7)
            | (audio[9] & 0x7F)
        )
        offset = min(len(audio), 10 + size)
    for index in range(offset, max(offset, len(audio) - 3)):
        first, second, third = audio[index : index + 3]
        if first != 0xFF or second & 0xE0 != 0xE0:
            continue
        version = (second >> 3) & 0x03
        sample_index = (third >> 2) & 0x03
        if version == 1 or sample_index == 3:
            continue
        table = {
            3: (44100, 48000, 32000),
            2: (22050, 24000, 16000),
            0: (11025, 12000, 8000),
        }
        return table[version][sample_index]
    return None


async def probe_candidate(
    client: httpx.AsyncClient,
    settings: Settings,
    *,
    role_id: str,
    candidate: Candidate,
    text: str,
) -> ProbeAttempt:
    request_id = uuid4().hex
    started_at = time.perf_counter()
    http_status: int | None = None
    content_type = ""
    provider_log_id = ""
    provider_code = ""
    audio = b""
    error_code = ""
    try:
        response = await client.post(
            settings.tts_base_url,
            headers={
                "Content-Type": "application/json",
                "X-Api-App-Id": settings.tts_app_id,
                "X-Api-Access-Key": settings.tts_access_token,
                "X-Api-Resource-Id": candidate.resource_id,
                "X-Api-Request-Id": request_id,
            },
            json={
                "user": {"uid": "novel-reader-acceptance"},
                "req_params": {
                    "text": text,
                    "speaker": candidate.speaker_id,
                    "audio_params": {"format": "mp3", "sample_rate": 24000},
                    "speed_ratio": 1.0,
                },
            },
        )
        http_status = response.status_code
        content_type = response.headers.get("content-type", "").split(";", 1)[0]
        provider_log_id = (
            response.headers.get("x-tt-logid")
            or response.headers.get("x-tt-log-id")
            or ""
        )
        if response.status_code < 400:
            audio, provider_code = _decode_audio(response.content, content_type)
        else:
            payloads = _streamed_json_payloads(response.content)
            provider_code = str(payloads[-1].get("code") or "") if payloads else ""
            error_code = _provider_error_code(response.status_code, provider_code)
    except httpx.TimeoutException:
        error_code = "provider_timeout"
    except httpx.NetworkError:
        error_code = "provider_network_error"

    sample_rate = _mp3_sample_rate(audio) if audio else None
    if not error_code and (len(audio) < 100 or sample_rate != 24000):
        error_code = "invalid_mp3_or_sample_rate"
    if not error_code and provider_code:
        error_code = _provider_error_code(http_status or 200, provider_code)
    output_file = ""
    if not error_code:
        target = OUTPUT_DIR / f"{role_id}.mp3"
        target.write_bytes(audio)
        output_file = target.name
    return ProbeAttempt(
        candidate_name=candidate.name,
        speaker_id=candidate.speaker_id,
        resource_id=candidate.resource_id,
        status="passed" if not error_code else "failed",
        error_code=error_code,
        http_status=http_status,
        provider_code=provider_code,
        duration_ms=max(0, int((time.perf_counter() - started_at) * 1000)),
        audio_bytes=len(audio),
        sample_rate_hz=sample_rate,
        content_type=content_type,
        request_id=request_id,
        provider_log_id=provider_log_id,
        output_file=output_file,
    )


async def run() -> int:
    settings = Settings(_env_file=BACKEND_DIR / ".env")
    if not settings.tts_enabled:
        raise RuntimeError("TTS_ENABLED must be true in backend/.env")
    if not settings.tts_app_id.strip() or not settings.tts_access_token.strip():
        raise RuntimeError("TTS_APP_ID and TTS_ACCESS_TOKEN must be configured in backend/.env")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    candidates = load_candidates(settings)
    attempts_by_role: dict[str, list[dict[str, Any]]] = {}
    selected: dict[str, dict[str, str]] = {}
    consumed_characters = 0
    async with httpx.AsyncClient(timeout=settings.tts_timeout_seconds) as client:
        for role_id in ROLE_ORDER:
            attempts_by_role[role_id] = []
            text = DEFAULT_SAMPLE_TEXTS[role_id]
            if not text or len(text) > 300 or len(text.encode("utf-8")) > 900:
                raise RuntimeError(f"Probe text for {role_id} violates the synthesis limit")
            for candidate in candidates[role_id]:
                if consumed_characters + len(text) > MAX_PROVIDER_TEXT_BUDGET:
                    attempts_by_role[role_id].append(
                        {
                            "candidate_name": candidate.name,
                            "speaker_id": candidate.speaker_id,
                            "resource_id": candidate.resource_id,
                            "status": "skipped",
                            "error_code": "probe_text_budget_exceeded",
                        }
                    )
                    break
                consumed_characters += len(text)
                attempt = await probe_candidate(
                    client,
                    settings,
                    role_id=role_id,
                    candidate=candidate,
                    text=text,
                )
                attempts_by_role[role_id].append(asdict(attempt))
                if attempt.status == "passed":
                    selected[role_id] = {
                        "name": candidate.name,
                        "role": ROLE_LABELS[role_id],
                        "speaker_id": candidate.speaker_id,
                        "resource_id": candidate.resource_id,
                    }
                    break

    report = {
        "schema_version": 1,
        "generated_at": datetime.now(UTC).isoformat(),
        "provider": "volcengine",
        "endpoint_host": httpx.URL(settings.tts_base_url).host,
        "credentials_present": True,
        "credentials_in_report": False,
        "requested_audio": {"format": "mp3", "sample_rate_hz": 24000},
        "text_budget": {
            "limit_characters": MAX_PROVIDER_TEXT_BUDGET,
            "consumed_characters": consumed_characters,
            "text_stored": False,
        },
        "required_roles": list(ROLE_ORDER),
        "verified_roles": list(selected),
        "all_roles_verified": len(selected) == len(ROLE_ORDER),
        "attempts": attempts_by_role,
        "recommended_tts_voices_json": selected,
    }
    report_path = OUTPUT_DIR / "probe-report.json"
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Redacted report: {report_path}")
    print(f"Verified roles: {len(selected)}/{len(ROLE_ORDER)}")
    print(f"Provider text budget consumed: {consumed_characters}/{MAX_PROVIDER_TEXT_BUDGET}")
    for role_id in ROLE_ORDER:
        status = "PASS" if role_id in selected else "FAIL"
        print(f"[{status}] {ROLE_LABELS[role_id]} ({role_id})")
    return 0 if report["all_roles_verified"] else 2


def main() -> int:
    try:
        return asyncio.run(run())
    except (RuntimeError, ValueError) as exc:
        print(f"Probe cannot start: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
