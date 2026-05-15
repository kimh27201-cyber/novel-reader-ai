import json

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.auth import get_current_user
from app.api.library import get_owned_book, get_owned_chapter
from app.core.config import get_settings
from app.db.session import get_db
from app.models.models import AiSummary, ChatRecord, User
from app.schemas.ai import AIChatRequest, AIChatResponse, AISummaryRequest, AISummaryResponse
from app.services.ai_client import AIClientError, answer_question, summarize_chapter


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


@router.post("/summary", response_model=AISummaryResponse, status_code=status.HTTP_201_CREATED)
async def create_ai_summary(
    payload: AISummaryRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AISummaryResponse:
    validate_ai_scope(payload.book_id, payload.chapter_id, current_user.id, db)
    settings = get_settings()
    try:
        result = await summarize_chapter(payload.chapter_text, settings)
    except AIClientError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

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
    db.commit()
    db.refresh(record)
    return summary_to_response(record)


@router.get("/summaries", response_model=list[AISummaryResponse])
def list_ai_summaries(
    book_id: int | None = None,
    chapter_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[AISummaryResponse]:
    validate_ai_scope(book_id, chapter_id, current_user.id, db)
    query = db.query(AiSummary).filter(AiSummary.user_id == current_user.id)
    if book_id is not None:
        query = query.filter(AiSummary.book_id == book_id)
    if chapter_id is not None:
        query = query.filter(AiSummary.chapter_id == chapter_id)
    records = query.order_by(AiSummary.created_at.desc(), AiSummary.id.desc()).all()
    return [summary_to_response(record) for record in records]


@router.post("/chat", response_model=AIChatResponse, status_code=status.HTTP_201_CREATED)
async def create_ai_chat(
    payload: AIChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ChatRecord:
    validate_ai_scope(payload.book_id, payload.chapter_id, current_user.id, db)
    settings = get_settings()
    try:
        result = await answer_question(payload.question, payload.context, settings)
    except AIClientError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

    record = ChatRecord(
        user_id=current_user.id,
        book_id=payload.book_id,
        chapter_id=payload.chapter_id,
        question=payload.question.strip(),
        answer=result["answer"],
        provider=result["provider"],
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.get("/chats", response_model=list[AIChatResponse])
def list_ai_chats(
    book_id: int | None = None,
    chapter_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[ChatRecord]:
    validate_ai_scope(book_id, chapter_id, current_user.id, db)
    query = db.query(ChatRecord).filter(ChatRecord.user_id == current_user.id)
    if book_id is not None:
        query = query.filter(ChatRecord.book_id == book_id)
    if chapter_id is not None:
        query = query.filter(ChatRecord.chapter_id == chapter_id)
    return query.order_by(ChatRecord.created_at.desc(), ChatRecord.id.desc()).all()
