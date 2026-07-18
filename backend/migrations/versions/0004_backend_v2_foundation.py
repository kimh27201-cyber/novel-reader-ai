"""Backend V2 data integrity, refresh tokens, sync and source health.

Revision ID: 0004_backend_v2_foundation
Revises: 0003_source_sessions
Create Date: 2026-07-18 00:00:00
"""

from uuid import uuid4
import hashlib

from alembic import op
import sqlalchemy as sa


revision = "0004_backend_v2_foundation"
down_revision = "0003_source_sessions"
branch_labels = None
depends_on = None


def _dedupe_existing_rows() -> None:
    connection = op.get_bind()

    source_rows = connection.execute(sa.text(
        "SELECT id, user_id, name, base_url FROM book_sources ORDER BY updated_at DESC, id DESC"
    )).mappings()
    source_keepers: dict[tuple[object, ...], int] = {}
    for row in source_rows:
        key = (
            row["user_id"],
            str(row["name"]).strip(),
            str(row["base_url"]).strip().rstrip("/"),
        )
        keeper = source_keepers.setdefault(key, row["id"])
        if keeper == row["id"]:
            connection.execute(sa.text(
                "UPDATE book_sources SET name=:name, base_url=:base_url WHERE id=:id"
            ), {
                "name": key[1],
                "base_url": key[2],
                "id": row["id"],
            })
            continue
        connection.execute(sa.text("UPDATE books SET source_id=:keeper WHERE source_id=:duplicate"), {
            "keeper": keeper, "duplicate": row["id"],
        })
        connection.execute(sa.text("UPDATE source_sessions SET source_id=:keeper WHERE source_id=:duplicate"), {
            "keeper": keeper, "duplicate": row["id"],
        })
        connection.execute(sa.text("DELETE FROM book_sources WHERE id=:duplicate"), {"duplicate": row["id"]})

    chapter_rows = connection.execute(sa.text(
        "SELECT id, book_id, chapter_index FROM chapters ORDER BY updated_at DESC, id DESC"
    )).mappings()
    chapter_keepers: dict[tuple[object, ...], int] = {}
    for row in chapter_rows:
        key = (row["book_id"], row["chapter_index"])
        keeper = chapter_keepers.setdefault(key, row["id"])
        if keeper == row["id"]:
            continue
        for table_name in ["reading_history", "ai_summaries", "chat_records", "ai_call_logs"]:
            connection.execute(sa.text(
                f"UPDATE {table_name} SET chapter_id=:keeper WHERE chapter_id=:duplicate"
            ), {"keeper": keeper, "duplicate": row["id"]})
        connection.execute(sa.text("DELETE FROM chapters WHERE id=:duplicate"), {"duplicate": row["id"]})

    history_rows = connection.execute(sa.text(
        "SELECT id, user_id, book_id FROM reading_history ORDER BY updated_at DESC, id DESC"
    )).mappings()
    history_keepers: set[tuple[object, ...]] = set()
    for row in history_rows:
        key = (row["user_id"], row["book_id"])
        if key in history_keepers:
            connection.execute(sa.text("DELETE FROM reading_history WHERE id=:id"), {"id": row["id"]})
        else:
            history_keepers.add(key)

    session_rows = connection.execute(sa.text(
        "SELECT id, user_id, source_id FROM source_sessions ORDER BY updated_at DESC, id DESC"
    )).mappings()
    session_keepers: set[tuple[object, ...]] = set()
    for row in session_rows:
        key = (row["user_id"], row["source_id"])
        if key in session_keepers:
            connection.execute(sa.text("DELETE FROM source_sessions WHERE id=:id"), {"id": row["id"]})
        else:
            session_keepers.add(key)


def _add_sync_columns(table_name: str) -> None:
    op.add_column(table_name, sa.Column("sync_id", sa.String(length=32), nullable=True))
    op.add_column(table_name, sa.Column("version", sa.Integer(), server_default="1", nullable=False))
    op.add_column(table_name, sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True))
    connection = op.get_bind()
    rows = connection.execute(sa.text(f"SELECT id FROM {table_name}")).fetchall()
    for row in rows:
        connection.execute(
            sa.text(f"UPDATE {table_name} SET sync_id = :sync_id WHERE id = :id"),
            {"sync_id": uuid4().hex, "id": row[0]},
        )
    with op.batch_alter_table(table_name) as batch_op:
        batch_op.alter_column("sync_id", existing_type=sa.String(length=32), nullable=False)
        batch_op.create_index(f"ix_{table_name}_sync_id", ["sync_id"], unique=False)
        batch_op.create_index(f"ix_{table_name}_deleted_at", ["deleted_at"], unique=False)


def upgrade() -> None:
    _dedupe_existing_rows()
    _add_sync_columns("books")
    _add_sync_columns("book_sources")
    _add_sync_columns("reading_history")

    op.add_column("book_sources", sa.Column("identity_hash", sa.String(length=64), nullable=True))
    connection = op.get_bind()
    for row in connection.execute(sa.text("SELECT id, name, base_url FROM book_sources")).mappings():
        material = f"{str(row['name']).strip()}\0{str(row['base_url']).strip().rstrip('/')}"
        connection.execute(
            sa.text("UPDATE book_sources SET identity_hash=:identity_hash WHERE id=:id"),
            {"identity_hash": hashlib.sha256(material.encode("utf-8")).hexdigest(), "id": row["id"]},
        )
    with op.batch_alter_table("book_sources") as batch_op:
        batch_op.alter_column("identity_hash", existing_type=sa.String(length=64), nullable=False)
        batch_op.create_index("ix_book_sources_identity_hash", ["identity_hash"], unique=False)

    op.add_column("book_sources", sa.Column("health_status", sa.String(length=30), server_default="unknown", nullable=False))
    op.add_column("book_sources", sa.Column("last_checked_at", sa.DateTime(timezone=True), nullable=True))

    with op.batch_alter_table("books") as batch_op:
        batch_op.create_unique_constraint("uq_books_user_sync_id", ["user_id", "sync_id"])
    with op.batch_alter_table("book_sources") as batch_op:
        batch_op.create_unique_constraint("uq_book_sources_user_identity_hash", ["user_id", "identity_hash"])
        batch_op.create_unique_constraint("uq_book_sources_user_sync_id", ["user_id", "sync_id"])
    with op.batch_alter_table("chapters") as batch_op:
        batch_op.create_unique_constraint("uq_chapters_book_index", ["book_id", "chapter_index"])
    with op.batch_alter_table("reading_history") as batch_op:
        batch_op.create_unique_constraint("uq_reading_history_user_book", ["user_id", "book_id"])
        batch_op.create_unique_constraint("uq_reading_history_user_sync_id", ["user_id", "sync_id"])
    with op.batch_alter_table("source_sessions") as batch_op:
        batch_op.create_unique_constraint("uq_source_sessions_user_source", ["user_id", "source_id"])

    op.create_table(
        "refresh_tokens",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("replaced_by_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["replaced_by_id"], ["refresh_tokens.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_refresh_tokens_id", "refresh_tokens", ["id"])
    op.create_index("ix_refresh_tokens_user_id", "refresh_tokens", ["user_id"])
    op.create_index("ix_refresh_tokens_token_hash", "refresh_tokens", ["token_hash"], unique=True)
    op.create_index("ix_refresh_tokens_expires_at", "refresh_tokens", ["expires_at"])

    op.create_table(
        "sync_mutations",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("mutation_id", sa.String(length=64), nullable=False),
        sa.Column("result_json", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "mutation_id", name="uq_sync_mutations_user_mutation"),
    )
    op.create_index("ix_sync_mutations_user_id", "sync_mutations", ["user_id"])
    op.create_index("ix_sync_mutations_created_at", "sync_mutations", ["created_at"])

    op.create_table(
        "sync_changes",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("entity_type", sa.String(length=30), nullable=False),
        sa.Column("sync_id", sa.String(length=32), nullable=False),
        sa.Column("operation", sa.String(length=20), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("payload_json", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    for column in ["user_id", "entity_type", "sync_id", "created_at"]:
        op.create_index(f"ix_sync_changes_{column}", "sync_changes", [column])

    op.create_table(
        "sync_devices",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("device_id", sa.String(length=100), nullable=False),
        sa.Column("last_cursor", sa.BigInteger(), nullable=False),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "device_id", name="uq_sync_devices_user_device"),
    )
    op.create_index("ix_sync_devices_user_id", "sync_devices", ["user_id"])

    op.create_table(
        "source_health_checks",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("source_id", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("failed_stage", sa.String(length=30), nullable=False),
        sa.Column("latency_ms", sa.Integer(), nullable=False),
        sa.Column("error_code", sa.String(length=50), nullable=False),
        sa.Column("error_message", sa.Text(), nullable=False),
        sa.Column("details_json", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["source_id"], ["book_sources.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    for column in ["user_id", "source_id", "status", "created_at"]:
        op.create_index(f"ix_source_health_checks_{column}", "source_health_checks", [column])


def downgrade() -> None:
    op.drop_table("source_health_checks")
    op.drop_table("sync_devices")
    op.drop_table("sync_changes")
    op.drop_table("sync_mutations")
    op.drop_table("refresh_tokens")

    with op.batch_alter_table("source_sessions") as batch_op:
        batch_op.drop_constraint("uq_source_sessions_user_source", type_="unique")
    with op.batch_alter_table("reading_history") as batch_op:
        batch_op.drop_constraint("uq_reading_history_user_sync_id", type_="unique")
        batch_op.drop_constraint("uq_reading_history_user_book", type_="unique")
    with op.batch_alter_table("chapters") as batch_op:
        batch_op.drop_constraint("uq_chapters_book_index", type_="unique")
    with op.batch_alter_table("book_sources") as batch_op:
        batch_op.drop_constraint("uq_book_sources_user_sync_id", type_="unique")
        batch_op.drop_constraint("uq_book_sources_user_identity_hash", type_="unique")
    with op.batch_alter_table("books") as batch_op:
        batch_op.drop_constraint("uq_books_user_sync_id", type_="unique")

    op.drop_column("book_sources", "last_checked_at")
    op.drop_column("book_sources", "health_status")
    with op.batch_alter_table("book_sources") as batch_op:
        batch_op.drop_index("ix_book_sources_identity_hash")
        batch_op.drop_column("identity_hash")
    for table_name in ["reading_history", "book_sources", "books"]:
        with op.batch_alter_table(table_name) as batch_op:
            batch_op.drop_index(f"ix_{table_name}_deleted_at")
            batch_op.drop_index(f"ix_{table_name}_sync_id")
            batch_op.drop_column("deleted_at")
            batch_op.drop_column("version")
            batch_op.drop_column("sync_id")
