from datetime import UTC, datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


def now_utc() -> datetime:
    return datetime.now(UTC)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)

    books: Mapped[list["Book"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    sources: Mapped[list["BookSource"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    reading_history: Mapped[list["ReadingHistory"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    ai_summaries: Mapped[list["AiSummary"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    chat_records: Mapped[list["ChatRecord"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    ai_call_logs: Mapped[list["AiCallLog"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class Book(Base):
    __tablename__ = "books"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    source_id: Mapped[int | None] = mapped_column(ForeignKey("book_sources.id"), nullable=True, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    author: Mapped[str] = mapped_column(String(255), default="未知作者", nullable=False)
    cover_url: Mapped[str] = mapped_column(String(1000), default="", nullable=False)
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)
    book_url: Mapped[str] = mapped_column(String(1000), default="", nullable=False)
    toc_url: Mapped[str] = mapped_column(String(1000), default="", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc, nullable=False)

    user: Mapped[User] = relationship(back_populates="books")
    source: Mapped["BookSource | None"] = relationship(back_populates="books")
    chapters: Mapped[list["Chapter"]] = relationship(back_populates="book", cascade="all, delete-orphan")
    reading_history: Mapped[list["ReadingHistory"]] = relationship(back_populates="book", cascade="all, delete-orphan")
    ai_summaries: Mapped[list["AiSummary"]] = relationship(back_populates="book", cascade="all, delete-orphan")
    chat_records: Mapped[list["ChatRecord"]] = relationship(back_populates="book", cascade="all, delete-orphan")
    ai_call_logs: Mapped[list["AiCallLog"]] = relationship(back_populates="book", cascade="all, delete-orphan")


class Chapter(Base):
    __tablename__ = "chapters"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    book_id: Mapped[int] = mapped_column(ForeignKey("books.id"), nullable=False, index=True)
    chapter_index: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    url: Mapped[str] = mapped_column(String(1000), default="", nullable=False)
    content: Mapped[str] = mapped_column(Text, default="", nullable=False)
    is_cached: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc, nullable=False)

    book: Mapped[Book] = relationship(back_populates="chapters")
    reading_history: Mapped[list["ReadingHistory"]] = relationship(back_populates="chapter")
    ai_summaries: Mapped[list["AiSummary"]] = relationship(back_populates="chapter")
    chat_records: Mapped[list["ChatRecord"]] = relationship(back_populates="chapter")
    ai_call_logs: Mapped[list["AiCallLog"]] = relationship(back_populates="chapter")


class BookSource(Base):
    __tablename__ = "book_sources"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    base_url: Mapped[str] = mapped_column(String(1000), default="", nullable=False)
    group: Mapped[str] = mapped_column(String(100), default="用户导入", nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    raw_json: Mapped[str] = mapped_column(Text, nullable=False)
    compatibility: Mapped[str] = mapped_column(String(255), default="未测试", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc, nullable=False)

    user: Mapped[User] = relationship(back_populates="sources")
    books: Mapped[list[Book]] = relationship(back_populates="source")


class ReadingHistory(Base):
    __tablename__ = "reading_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    book_id: Mapped[int] = mapped_column(ForeignKey("books.id"), nullable=False, index=True)
    chapter_id: Mapped[int | None] = mapped_column(ForeignKey("chapters.id"), nullable=True, index=True)
    chapter_index: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    page_index: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    progress_percent: Mapped[float] = mapped_column(Float, default=0, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc, nullable=False)

    user: Mapped[User] = relationship(back_populates="reading_history")
    book: Mapped[Book] = relationship(back_populates="reading_history")
    chapter: Mapped[Chapter | None] = relationship(back_populates="reading_history")


class AiSummary(Base):
    __tablename__ = "ai_summaries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    book_id: Mapped[int | None] = mapped_column(ForeignKey("books.id"), nullable=True, index=True)
    chapter_id: Mapped[int | None] = mapped_column(ForeignKey("chapters.id"), nullable=True, index=True)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    characters: Mapped[str] = mapped_column(Text, default="", nullable=False)
    key_points: Mapped[str] = mapped_column(Text, default="", nullable=False)
    provider: Mapped[str] = mapped_column(String(50), default="manual", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)

    user: Mapped[User] = relationship(back_populates="ai_summaries")
    book: Mapped[Book | None] = relationship(back_populates="ai_summaries")
    chapter: Mapped[Chapter | None] = relationship(back_populates="ai_summaries")


class ChatRecord(Base):
    __tablename__ = "chat_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    book_id: Mapped[int | None] = mapped_column(ForeignKey("books.id"), nullable=True, index=True)
    chapter_id: Mapped[int | None] = mapped_column(ForeignKey("chapters.id"), nullable=True, index=True)
    question: Mapped[str] = mapped_column(Text, nullable=False)
    answer: Mapped[str] = mapped_column(Text, nullable=False)
    provider: Mapped[str] = mapped_column(String(50), default="manual", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)

    user: Mapped[User] = relationship(back_populates="chat_records")
    book: Mapped[Book | None] = relationship(back_populates="chat_records")
    chapter: Mapped[Chapter | None] = relationship(back_populates="chat_records")


class AiCallLog(Base):
    __tablename__ = "ai_call_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    book_id: Mapped[int | None] = mapped_column(ForeignKey("books.id"), nullable=True, index=True)
    chapter_id: Mapped[int | None] = mapped_column(ForeignKey("chapters.id"), nullable=True, index=True)
    call_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    provider: Mapped[str] = mapped_column(String(50), default="mock", nullable=False)
    model: Mapped[str] = mapped_column(String(100), default="", nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    error_code: Mapped[str] = mapped_column(String(50), default="", nullable=False)
    error_message: Mapped[str] = mapped_column(Text, default="", nullable=False)
    duration_ms: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)

    user: Mapped[User] = relationship(back_populates="ai_call_logs")
    book: Mapped[Book | None] = relationship(back_populates="ai_call_logs")
    chapter: Mapped[Chapter | None] = relationship(back_populates="ai_call_logs")
