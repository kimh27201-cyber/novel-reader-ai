import json
import time

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.auth import get_current_user
from app.api.library import get_owned_book, get_owned_chapter
from app.core.config import get_settings
from app.db.session import get_db
from app.models.models import AiCallLog, AiSummary, ChatRecord, User
from app.schemas.ai import AICallLogResponse, AIChatRequest, AIChatResponse, AISummaryRequest, AISummaryResponse
from app.services.ai_client import AIClientError, active_provider, answer_question, model_name, summarize_chapter


router = APIRouter(prefix="/api/ai", tags=["ai"])


def validate_ai_scope(book_id: int | None, chapter_id: int | None, user_id: int, db: Session) -> None:
    book = get_owned_book(book_id, user_id, db) if book_id is not None else None
    chapter = get_owned_chapter(chapter_id, user_id, db) if chapter_id is not None else None
    if book and chapter and chapter.book_id != book.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Chapter does not belong to book")


def parse_json_list(text: str) -> list[str]:
    try:
        value = json.loads(text or "[]")
    except json.JSONDecodeError:
        return []
    return [str(item) for item in value] if isinstance(value, list) else []


def summary_to_response(summary: AiSummary) -> AISummaryResponse:
    return AISummaryResponse(
        id=summary.id,
        book_id=summary.book_id,
        chapter_id=summary.chapter_id,
        summary=summary.summary,
        characters=parse_json_list(summary.characters),
        key_points=parse_json_list(summary.key_points),
        provider=summary.provider,
        created_at=summary.created_at,
    )


def elapsed_ms(started_at: float) -> int:
    return max(0, int((time.perf_counter() - started_at) * 1000))


def add_ai_call_log(
    db: Session,
    *,
    current_user: User,
    call_type: str,
    provider: str,
    model: str,
    status_value: str,
    duration_ms: int,
    book_id: int | None = None,
    chapter_id: int | None = None,
    error_code: str = "",
    error_message: str = "",
) -> AiCallLog:
    call_log = AiCallLog(
        user_id=current_user.id,
        book_id=book_id,
        chapter_id=chapter_id,
        call_type=call_type,
        provider=provider,
        model=model,
        status=status_value,
        error_code=error_code,
        error_message=error_message,
        duration_ms=duration_ms,
    )
    db.add(call_log)
    return call_log


@router.post("/summary", response_model=AISummaryResponse, status_code=status.HTTP_201_CREATED)
async def create_ai_summary(
    payload: AISummaryRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AISummaryResponse:
    validate_ai_scope(payload.book_id, payload.chapter_id, current_user.id, db)
    settings = get_settings()
    provider = active_provider(settings)
    model = model_name(settings)
    started_at = time.perf_counter()
    try:
        result = await summarize_chapter(payload.chapter_text, settings)
    except AIClientError as exc:
        add_ai_call_log(
            db,
            current_user=current_user,
            call_type="summary",
            provider=provider,
            model=model,
            status_value="failed",
            duration_ms=elapsed_ms(started_at),
            book_id=payload.book_id,
            chapter_id=payload.chapter_id,
            error_code=exc.error_code,
            error_message=str(exc),
        )
        db.commit()
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc

    record = AiSummary(
        user_id=current_user.id,
        book_id=payload.book_id,
        chapter_id=payload.chapter_id,
        summary=result["summary"],
        characters=json.dumps(result.get("characters") or [], ensure_ascii=False),
        key_points=json.dumps(result.get("key_points") or [], ensure_ascii=False),
        provider=result["provider"],
    )
    db.add(record)
    add_ai_call_log(
        db,
        current_user=current_user,
        call_type="summary",
        provider=result["provider"],
        model=model,
        status_value="success",
        duration_ms=elapsed_ms(started_at),
        book_id=payload.book_id,
        chapter_id=payload.chapter_id,
    )
    db.commit()
    db.refresh(record)
    return summary_to_response(record)


@router.get("/summaries", response_model=list[AISummaryResponse])
def list_ai_summaries(
    book_id: int | None = None,
    chapter_id: int | None = None,
    limit: int = Query(default=100, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[AISummaryResponse]:
    validate_ai_scope(book_id, chapter_id, current_user.id, db)
    query = db.query(AiSummary).filter(AiSummary.user_id == current_user.id)
    if book_id is not None:
        query = query.filter(AiSummary.book_id == book_id)
    if chapter_id is not None:
        query = query.filter(AiSummary.chapter_id == chapter_id)
    records = query.order_by(AiSummary.created_at.desc(), AiSummary.id.desc()).offset(offset).limit(limit).all()
    return [summary_to_response(record) for record in records]


@router.post("/chat", response_model=AIChatResponse, status_code=status.HTTP_201_CREATED)
async def create_ai_chat(
    payload: AIChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ChatRecord:
    validate_ai_scope(payload.book_id, payload.chapter_id, current_user.id, db)
    settings = get_settings()
    provider = active_provider(settings)
    model = model_name(settings)
    started_at = time.perf_counter()
    try:
        result = await answer_question(payload.question, payload.context, settings)
    except AIClientError as exc:
        add_ai_call_log(
            db,
            current_user=current_user,
            call_type="chat",
            provider=provider,
            model=model,
            status_value="failed",
            duration_ms=elapsed_ms(started_at),
            book_id=payload.book_id,
            chapter_id=payload.chapter_id,
            error_code=exc.error_code,
            error_message=str(exc),
        )
        db.commit()
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc

    record = ChatRecord(
        user_id=current_user.id,
        book_id=payload.book_id,
        chapter_id=payload.chapter_id,
        question=payload.question.strip(),
        answer=result["answer"],
        provider=result["provider"],
    )
    db.add(record)
    add_ai_call_log(
        db,
        current_user=current_user,
        call_type="chat",
        provider=result["provider"],
        model=model,
        status_value="success",
        duration_ms=elapsed_ms(started_at),
        book_id=payload.book_id,
        chapter_id=payload.chapter_id,
    )
    db.commit()
    db.refresh(record)
    return record


@router.get("/chats", response_model=list[AIChatResponse])
def list_ai_chats(
    book_id: int | None = None,
    chapter_id: int | None = None,
    limit: int = Query(default=100, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[ChatRecord]:
    validate_ai_scope(book_id, chapter_id, current_user.id, db)
    query = db.query(ChatRecord).filter(ChatRecord.user_id == current_user.id)
    if book_id is not None:
        query = query.filter(ChatRecord.book_id == book_id)
    if chapter_id is not None:
        query = query.filter(ChatRecord.chapter_id == chapter_id)
    return query.order_by(ChatRecord.created_at.desc(), ChatRecord.id.desc()).offset(offset).limit(limit).all()


@router.get("/calls", response_model=list[AICallLogResponse])
def list_ai_call_logs(
    book_id: int | None = None,
    chapter_id: int | None = None,
    call_type: str | None = None,
    status_value: str | None = None,
    limit: int = Query(default=100, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[AiCallLog]:
    validate_ai_scope(book_id, chapter_id, current_user.id, db)
    query = db.query(AiCallLog).filter(AiCallLog.user_id == current_user.id)
    if book_id is not None:
        query = query.filter(AiCallLog.book_id == book_id)
    if chapter_id is not None:
        query = query.filter(AiCallLog.chapter_id == chapter_id)
    if call_type:
        query = query.filter(AiCallLog.call_type == call_type.strip())
    if status_value:
        query = query.filter(AiCallLog.status == status_value.strip())
    return query.order_by(AiCallLog.created_at.desc(), AiCallLog.id.desc()).offset(offset).limit(limit).all()
