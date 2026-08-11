from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.auth import get_current_user
from app.db.session import get_db
from app.models.models import Book, Chapter, ReadingHistory, User
from app.schemas.library import (
    BookCreate,
    BookRead,
    BookUpdate,
    ChapterContentUpdate,
    ChapterCreate,
    ChapterRead,
    OfflineLibrarySnapshot,
    ReadingHistoryRead,
    ReadingHistoryUpsert,
)
from app.services import library_service


router = APIRouter(tags=["library"])


@router.get("/api/library/offline-snapshot", response_model=OfflineLibrarySnapshot)
def get_offline_snapshot(
    book_offset: int = Query(default=0, ge=0),
    book_limit: int = Query(default=20, ge=1, le=50),
    include_cached_content: bool = Query(default=True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    return library_service.build_offline_snapshot(
        db,
        user_id=current_user.id,
        book_offset=book_offset,
        book_limit=book_limit,
        include_cached_content=include_cached_content,
    )


def get_owned_book(book_id: int, user_id: int, db: Session) -> Book:
    """Compatibility wrapper for callers that still import this API helper."""
    return library_service.get_owned_book(db, book_id=book_id, user_id=user_id)


def get_owned_chapter(chapter_id: int, user_id: int, db: Session) -> Chapter:
    """Compatibility wrapper for callers that still import this API helper."""
    return library_service.get_owned_chapter(db, chapter_id=chapter_id, user_id=user_id)


@router.get("/api/books", response_model=list[BookRead])
def list_books(
    limit: int = Query(default=100, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[Book]:
    return library_service.list_books(db, user_id=current_user.id, limit=limit, offset=offset)


@router.post("/api/books", response_model=BookRead, status_code=status.HTTP_201_CREATED)
def create_book(
    payload: BookCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Book:
    return library_service.create_book(db, user_id=current_user.id, payload=payload)


@router.patch("/api/books/{book_id}", response_model=BookRead)
def update_book(
    book_id: int,
    payload: BookUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Book:
    return library_service.update_book(
        db,
        book_id=book_id,
        user_id=current_user.id,
        payload=payload,
    )


@router.delete("/api/books/{book_id}")
def delete_book(
    book_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, bool | int]:
    return library_service.delete_book(db, book_id=book_id, user_id=current_user.id)


@router.get("/api/books/{book_id}", response_model=BookRead)
def get_book(
    book_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Book:
    return library_service.get_owned_book(db, book_id=book_id, user_id=current_user.id)


@router.get("/api/books/{book_id}/chapters", response_model=list[ChapterRead])
def list_chapters(
    book_id: int,
    limit: int = Query(default=100, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[Chapter]:
    return library_service.list_chapters(
        db,
        book_id=book_id,
        user_id=current_user.id,
        limit=limit,
        offset=offset,
    )


@router.post("/api/books/{book_id}/chapters", response_model=ChapterRead, status_code=status.HTTP_201_CREATED)
def create_chapter(
    book_id: int,
    payload: ChapterCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Chapter:
    return library_service.create_chapter(
        db,
        book_id=book_id,
        user_id=current_user.id,
        payload=payload,
    )


@router.get("/api/chapters/{chapter_id}", response_model=ChapterRead)
def get_chapter(
    chapter_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Chapter:
    return library_service.get_owned_chapter(db, chapter_id=chapter_id, user_id=current_user.id)


@router.patch("/api/chapters/{chapter_id}/content", response_model=ChapterRead)
def update_chapter_content(
    chapter_id: int,
    payload: ChapterContentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Chapter:
    return library_service.update_chapter_content(
        db,
        chapter_id=chapter_id,
        user_id=current_user.id,
        payload=payload,
    )


@router.post("/api/reading-history", response_model=ReadingHistoryRead)
def save_reading_history(
    payload: ReadingHistoryUpsert,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ReadingHistory:
    return library_service.save_reading_history(db, user_id=current_user.id, payload=payload)


@router.get("/api/reading-history", response_model=ReadingHistoryRead)
def get_reading_history(
    book_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ReadingHistory:
    return library_service.get_reading_history(db, book_id=book_id, user_id=current_user.id)
