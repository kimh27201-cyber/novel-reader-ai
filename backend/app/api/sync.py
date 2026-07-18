import json

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.auth import get_current_user
from app.db.session import get_db
from app.models.models import SyncChange, User
from app.schemas.sync import (
    SyncChangeRead,
    SyncPullResponse,
    SyncPushRequest,
    SyncPushResponse,
)
from app.services.sync_service import (
    apply_mutation,
    cleanup_synced_tombstones,
    latest_cursor,
    update_device_cursor,
)


router = APIRouter(prefix="/api/sync", tags=["sync"])


@router.post("/push", response_model=SyncPushResponse)
def push_changes(
    payload: SyncPushRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SyncPushResponse:
    results = []
    for mutation in payload.mutations:
        try:
            result = apply_mutation(db, mutation, current_user.id)
            db.commit()
        except Exception:
            db.rollback()
            result = {
                "mutation_id": mutation.mutation_id,
                "status": "rejected",
                "entity_type": mutation.entity_type,
                "sync_id": mutation.sync_id,
                "version": 0,
                "error_code": "write_failed",
                "message": "Mutation could not be stored",
                "server_payload": None,
            }
        results.append(result)
    cursor = latest_cursor(db, current_user.id)
    update_device_cursor(db, current_user.id, payload.device_id, cursor)
    db.commit()
    return SyncPushResponse(results=results, cursor=cursor)


@router.get("/pull", response_model=SyncPullResponse)
def pull_changes(
    device_id: str = Query(min_length=1, max_length=100),
    cursor: int = Query(default=0, ge=0),
    limit: int = Query(default=200, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SyncPullResponse:
    rows = db.query(SyncChange).filter(
        SyncChange.user_id == current_user.id,
        SyncChange.id > cursor,
    ).order_by(SyncChange.id.asc()).limit(limit + 1).all()
    has_more = len(rows) > limit
    rows = rows[:limit]
    changes = [
        SyncChangeRead(
            cursor=row.id,
            entity_type=row.entity_type,
            sync_id=row.sync_id,
            operation=row.operation,
            version=row.version,
            payload=json.loads(row.payload_json or "{}"),
        )
        for row in rows
    ]
    next_cursor = rows[-1].id if rows else cursor
    update_device_cursor(db, current_user.id, device_id, next_cursor)
    cleanup_synced_tombstones(db, current_user.id)
    db.commit()
    return SyncPullResponse(changes=changes, next_cursor=next_cursor, has_more=has_more)
