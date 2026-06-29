"""Add source sessions.

Revision ID: 0003_source_sessions
Revises: 0002_ai_call_logs
Create Date: 2026-06-29 00:00:00
"""

from alembic import op
import sqlalchemy as sa


revision = "0003_source_sessions"
down_revision = "0002_ai_call_logs"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "source_sessions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("source_id", sa.Integer(), nullable=False),
        sa.Column("origin", sa.String(length=1000), nullable=False),
        sa.Column("cookie", sa.Text(), nullable=False),
        sa.Column("user_agent", sa.Text(), nullable=False),
        sa.Column("referer", sa.String(length=1000), nullable=False),
        sa.Column("storage_state_json", sa.Text(), nullable=False),
        sa.Column("local_storage_json", sa.Text(), nullable=False),
        sa.Column("session_storage_json", sa.Text(), nullable=False),
        sa.Column("expires_at", sa.BigInteger(), nullable=False),
        sa.Column("last_verified_at", sa.BigInteger(), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["source_id"], ["book_sources.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_source_sessions_id"), "source_sessions", ["id"], unique=False)
    op.create_index(op.f("ix_source_sessions_source_id"), "source_sessions", ["source_id"], unique=False)
    op.create_index(op.f("ix_source_sessions_user_id"), "source_sessions", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_source_sessions_user_id"), table_name="source_sessions")
    op.drop_index(op.f("ix_source_sessions_source_id"), table_name="source_sessions")
    op.drop_index(op.f("ix_source_sessions_id"), table_name="source_sessions")
    op.drop_table("source_sessions")
