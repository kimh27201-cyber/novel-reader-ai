from typing import Any

from pydantic import BaseModel, Field


class MultiSourceSearchRequest(BaseModel):
    keyword: str = Field(min_length=1, max_length=100)
    page: int = Field(default=1, ge=1)
    source_ids: list[int] | None = Field(default=None, max_length=50)
    force_refresh: bool = False


class SearchAlternative(BaseModel):
    source_id: int
    source_name: str
    book_url: str


class MultiSourceBook(BaseModel):
    title: str
    author: str
    book_url: str
    source_id: int
    source_name: str
    kind: str = ""
    latest_chapter: str = ""
    intro: str = ""
    cover_url: str = ""
    alternatives: list[SearchAlternative] = Field(default_factory=list)


class SourceSearchResult(BaseModel):
    source_id: int
    source_name: str
    status: str
    result_count: int = 0
    duration_ms: int = 0
    error_code: str = ""
    message: str = ""


class MultiSourceSearchResponse(BaseModel):
    books: list[MultiSourceBook]
    source_results: list[SourceSearchResult]
    duration_ms: int


class SourceDiagnosticRequest(BaseModel):
    keyword: str = Field(default="测试", min_length=1, max_length=100)
    force_refresh: bool = True


class DiagnosticStage(BaseModel):
    stage: str
    status: str
    duration_ms: int
    message: str = ""


class SourceDiagnosticResponse(BaseModel):
    source_id: int
    source_name: str
    status: str
    failed_stage: str = ""
    latency_ms: int
    error_code: str = ""
    error_message: str = ""
    stages: list[DiagnosticStage]


class BatchDiagnosticRequest(SourceDiagnosticRequest):
    source_ids: list[int] | None = Field(default=None, max_length=50)


class BatchDiagnosticResponse(BaseModel):
    diagnostics: list[SourceDiagnosticResponse]
