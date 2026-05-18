"""Add AI call logs.

Revision ID: 0002_ai_call_logs
Revises: 0001_initial_schema
Create Date: 2026-05-18 00:00:00
"""

from alembic import op
import sqlalchemy as sa


revision = "0002_ai_call_logs"
down_revision = "0001_initial_schema"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "ai_call_logs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("book_id", sa.Integer(), nullable=True),
        sa.Column("chapter_id", sa.Integer(), nullable=True),
        sa.Column("call_type", sa.String(length=50), nullable=False),
        sa.Column("provider", sa.String(length=50), nullable=False),
        sa.Column("model", sa.String(length=100), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("error_code", sa.String(length=50), nullable=False),
        sa.Column("error_message", sa.Text(), nullable=False),
        sa.Column("duration_ms", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["book_id"], ["books.id"]),
        sa.ForeignKeyConstraint(["chapter_id"], ["chapters.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_ai_call_logs_book_id"), "ai_call_logs", ["book_id"], unique=False)
    op.create_index(op.f("ix_ai_call_logs_call_type"), "ai_call_logs", ["call_type"], unique=False)
    op.create_index(op.f("ix_ai_call_logs_chapter_id"), "ai_call_logs", ["chapter_id"], unique=False)
    op.create_index(op.f("ix_ai_call_logs_id"), "ai_call_logs", ["id"], unique=False)
    op.create_index(op.f("ix_ai_call_logs_status"), "ai_call_logs", ["status"], unique=False)
    op.create_index(op.f("ix_ai_call_logs_user_id"), "ai_call_logs", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_ai_call_logs_user_id"), table_name="ai_call_logs")
    op.drop_index(op.f("ix_ai_call_logs_status"), table_name="ai_call_logs")
    op.drop_index(op.f("ix_ai_call_logs_id"), table_name="ai_call_logs")
    op.drop_index(op.f("ix_ai_call_logs_chapter_id"), table_name="ai_call_logs")
    op.drop_index(op.f("ix_ai_call_logs_call_type"), table_name="ai_call_logs")
    op.drop_index(op.f("ix_ai_call_logs_book_id"), table_name="ai_call_logs")
    op.drop_table("ai_call_logs")
