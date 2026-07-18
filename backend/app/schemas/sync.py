from typing import Any, Literal

from pydantic import BaseModel, Field


SyncEntityType = Literal["book", "source", "reading_history"]
SyncOperation = Literal["upsert", "delete"]


class SyncMutationRequest(BaseModel):
    mutation_id: str = Field(min_length=8, max_length=64)
    entity_type: SyncEntityType
    sync_id: str = Field(min_length=8, max_length=32)
    base_version: int = Field(default=0, ge=0)
    operation: SyncOperation
    payload: dict[str, Any] = Field(default_factory=dict)


class SyncPushRequest(BaseModel):
    device_id: str = Field(min_length=1, max_length=100)
    mutations: list[SyncMutationRequest] = Field(max_length=200)


class SyncMutationResult(BaseModel):
    mutation_id: str
    status: Literal["applied", "conflict", "rejected"]
    entity_type: SyncEntityType
    sync_id: str
    version: int = 0
    error_code: str = ""
    message: str = ""
    server_payload: dict[str, Any] | None = None


class SyncPushResponse(BaseModel):
    results: list[SyncMutationResult]
    cursor: int


class SyncChangeRead(BaseModel):
    cursor: int
    entity_type: SyncEntityType
    sync_id: str
    operation: SyncOperation
    version: int
    payload: dict[str, Any]


class SyncPullResponse(BaseModel):
    changes: list[SyncChangeRead]
    next_cursor: int
    has_more: bool
