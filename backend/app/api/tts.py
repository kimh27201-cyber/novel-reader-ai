from fastapi import APIRouter, Depends, Header, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.api.auth import get_current_user
from app.core.config import get_settings
from app.db.session import get_db
from app.models.models import User
from app.schemas.tts import (
    TtsQuotaStatus,
    TtsStatusResponse,
    TtsSynthesizeRequest,
    TtsSynthesizeResponse,
    TtsVoicesResponse,
)
from app.services.tts_service import (
    TtsServiceError,
    cached_audio_path,
    cloud_tts_available,
    configured_voices,
    make_audio_ticket,
    quota_usage,
    synthesize,
    validate_audio_ticket,
    verified_voice_times,
)


router = APIRouter(prefix="/api/tts", tags=["tts"])


def raise_http_error(exc: TtsServiceError) -> None:
    raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc


@router.get("/voices", response_model=TtsVoicesResponse)
def list_tts_voices(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TtsVoicesResponse:
    del current_user
    settings = get_settings()
    try:
        voice_configs = configured_voices(settings)
    except TtsServiceError as exc:
        raise_http_error(exc)
    configured = cloud_tts_available(settings)
    verified = verified_voice_times(db, {voice.descriptor.id for voice in voice_configs})
    voices = [
        voice.descriptor.model_copy(
            update={
                "available": configured and voice.descriptor.id in verified,
                "verified": voice.descriptor.id in verified,
                "unavailable_reason": (
                    ""
                    if configured and voice.descriptor.id in verified
                    else "not_configured"
                    if not configured
                    else "not_verified"
                ),
            }
        )
        for voice in voice_configs
    ]
    return TtsVoicesResponse(
        provider="volcengine",
        available=any(voice.available for voice in voices),
        voices=voices,
    )


@router.get("/status", response_model=TtsStatusResponse)
def get_tts_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TtsStatusResponse:
    settings = get_settings()
    try:
        voice_configs = configured_voices(settings)
    except TtsServiceError as exc:
        raise_http_error(exc)
    verified = verified_voice_times(db, {voice.descriptor.id for voice in voice_configs})
    usage = quota_usage(db, user_id=current_user.id)
    last_verified_at = max(verified.values()).isoformat() if verified else None
    return TtsStatusResponse(
        enabled=settings.tts_enabled,
        configured=cloud_tts_available(settings),
        last_verified_at=last_verified_at,
        verified_voice_count=len(verified),
        total_voice_count=len(voice_configs),
        quota=TtsQuotaStatus(
            user_daily_limit=settings.tts_daily_uncached_characters,
            user_daily_used=usage.user_daily_used,
            user_daily_remaining=max(0, settings.tts_daily_uncached_characters - usage.user_daily_used),
            global_daily_limit=settings.tts_global_daily_uncached_characters,
            global_daily_used=usage.global_daily_used,
            global_daily_remaining=max(
                0,
                settings.tts_global_daily_uncached_characters - usage.global_daily_used,
            ),
            global_monthly_limit=settings.tts_global_monthly_uncached_characters,
            global_monthly_used=usage.global_monthly_used,
            global_monthly_remaining=max(
                0,
                settings.tts_global_monthly_uncached_characters - usage.global_monthly_used,
            ),
        ),
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
