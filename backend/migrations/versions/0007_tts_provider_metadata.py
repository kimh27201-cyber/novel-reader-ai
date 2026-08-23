"""Add privacy-safe TTS provider metadata.

Revision ID: 0007_tts_provider_metadata
Revises: 0006_tts_call_logs
Create Date: 2026-07-27 00:00:00
"""

from alembic import op
import sqlalchemy as sa


revision = "0007_tts_provider_metadata"
down_revision = "0006_tts_call_logs"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("tts_call_logs") as batch_op:
        batch_op.add_column(
            sa.Column("provider_request_id", sa.String(length=100), server_default="", nullable=False)
        )
        batch_op.add_column(sa.Column("upstream_status", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("audio_bytes", sa.Integer(), server_default="0", nullable=False))


def downgrade() -> None:
    with op.batch_alter_table("tts_call_logs") as batch_op:
        batch_op.drop_column("audio_bytes")
        batch_op.drop_column("upstream_status")
        batch_op.drop_column("provider_request_id")
