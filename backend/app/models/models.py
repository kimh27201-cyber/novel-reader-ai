from datetime import UTC, datetime
import hashlib
from uuid import uuid4

from sqlalchemy import BigInteger, Boolean, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


def now_utc() -> datetime:
    return datetime.now(UTC)


def make_source_identity_hash(name: str, base_url: str) -> str:
    normalized = f"{str(name).strip()}\0{str(base_url).strip().rstrip('/')}"
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


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
    source_sessions: Mapped[list["SourceSession"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    reading_history: Mapped[list["ReadingHistory"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    ai_summaries: Mapped[list["AiSummary"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    chat_records: Mapped[list["ChatRecord"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    ai_call_logs: Mapped[list["AiCallLog"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    tts_call_logs: Mapped[list["TtsCallLog"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    refresh_tokens: Mapped[list["RefreshToken"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class Book(Base):
    __tablename__ = "books"
    __table_args__ = (UniqueConstraint("user_id", "sync_id", name="uq_books_user_sync_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    source_id: Mapped[int | None] = mapped_column(ForeignKey("book_sources.id", ondelete="SET NULL"), nullable=True, index=True)
    sync_id: Mapped[str] = mapped_column(String(32), default=lambda: uuid4().hex, nullable=False, index=True)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
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
    __table_args__ = (UniqueConstraint("book_id", "chapter_index", name="uq_chapters_book_index"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    book_id: Mapped[int] = mapped_column(ForeignKey("books.id", ondelete="CASCADE"), nullable=False, index=True)
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
    __table_args__ = (
        UniqueConstraint("user_id", "identity_hash", name="uq_book_sources_user_identity_hash"),
        UniqueConstraint("user_id", "sync_id", name="uq_book_sources_user_sync_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    sync_id: Mapped[str] = mapped_column(String(32), default=lambda: uuid4().hex, nullable=False, index=True)
    identity_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    base_url: Mapped[str] = mapped_column(String(1000), default="", nullable=False)
    group: Mapped[str] = mapped_column(String(100), default="用户导入", nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    raw_json: Mapped[str] = mapped_column(Text, nullable=False)
    compatibility: Mapped[str] = mapped_column(String(255), default="未测试", nullable=False)
    health_status: Mapped[str] = mapped_column(String(30), default="unknown", nullable=False)
    last_checked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc, nullable=False)

    user: Mapped[User] = relationship(back_populates="sources")
    books: Mapped[list[Book]] = relationship(back_populates="source")
    sessions: Mapped[list["SourceSession"]] = relationship(back_populates="source", cascade="all, delete-orphan")


class SourceSession(Base):
    __tablename__ = "source_sessions"
    __table_args__ = (UniqueConstraint("user_id", "source_id", name="uq_source_sessions_user_source"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    source_id: Mapped[int] = mapped_column(ForeignKey("book_sources.id", ondelete="CASCADE"), nullable=False, index=True)
    origin: Mapped[str] = mapped_column(String(1000), default="", nullable=False)
    cookie: Mapped[str] = mapped_column(Text, default="", nullable=False)
    user_agent: Mapped[str] = mapped_column(Text, default="", nullable=False)
    referer: Mapped[str] = mapped_column(String(1000), default="", nullable=False)
    storage_state_json: Mapped[str] = mapped_column(Text, default="", nullable=False)
    local_storage_json: Mapped[str] = mapped_column(Text, default="", nullable=False)
    session_storage_json: Mapped[str] = mapped_column(Text, default="", nullable=False)
    expires_at: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    last_verified_at: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="active", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc, nullable=False)

    user: Mapped[User] = relationship(back_populates="source_sessions")
    source: Mapped[BookSource] = relationship(back_populates="sessions")


class ReadingHistory(Base):
    __tablename__ = "reading_history"
    __table_args__ = (
        UniqueConstraint("user_id", "book_id", name="uq_reading_history_user_book"),
        UniqueConstraint("user_id", "sync_id", name="uq_reading_history_user_sync_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    book_id: Mapped[int] = mapped_column(ForeignKey("books.id", ondelete="CASCADE"), nullable=False, index=True)
    chapter_id: Mapped[int | None] = mapped_column(ForeignKey("chapters.id", ondelete="SET NULL"), nullable=True, index=True)
    sync_id: Mapped[str] = mapped_column(String(32), default=lambda: uuid4().hex, nullable=False, index=True)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
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
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    book_id: Mapped[int | None] = mapped_column(ForeignKey("books.id", ondelete="SET NULL"), nullable=True, index=True)
    chapter_id: Mapped[int | None] = mapped_column(ForeignKey("chapters.id", ondelete="SET NULL"), nullable=True, index=True)
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
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    book_id: Mapped[int | None] = mapped_column(ForeignKey("books.id", ondelete="SET NULL"), nullable=True, index=True)
    chapter_id: Mapped[int | None] = mapped_column(ForeignKey("chapters.id", ondelete="SET NULL"), nullable=True, index=True)
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
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    book_id: Mapped[int | None] = mapped_column(ForeignKey("books.id", ondelete="SET NULL"), nullable=True, index=True)
    chapter_id: Mapped[int | None] = mapped_column(ForeignKey("chapters.id", ondelete="SET NULL"), nullable=True, index=True)
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


class TtsCallLog(Base):
    __tablename__ = "tts_call_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    voice_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    provider: Mapped[str] = mapped_column(String(50), default="volcengine", nullable=False)
    model: Mapped[str] = mapped_column(String(100), nullable=False)
    character_count: Mapped[int] = mapped_column(Integer, nullable=False)
    cache_hit: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    error_code: Mapped[str] = mapped_column(String(50), default="", nullable=False)
    provider_request_id: Mapped[str] = mapped_column(String(100), default="", nullable=False)
    upstream_status: Mapped[int | None] = mapped_column(Integer, nullable=True)
    audio_bytes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    duration_ms: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False, index=True)

    user: Mapped[User] = relationship(back_populates="tts_call_logs")


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    replaced_by_id: Mapped[int | None] = mapped_column(ForeignKey("refresh_tokens.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped[User] = relationship(back_populates="refresh_tokens")


class SyncMutation(Base):
    __tablename__ = "sync_mutations"
    __table_args__ = (UniqueConstraint("user_id", "mutation_id", name="uq_sync_mutations_user_mutation"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    mutation_id: Mapped[str] = mapped_column(String(64), nullable=False)
    result_json: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False, index=True)


class SyncChange(Base):
    __tablename__ = "sync_changes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    entity_type: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    sync_id: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    operation: Mapped[str] = mapped_column(String(20), nullable=False)
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    payload_json: Mapped[str] = mapped_column(Text, default="{}", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False, index=True)


class SyncDevice(Base):
    __tablename__ = "sync_devices"
    __table_args__ = (UniqueConstraint("user_id", "device_id", name="uq_sync_devices_user_device"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    device_id: Mapped[str] = mapped_column(String(100), nullable=False)
    last_cursor: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)


class SourceHealthCheck(Base):
    __tablename__ = "source_health_checks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    source_id: Mapped[int] = mapped_column(ForeignKey("book_sources.id", ondelete="CASCADE"), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    failed_stage: Mapped[str] = mapped_column(String(30), default="", nullable=False)
    latency_ms: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    error_code: Mapped[str] = mapped_column(String(50), default="", nullable=False)
    error_message: Mapped[str] = mapped_column(Text, default="", nullable=False)
    details_json: Mapped[str] = mapped_column(Text, default="{}", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False, index=True)
