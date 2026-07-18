from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.models import Book, BookSource, Chapter, ReadingHistory
from app.schemas.library import (
    BookCreate,
    BookUpdate,
    ChapterContentUpdate,
    ChapterCreate,
    ReadingHistoryUpsert,
)
from app.services.sync_service import record_change, serialize_entity


def get_owned_book(db: Session, *, book_id: int, user_id: int) -> Book:
    book = (
        db.query(Book)
        .filter(Book.id == book_id, Book.user_id == user_id, Book.deleted_at.is_(None))
        .first()
    )
    if not book:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")
    return book


def get_owned_chapter(db: Session, *, chapter_id: int, user_id: int) -> Chapter:
    chapter = (
        db.query(Chapter)
        .join(Book, Chapter.book_id == Book.id)
        .filter(Chapter.id == chapter_id, Book.user_id == user_id)
        .first()
    )
    if not chapter:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chapter not found")
    return chapter


def list_books(db: Session, *, user_id: int, limit: int, offset: int) -> list[Book]:
    return (
        db.query(Book)
        .filter(Book.user_id == user_id, Book.deleted_at.is_(None))
        .order_by(Book.updated_at.desc(), Book.id.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )


def _validate_source_ownership(db: Session, *, source_id: int, user_id: int) -> None:
    source = (
        db.query(BookSource)
        .filter(
            BookSource.id == source_id,
            BookSource.user_id == user_id,
            BookSource.deleted_at.is_(None),
        )
        .first()
    )
    if not source:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Source does not belong to user",
        )


def create_book(db: Session, *, user_id: int, payload: BookCreate) -> Book:
    book_url = payload.book_url.strip()
    if payload.source_id is not None:
        _validate_source_ownership(db, source_id=payload.source_id, user_id=user_id)
    book = None
    if book_url:
        source_match = Book.source_id.is_(None)
        if payload.source_id is not None:
            source_match = or_(Book.source_id == payload.source_id, Book.source_id.is_(None))
        book = (
            db.query(Book)
            .filter(
                Book.user_id == user_id,
                Book.book_url == book_url,
                source_match,
                Book.deleted_at.is_(None),
            )
            .first()
        )
    if not book:
        book = Book(user_id=user_id, sync_id=payload.sync_id) if payload.sync_id else Book(user_id=user_id)
        db.add(book)
    elif payload.sync_id and book.sync_id != payload.sync_id:
        book.sync_id = payload.sync_id
    book.source_id = payload.source_id
    book.title = payload.title.strip()
    book.author = payload.author.strip() or "未知作者"
    book.cover_url = payload.cover_url.strip()
    book.description = payload.description.strip()
    book.book_url = book_url
    book.toc_url = payload.toc_url.strip()
    book.version = max(1, book.version or 0) + (1 if book.id else 0)
    try:
        db.flush()
        record_change(
            db,
            user_id=user_id,
            entity_type="book",
            sync_id=book.sync_id,
            operation="upsert",
            version=book.version,
            payload=serialize_entity("book", book, db),
        )
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Book conflicts with existing data") from exc
    db.refresh(book)
    return book


def update_book(db: Session, *, book_id: int, user_id: int, payload: BookUpdate) -> Book:
    book = get_owned_book(db, book_id=book_id, user_id=user_id)
    changes = payload.model_dump(exclude_unset=True)
    if "source_id" in changes and changes["source_id"] is not None:
        _validate_source_ownership(db, source_id=changes["source_id"], user_id=user_id)
    for field, value in changes.items():
        if isinstance(value, str):
            value = value.strip()
        setattr(book, field, value)
    book.version += 1
    try:
        db.flush()
        record_change(
            db,
            user_id=user_id,
            entity_type="book",
            sync_id=book.sync_id,
            operation="upsert",
            version=book.version,
            payload=serialize_entity("book", book, db),
        )
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Book conflicts with existing data") from exc
    db.refresh(book)
    return book


def delete_book(db: Session, *, book_id: int, user_id: int) -> dict[str, bool | int]:
    book = get_owned_book(db, book_id=book_id, user_id=user_id)
    book.deleted_at = datetime.now(UTC)
    book.version += 1
    record_change(
        db,
        user_id=user_id,
        entity_type="book",
        sync_id=book.sync_id,
        operation="delete",
        version=book.version,
        payload={},
    )
    db.commit()
    return {"deleted": True, "id": book_id}


def list_chapters(db: Session, *, book_id: int, user_id: int, limit: int, offset: int) -> list[Chapter]:
    get_owned_book(db, book_id=book_id, user_id=user_id)
    return (
        db.query(Chapter)
        .filter(Chapter.book_id == book_id)
        .order_by(Chapter.chapter_index.asc(), Chapter.id.asc())
        .offset(offset)
        .limit(limit)
        .all()
    )


def create_chapter(db: Session, *, book_id: int, user_id: int, payload: ChapterCreate) -> Chapter:
    get_owned_book(db, book_id=book_id, user_id=user_id)
    chapter = (
        db.query(Chapter)
        .filter(Chapter.book_id == book_id, Chapter.chapter_index == payload.chapter_index)
        .first()
    )
    if not chapter:
        chapter = Chapter(book_id=book_id, chapter_index=payload.chapter_index)
        db.add(chapter)
    chapter.title = payload.title.strip()
    chapter.url = payload.url.strip()
    chapter.content = payload.content
    chapter.is_cached = payload.is_cached
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Chapter conflicts with existing data",
        ) from exc
    db.refresh(chapter)
    return chapter


def update_chapter_content(
    db: Session,
    *,
    chapter_id: int,
    user_id: int,
    payload: ChapterContentUpdate,
) -> Chapter:
    chapter = get_owned_chapter(db, chapter_id=chapter_id, user_id=user_id)
    chapter.content = payload.content
    chapter.is_cached = True
    db.commit()
    db.refresh(chapter)
    return chapter


def save_reading_history(
    db: Session,
    *,
    user_id: int,
    payload: ReadingHistoryUpsert,
) -> ReadingHistory:
    get_owned_book(db, book_id=payload.book_id, user_id=user_id)
    if payload.chapter_id is not None:
        chapter = get_owned_chapter(db, chapter_id=payload.chapter_id, user_id=user_id)
        if chapter.book_id != payload.book_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Chapter does not belong to book",
            )

    history = (
        db.query(ReadingHistory)
        .filter(
            ReadingHistory.user_id == user_id,
            ReadingHistory.book_id == payload.book_id,
        )
        .first()
    )
    if not history:
        history = ReadingHistory(user_id=user_id, book_id=payload.book_id)
        db.add(history)

    history.chapter_id = payload.chapter_id
    history.chapter_index = payload.chapter_index
    history.page_index = payload.page_index
    history.progress_percent = payload.progress_percent
    history.deleted_at = None
    history.version = max(1, history.version or 0) + (1 if history.id else 0)
    try:
        db.flush()
        record_change(
            db,
            user_id=user_id,
            entity_type="reading_history",
            sync_id=history.sync_id,
            operation="upsert",
            version=history.version,
            payload=serialize_entity("reading_history", history, db),
        )
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Reading history conflicts with existing data",
        ) from exc
    db.refresh(history)
    return history


def get_reading_history(db: Session, *, book_id: int, user_id: int) -> ReadingHistory:
    get_owned_book(db, book_id=book_id, user_id=user_id)
    history = (
        db.query(ReadingHistory)
        .filter(
            ReadingHistory.user_id == user_id,
            ReadingHistory.book_id == book_id,
            ReadingHistory.deleted_at.is_(None),
        )
        .first()
    )
    if not history:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reading history not found",
        )
    return history
