from datetime import datetime

from pydantic import BaseModel, Field


class BookCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    author: str = Field(default="未知作者", max_length=255)
    cover_url: str = Field(default="", max_length=1000)
    description: str = ""
    book_url: str = Field(default="", max_length=1000)
    toc_url: str = Field(default="", max_length=1000)
    source_id: int | None = None


class BookRead(BaseModel):
    id: int
    user_id: int
    source_id: int | None
    title: str
    author: str
    cover_url: str
    description: str
    book_url: str
    toc_url: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ChapterCreate(BaseModel):
    chapter_index: int = Field(ge=0)
    title: str = Field(min_length=1, max_length=255)
    url: str = Field(default="", max_length=1000)
    content: str = ""
    is_cached: bool = False


class ChapterRead(BaseModel):
    id: int
    book_id: int
    chapter_index: int
    title: str
    url: str
    content: str
    is_cached: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ReadingHistoryUpsert(BaseModel):
    book_id: int
    chapter_id: int | None = None
    chapter_index: int = Field(default=0, ge=0)
    page_index: int = Field(default=0, ge=0)
    progress_percent: float = Field(default=0, ge=0, le=100)


class ReadingHistoryRead(BaseModel):
    id: int
    user_id: int
    book_id: int
    chapter_id: int | None
    chapter_index: int
    page_index: int
    progress_percent: float
    updated_at: datetime

    model_config = {"from_attributes": True}
