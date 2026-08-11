from pydantic import BaseModel, Field, field_validator


class VoiceDescriptor(BaseModel):
    id: str
    name: str
    lang: str = "zh-CN"
    provider: str = "volcengine"
    role: str
    quality: str = "高清拟真"
    latency: str = "云端"
    networkRequired: bool = True
    isDefault: bool = False
    available: bool = False
    verified: bool = False
    unavailable_reason: str = ""


class TtsVoicesResponse(BaseModel):
    provider: str = "volcengine"
    available: bool
    voices: list[VoiceDescriptor]


class TtsQuotaStatus(BaseModel):
    user_daily_limit: int
    user_daily_used: int
    user_daily_remaining: int
    global_daily_limit: int
    global_daily_used: int
    global_daily_remaining: int
    global_monthly_limit: int
    global_monthly_used: int
    global_monthly_remaining: int


class TtsStatusResponse(BaseModel):
    provider: str = "volcengine"
    enabled: bool
    configured: bool
    last_verified_at: str | None = None
    verified_voice_count: int
    total_voice_count: int
    quota: TtsQuotaStatus


class TtsSynthesizeRequest(BaseModel):
    text: str = Field(min_length=1, max_length=300)
    voice_id: str = Field(min_length=1, max_length=100)
    rate: float = Field(default=1.0, ge=0.8, le=2.0)

    @field_validator("text")
    @classmethod
    def validate_text(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("text cannot be blank")
        if len(normalized.encode("utf-8")) > 900:
            raise ValueError("text must not exceed 900 UTF-8 bytes")
        return normalized


class TtsSynthesizeResponse(BaseModel):
    audio_url: str
    audio_format: str = "mp3"
    duration_ms: int
    provider: str = "volcengine"
    voice: VoiceDescriptor
    cache_hit: bool
    request_id: str
