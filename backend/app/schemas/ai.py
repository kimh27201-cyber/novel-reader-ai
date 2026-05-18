from datetime import datetime

from pydantic import BaseModel, Field


class AISummaryRequest(BaseModel):
    chapter_text: str = Field(min_length=1)
    book_id: int | None = None
    chapter_id: int | None = None


class AISummaryResponse(BaseModel):
    id: int
    book_id: int | None
    chapter_id: int | None
    summary: str
    characters: list[str]
    key_points: list[str]
    provider: str
    created_at: datetime


class AIChatRequest(BaseModel):
    question: str = Field(min_length=1)
    context: str = Field(default="")
    book_id: int | None = None
    chapter_id: int | None = None


class AIChatResponse(BaseModel):
    id: int
    book_id: int | None
    chapter_id: int | None
    question: str
    answer: str
    provider: str
    created_at: datetime

    model_config = {"from_attributes": True}


class AICallLogResponse(BaseModel):
    id: int
    book_id: int | None
    chapter_id: int | None
    call_type: str
    provider: str
    model: str
    status: str
    error_code: str
    error_message: str
    duration_ms: int
    created_at: datetime

    model_config = {"from_attributes": True}
