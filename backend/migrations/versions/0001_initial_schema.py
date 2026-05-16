"""Initial schema.

Revision ID: 0001_initial_schema
Revises:
Create Date: 2026-05-16 00:00:00
"""

from alembic import op
import sqlalchemy as sa


revision = "0001_initial_schema"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("username", sa.String(length=50), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("hashed_password", sa.String(length=255), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)
    op.create_index(op.f("ix_users_id"), "users", ["id"], unique=False)
    op.create_index(op.f("ix_users_username"), "users", ["username"], unique=True)

    op.create_table(
        "book_sources",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("base_url", sa.String(length=1000), nullable=False),
        sa.Column("group", sa.String(length=100), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False),
        sa.Column("raw_json", sa.Text(), nullable=False),
        sa.Column("compatibility", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_book_sources_id"), "book_sources", ["id"], unique=False)
    op.create_index(op.f("ix_book_sources_name"), "book_sources", ["name"], unique=False)
    op.create_index(op.f("ix_book_sources_user_id"), "book_sources", ["user_id"], unique=False)

    op.create_table(
        "books",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("source_id", sa.Integer(), nullable=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("author", sa.String(length=255), nullable=False),
        sa.Column("cover_url", sa.String(length=1000), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("book_url", sa.String(length=1000), nullable=False),
        sa.Column("toc_url", sa.String(length=1000), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["source_id"], ["book_sources.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_books_id"), "books", ["id"], unique=False)
    op.create_index(op.f("ix_books_source_id"), "books", ["source_id"], unique=False)
    op.create_index(op.f("ix_books_title"), "books", ["title"], unique=False)
    op.create_index(op.f("ix_books_user_id"), "books", ["user_id"], unique=False)

    op.create_table(
        "chapters",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("book_id", sa.Integer(), nullable=False),
        sa.Column("chapter_index", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("url", sa.String(length=1000), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("is_cached", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["book_id"], ["books.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_chapters_book_id"), "chapters", ["book_id"], unique=False)
    op.create_index(op.f("ix_chapters_id"), "chapters", ["id"], unique=False)

    op.create_table(
        "reading_history",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("book_id", sa.Integer(), nullable=False),
        sa.Column("chapter_id", sa.Integer(), nullable=True),
        sa.Column("chapter_index", sa.Integer(), nullable=False),
        sa.Column("page_index", sa.Integer(), nullable=False),
        sa.Column("progress_percent", sa.Float(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["book_id"], ["books.id"]),
        sa.ForeignKeyConstraint(["chapter_id"], ["chapters.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_reading_history_book_id"), "reading_history", ["book_id"], unique=False)
    op.create_index(op.f("ix_reading_history_chapter_id"), "reading_history", ["chapter_id"], unique=False)
    op.create_index(op.f("ix_reading_history_id"), "reading_history", ["id"], unique=False)
    op.create_index(op.f("ix_reading_history_user_id"), "reading_history", ["user_id"], unique=False)

    op.create_table(
        "ai_summaries",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("book_id", sa.Integer(), nullable=True),
        sa.Column("chapter_id", sa.Integer(), nullable=True),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("characters", sa.Text(), nullable=False),
        sa.Column("key_points", sa.Text(), nullable=False),
        sa.Column("provider", sa.String(length=50), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["book_id"], ["books.id"]),
        sa.ForeignKeyConstraint(["chapter_id"], ["chapters.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_ai_summaries_book_id"), "ai_summaries", ["book_id"], unique=False)
    op.create_index(op.f("ix_ai_summaries_chapter_id"), "ai_summaries", ["chapter_id"], unique=False)
    op.create_index(op.f("ix_ai_summaries_id"), "ai_summaries", ["id"], unique=False)
    op.create_index(op.f("ix_ai_summaries_user_id"), "ai_summaries", ["user_id"], unique=False)

    op.create_table(
        "chat_records",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("book_id", sa.Integer(), nullable=True),
        sa.Column("chapter_id", sa.Integer(), nullable=True),
        sa.Column("question", sa.Text(), nullable=False),
        sa.Column("answer", sa.Text(), nullable=False),
        sa.Column("provider", sa.String(length=50), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["book_id"], ["books.id"]),
        sa.ForeignKeyConstraint(["chapter_id"], ["chapters.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_chat_records_book_id"), "chat_records", ["book_id"], unique=False)
    op.create_index(op.f("ix_chat_records_chapter_id"), "chat_records", ["chapter_id"], unique=False)
    op.create_index(op.f("ix_chat_records_id"), "chat_records", ["id"], unique=False)
    op.create_index(op.f("ix_chat_records_user_id"), "chat_records", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_chat_records_user_id"), table_name="chat_records")
    op.drop_index(op.f("ix_chat_records_id"), table_name="chat_records")
    op.drop_index(op.f("ix_chat_records_chapter_id"), table_name="chat_records")
    op.drop_index(op.f("ix_chat_records_book_id"), table_name="chat_records")
    op.drop_table("chat_records")

    op.drop_index(op.f("ix_ai_summaries_user_id"), table_name="ai_summaries")
    op.drop_index(op.f("ix_ai_summaries_id"), table_name="ai_summaries")
    op.drop_index(op.f("ix_ai_summaries_chapter_id"), table_name="ai_summaries")
    op.drop_index(op.f("ix_ai_summaries_book_id"), table_name="ai_summaries")
    op.drop_table("ai_summaries")

    op.drop_index(op.f("ix_reading_history_user_id"), table_name="reading_history")
    op.drop_index(op.f("ix_reading_history_id"), table_name="reading_history")
    op.drop_index(op.f("ix_reading_history_chapter_id"), table_name="reading_history")
    op.drop_index(op.f("ix_reading_history_book_id"), table_name="reading_history")
    op.drop_table("reading_history")

    op.drop_index(op.f("ix_chapters_id"), table_name="chapters")
    op.drop_index(op.f("ix_chapters_book_id"), table_name="chapters")
    op.drop_table("chapters")

    op.drop_index(op.f("ix_books_user_id"), table_name="books")
    op.drop_index(op.f("ix_books_title"), table_name="books")
    op.drop_index(op.f("ix_books_source_id"), table_name="books")
    op.drop_index(op.f("ix_books_id"), table_name="books")
    op.drop_table("books")

    op.drop_index(op.f("ix_book_sources_user_id"), table_name="book_sources")
    op.drop_index(op.f("ix_book_sources_name"), table_name="book_sources")
    op.drop_index(op.f("ix_book_sources_id"), table_name="book_sources")
    op.drop_table("book_sources")

    op.drop_index(op.f("ix_users_username"), table_name="users")
    op.drop_index(op.f("ix_users_id"), table_name="users")
    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.drop_table("users")
