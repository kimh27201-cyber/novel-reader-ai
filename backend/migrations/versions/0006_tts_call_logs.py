"""Add privacy-safe TTS call logs.

Revision ID: 0006_tts_call_logs
Revises: 0005_foreign_key_delete_policies
Create Date: 2026-07-25 00:00:00
"""

from alembic import op
import sqlalchemy as sa


revision = "0006_tts_call_logs"
down_revision = "0005_foreign_key_delete_policies"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "tts_call_logs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("voice_id", sa.String(length=100), nullable=False),
        sa.Column("provider", sa.String(length=50), nullable=False),
        sa.Column("model", sa.String(length=100), nullable=False),
        sa.Column("character_count", sa.Integer(), nullable=False),
        sa.Column("cache_hit", sa.Boolean(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("error_code", sa.String(length=50), nullable=False),
        sa.Column("duration_ms", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_tts_call_logs_id"), "tts_call_logs", ["id"], unique=False)
    op.create_index(op.f("ix_tts_call_logs_user_id"), "tts_call_logs", ["user_id"], unique=False)
    op.create_index(op.f("ix_tts_call_logs_voice_id"), "tts_call_logs", ["voice_id"], unique=False)
    op.create_index(op.f("ix_tts_call_logs_cache_hit"), "tts_call_logs", ["cache_hit"], unique=False)
    op.create_index(op.f("ix_tts_call_logs_status"), "tts_call_logs", ["status"], unique=False)
    op.create_index(op.f("ix_tts_call_logs_created_at"), "tts_call_logs", ["created_at"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_tts_call_logs_created_at"), table_name="tts_call_logs")
    op.drop_index(op.f("ix_tts_call_logs_status"), table_name="tts_call_logs")
    op.drop_index(op.f("ix_tts_call_logs_cache_hit"), table_name="tts_call_logs")
    op.drop_index(op.f("ix_tts_call_logs_voice_id"), table_name="tts_call_logs")
    op.drop_index(op.f("ix_tts_call_logs_user_id"), table_name="tts_call_logs")
    op.drop_index(op.f("ix_tts_call_logs_id"), table_name="tts_call_logs")
    op.drop_table("tts_call_logs")
