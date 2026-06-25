from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.auth import get_current_user
from app.db.session import get_db
from app.models.models import Book, Chapter, ReadingHistory, User
from app.schemas.library import (
    BookCreate,
    BookRead,
    ChapterContentUpdate,
    ChapterCreate,
    ChapterRead,
    ReadingHistoryRead,
    ReadingHistoryUpsert,
)


router = APIRouter(tags=["library"])


def get_owned_book(book_id: int, user_id: int, db: Session) -> Book:
    book = db.query(Book).filter(Book.id == book_id, Book.user_id == user_id).first()
    if not book:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")
    return book


def get_owned_chapter(chapter_id: int, user_id: int, db: Session) -> Chapter:
    chapter = (
        db.query(Chapter)
        .join(Book, Chapter.book_id == Book.id)
        .filter(Chapter.id == chapter_id, Book.user_id == user_id)
        .first()
    )
    if not chapter:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chapter not found")
    return chapter


@router.get("/api/books", response_model=list[BookRead])
def list_books(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[Book]:
    return (
        db.query(Book)
        .filter(Book.user_id == current_user.id)
        .order_by(Book.updated_at.desc(), Book.id.desc())
        .all()
    )


@router.post("/api/books", response_model=BookRead, status_code=status.HTTP_201_CREATED)
def create_book(
    payload: BookCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Book:
    book_url = payload.book_url.strip()
    book = None
    if book_url:
        book = db.query(Book).filter(Book.user_id == current_user.id, Book.book_url == book_url).first()
    if not book:
        book = Book(user_id=current_user.id)
        db.add(book)
    book.source_id = payload.source_id
    book.title = payload.title.strip()
    book.author = payload.author.strip() or "未知作者"
    book.cover_url = payload.cover_url.strip()
    book.description = payload.description.strip()
    book.book_url = book_url
    book.toc_url = payload.toc_url.strip()
    db.commit()
    db.refresh(book)
    return book


@router.get("/api/books/{book_id}", response_model=BookRead)
def get_book(
    book_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Book:
    return get_owned_book(book_id, current_user.id, db)


@router.get("/api/books/{book_id}/chapters", response_model=list[ChapterRead])
def list_chapters(
    book_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[Chapter]:
    get_owned_book(book_id, current_user.id, db)
    return (
        db.query(Chapter)
        .filter(Chapter.book_id == book_id)
        .order_by(Chapter.chapter_index.asc(), Chapter.id.asc())
        .all()
    )


@router.post("/api/books/{book_id}/chapters", response_model=ChapterRead, status_code=status.HTTP_201_CREATED)
def create_chapter(
    book_id: int,
    payload: ChapterCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Chapter:
    get_owned_book(book_id, current_user.id, db)
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
    db.commit()
    db.refresh(chapter)
    return chapter


@router.get("/api/chapters/{chapter_id}", response_model=ChapterRead)
def get_chapter(
    chapter_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Chapter:
    return get_owned_chapter(chapter_id, current_user.id, db)


@router.patch("/api/chapters/{chapter_id}/content", response_model=ChapterRead)
def update_chapter_content(
    chapter_id: int,
    payload: ChapterContentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Chapter:
    chapter = get_owned_chapter(chapter_id, current_user.id, db)
    chapter.content = payload.content
    chapter.is_cached = True
    db.commit()
    db.refresh(chapter)
    return chapter


@router.post("/api/reading-history", response_model=ReadingHistoryRead)
def save_reading_history(
    payload: ReadingHistoryUpsert,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ReadingHistory:
    get_owned_book(payload.book_id, current_user.id, db)
    if payload.chapter_id is not None:
        chapter = get_owned_chapter(payload.chapter_id, current_user.id, db)
        if chapter.book_id != payload.book_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Chapter does not belong to book")

    history = (
        db.query(ReadingHistory)
        .filter(
            ReadingHistory.user_id == current_user.id,
            ReadingHistory.book_id == payload.book_id,
        )
        .first()
    )
    if not history:
        history = ReadingHistory(user_id=current_user.id, book_id=payload.book_id)
        db.add(history)

    history.chapter_id = payload.chapter_id
    history.chapter_index = payload.chapter_index
    history.page_index = payload.page_index
    history.progress_percent = payload.progress_percent
    db.commit()
    db.refresh(history)
    return history


@router.get("/api/reading-history", response_model=ReadingHistoryRead)
def get_reading_history(
    book_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ReadingHistory:
    get_owned_book(book_id, current_user.id, db)
    history = (
        db.query(ReadingHistory)
        .filter(ReadingHistory.user_id == current_user.id, ReadingHistory.book_id == book_id)
        .first()
    )
    if not history:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reading history not found")
    return history
