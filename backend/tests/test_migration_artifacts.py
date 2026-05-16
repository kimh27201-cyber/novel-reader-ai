from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parents[1]


def test_alembic_config_points_to_backend_migrations() -> None:
    config = (BACKEND_DIR / "alembic.ini").read_text(encoding="utf-8")
    assert "script_location = migrations" in config
    assert "sqlalchemy.url = sqlite:///./data/novel_reader.db" in config


def test_alembic_env_uses_project_settings_and_metadata() -> None:
    env = (BACKEND_DIR / "migrations" / "env.py").read_text(encoding="utf-8")
    assert "from app.core.config import get_settings" in env
    assert "from app.db.session import Base" in env
    assert "target_metadata = Base.metadata" in env
    assert "config.set_main_option(\"sqlalchemy.url\", get_settings().database_url)" in env


def test_initial_migration_declares_current_business_tables() -> None:
    migration = (BACKEND_DIR / "migrations" / "versions" / "0001_initial_schema.py").read_text(encoding="utf-8")
    for table_name in [
        "users",
        "book_sources",
        "books",
        "chapters",
        "reading_history",
        "ai_summaries",
        "chat_records",
    ]:
        assert f'"{table_name}",' in migration
