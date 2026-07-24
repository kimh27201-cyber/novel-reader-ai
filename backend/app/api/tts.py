from fastapi import APIRouter, Depends, Header, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.api.auth import get_current_user
from app.core.config import get_settings
from app.db.session import get_db
from app.models.models import User
from app.schemas.tts import TtsSynthesizeRequest, TtsSynthesizeResponse, TtsVoicesResponse
from app.services.tts_service import (
    TtsServiceError,
    cached_audio_path,
    cloud_tts_available,
    configured_voices,
    make_audio_ticket,
    synthesize,
    validate_audio_ticket,
)


router = APIRouter(prefix="/api/tts", tags=["tts"])


def raise_http_error(exc: TtsServiceError) -> None:
    raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc


@router.get("/voices", response_model=TtsVoicesResponse)
def list_tts_voices(current_user: User = Depends(get_current_user)) -> TtsVoicesResponse:
    del current_user
    settings = get_settings()
    try:
        voices = [voice.descriptor for voice in configured_voices(settings)]
    except TtsServiceError as exc:
        raise_http_error(exc)
    return TtsVoicesResponse(
        provider="volcengine",
        available=cloud_tts_available(settings) and bool(voices),
        voices=voices,
    )


@router.post("/synthesize", response_model=TtsSynthesizeResponse)
async def synthesize_tts(
    payload: TtsSynthesizeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TtsSynthesizeResponse:
    settings = get_settings()
    try:
        result = await synthesize(
            db,
            settings,
            user_id=current_user.id,
            text=payload.text,
            voice_id=payload.voice_id,
            rate=payload.rate,
        )
        ticket, _ = make_audio_ticket(settings, user_id=current_user.id, cache_key=result.cache_key)
    except TtsServiceError as exc:
        raise_http_error(exc)
    return TtsSynthesizeResponse(
        audio_url=f"/api/tts/audio/{result.cache_key}?ticket={ticket}",
        audio_format="mp3",
        duration_ms=result.duration_ms,
        provider="volcengine",
        voice=result.voice,
        cache_hit=result.cache_hit,
        request_id=result.request_id,
    )


def parse_byte_range(range_header: str | None, size: int) -> tuple[int, int] | None:
    if not range_header:
        return None
    if not range_header.startswith("bytes=") or "," in range_header:
        raise ValueError("Unsupported byte range")
    raw_start, separator, raw_end = range_header[6:].partition("-")
    if not separator:
        raise ValueError("Invalid byte range")
    if not raw_start:
        suffix_length = int(raw_end)
        if suffix_length <= 0:
            raise ValueError("Invalid byte range")
        return max(0, size - suffix_length), size - 1
    start = int(raw_start)
    end = int(raw_end) if raw_end else size - 1
    if start < 0 or start >= size or end < start:
        raise ValueError("Invalid byte range")
    return start, min(end, size - 1)


@router.get("/audio/{cache_key}")
def get_tts_audio(
    cache_key: str,
    ticket: str = Query(min_length=10, max_length=500),
    range_header: str | None = Header(default=None, alias="Range"),
) -> Response:
    settings = get_settings()
    try:
        validate_audio_ticket(settings, cache_key=cache_key, ticket=ticket)
        path = cached_audio_path(settings, cache_key)
    except TtsServiceError as exc:
        raise_http_error(exc)
    if path is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="TTS audio not found or expired")

    audio = path.read_bytes()
    size = len(audio)
    headers = {
        "Accept-Ranges": "bytes",
        "Cache-Control": "private, max-age=300",
        "Content-Disposition": 'inline; filename="speech.mp3"',
    }
    try:
        requested_range = parse_byte_range(range_header, size)
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_416_RANGE_NOT_SATISFIABLE,
            detail="Requested range is not satisfiable",
            headers={"Content-Range": f"bytes */{size}"},
        )
    if requested_range is None:
        headers["Content-Length"] = str(size)
        return Response(content=audio, media_type="audio/mpeg", headers=headers)
    start, end = requested_range
    partial = audio[start : end + 1]
    headers.update(
        {
            "Content-Length": str(len(partial)),
            "Content-Range": f"bytes {start}-{end}/{size}",
        }
    )
    return Response(
        content=partial,
        status_code=status.HTTP_206_PARTIAL_CONTENT,
        media_type="audio/mpeg",
        headers=headers,
    )
