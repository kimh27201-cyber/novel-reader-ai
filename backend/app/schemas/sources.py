from datetime import datetime

from pydantic import BaseModel, Field


class SourceImportRequest(BaseModel):
    content: str = Field(min_length=1)


class SourceRead(BaseModel):
    id: int
    name: str
    base_url: str
    group: str
    enabled: bool
    compatibility: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SourceImportResponse(BaseModel):
    imported_count: int
    sources: list[SourceRead]


class SourceSearchRequest(BaseModel):
    keyword: str = Field(min_length=1)
    page: int = Field(default=1, ge=1)


class SourceBookResult(BaseModel):
    title: str
    author: str
    book_url: str
    source_id: int
    source_name: str
    kind: str = ""
    latest_chapter: str = ""
    intro: str = ""
    cover_url: str = ""


class SourceSearchResponse(BaseModel):
    books: list[SourceBookResult]


class SourceBookInfoRequest(BaseModel):
    book_url: str = Field(min_length=1)
    title: str = ""
    author: str = ""
    toc_url: str | None = None
    kind: str = ""
    latest_chapter: str = ""
    intro: str = ""
    cover_url: str = ""


class SourceBookInfoResponse(BaseModel):
    source_id: int
    source_name: str
    title: str
    author: str
    book_url: str
    toc_url: str
    kind: str = ""
    latest_chapter: str = ""
    intro: str = ""
    cover_url: str = ""


class SourceTocRequest(BaseModel):
    book_url: str = Field(min_length=1)
    toc_url: str | None = None


class SourceChapterResult(BaseModel):
    title: str
    url: str
    index: int


class SourceTocResponse(BaseModel):
    chapters: list[SourceChapterResult]


class SourceContentRequest(BaseModel):
    chapter_url: str = Field(min_length=1)


class SourceContentResponse(BaseModel):
    content: str
