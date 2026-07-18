"""Apply database-level delete policies.

Revision ID: 0005_foreign_key_delete_policies
Revises: 0004_backend_v2_foundation
Create Date: 2026-07-18 00:30:00
"""

from alembic import op
import sqlalchemy as sa


revision = "0005_foreign_key_delete_policies"
down_revision = "0004_backend_v2_foundation"
branch_labels = None
depends_on = None


NAMING_CONVENTION = {
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
}


POLICIES = {
    "book_sources": [("user_id", "users", "id", "CASCADE")],
    "books": [
        ("user_id", "users", "id", "CASCADE"),
        ("source_id", "book_sources", "id", "SET NULL"),
    ],
    "chapters": [("book_id", "books", "id", "CASCADE")],
    "reading_history": [
        ("user_id", "users", "id", "CASCADE"),
        ("book_id", "books", "id", "CASCADE"),
        ("chapter_id", "chapters", "id", "SET NULL"),
    ],
    "source_sessions": [
        ("user_id", "users", "id", "CASCADE"),
        ("source_id", "book_sources", "id", "CASCADE"),
    ],
    "ai_summaries": [
        ("user_id", "users", "id", "CASCADE"),
        ("book_id", "books", "id", "SET NULL"),
        ("chapter_id", "chapters", "id", "SET NULL"),
    ],
    "chat_records": [
        ("user_id", "users", "id", "CASCADE"),
        ("book_id", "books", "id", "SET NULL"),
        ("chapter_id", "chapters", "id", "SET NULL"),
    ],
    "ai_call_logs": [
        ("user_id", "users", "id", "CASCADE"),
        ("book_id", "books", "id", "SET NULL"),
        ("chapter_id", "chapters", "id", "SET NULL"),
    ],
}


def _foreign_key_name(table_name: str, column: str) -> str:
    for foreign_key in sa.inspect(op.get_bind()).get_foreign_keys(table_name):
        if foreign_key.get("constrained_columns") == [column] and foreign_key.get("name"):
            return str(foreign_key["name"])
    referred = next(item[1] for item in POLICIES[table_name] if item[0] == column)
    return f"fk_{table_name}_{column}_{referred}"


def upgrade() -> None:
    for table_name, policies in POLICIES.items():
        existing_names = {column: _foreign_key_name(table_name, column) for column, *_ in policies}
        with op.batch_alter_table(table_name, naming_convention=NAMING_CONVENTION) as batch_op:
            for column, referred_table, referred_column, ondelete in policies:
                batch_op.drop_constraint(existing_names[column], type_="foreignkey")
                batch_op.create_foreign_key(
                    f"fk_{table_name}_{column}_{referred_table}",
                    referred_table,
                    [column],
                    [referred_column],
                    ondelete=ondelete,
                )


def downgrade() -> None:
    for table_name, policies in POLICIES.items():
        with op.batch_alter_table(table_name, naming_convention=NAMING_CONVENTION) as batch_op:
            for column, referred_table, referred_column, _ondelete in policies:
                batch_op.drop_constraint(f"fk_{table_name}_{column}_{referred_table}", type_="foreignkey")
                batch_op.create_foreign_key(
                    f"fk_{table_name}_{column}_{referred_table}",
                    referred_table,
                    [column],
                    [referred_column],
                )
