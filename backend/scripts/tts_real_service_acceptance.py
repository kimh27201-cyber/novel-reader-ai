"""Generate one real Volcengine sample for every configured cloud voice."""

import os
from pathlib import Path
import time
from urllib.parse import urljoin

import httpx


BASE_URL = os.getenv("TTS_ACCEPTANCE_BASE_URL", "http://127.0.0.1:8000").rstrip("/") + "/"
USERNAME = os.getenv("TTS_ACCEPTANCE_USERNAME", "").strip()
PASSWORD = os.getenv("TTS_ACCEPTANCE_PASSWORD", "tts-acceptance-secret-123")
OUTPUT_DIR = Path(os.getenv("TTS_ACCEPTANCE_OUTPUT_DIR", "./data/tts-acceptance")).resolve()
SAMPLE_TEXT = os.getenv(
    "TTS_ACCEPTANCE_TEXT",
    "夜色落在长街上，远处的灯火像星星一样明亮。欢迎试听解码阅读的AI拟真音色。",
).strip()


def require(response: httpx.Response, expected: int = 200) -> dict:
    if response.status_code != expected:
        raise RuntimeError(f"{response.request.method} {response.request.url} -> {response.status_code}: {response.text}")
    return response.json()


def login(client: httpx.Client) -> str:
    username = USERNAME or f"tts_accept_{str(int(time.time() * 1000))[-10:]}"
    if not USERNAME:
        require(
            client.post(
                "api/auth/register",
                json={
                    "username": username,
                    "email": f"{username}@example.com",
                    "password": PASSWORD,
                },
            ),
            201,
        )
    tokens = require(client.post("api/auth/login", json={"username": username, "password": PASSWORD}))
    return str(tokens["access_token"])


def main() -> None:
    if not SAMPLE_TEXT or len(SAMPLE_TEXT) > 300 or len(SAMPLE_TEXT.encode("utf-8")) > 900:
        raise RuntimeError("TTS_ACCEPTANCE_TEXT must contain 1-300 characters and at most 900 UTF-8 bytes")
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    with httpx.Client(base_url=BASE_URL, timeout=60) as client:
        headers = {"Authorization": f"Bearer {login(client)}"}
        voice_response = require(client.get("api/tts/voices", headers=headers))
        if not voice_response["available"]:
            raise RuntimeError("Cloud TTS is disabled or its credentials are not configured")
        voices = [voice for voice in voice_response["voices"] if voice["available"]]
        if not voices:
            raise RuntimeError("No available cloud voices were returned")

        rows = []
        for voice in voices:
            result = require(
                client.post(
                    "api/tts/synthesize",
                    headers=headers,
                    json={"text": SAMPLE_TEXT, "voice_id": voice["id"], "rate": 1.0},
                )
            )
            audio = client.get(urljoin(BASE_URL, result["audio_url"]))
            audio.raise_for_status()
            if len(audio.content) < 100:
                raise RuntimeError(f"Voice {voice['id']} returned an unexpectedly short audio file")
            target = OUTPUT_DIR / f"{voice['id']}.mp3"
            target.write_bytes(audio.content)
            rows.append(
                f"{voice['role']}\t{voice['name']}\t{len(audio.content)} bytes\t"
                f"cache_hit={result['cache_hit']}\t{target}"
            )

    print("Real TTS acceptance samples generated:")
    for row in rows:
        print(row)


if __name__ == "__main__":
    main()
