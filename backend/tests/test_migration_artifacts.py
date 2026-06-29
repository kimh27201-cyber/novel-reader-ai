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


def test_ai_call_log_migration_declares_call_log_table() -> None:
    migration = (BACKEND_DIR / "migrations" / "versions" / "0002_ai_call_logs.py").read_text(encoding="utf-8")
    assert '"ai_call_logs",' in migration
    assert '"call_type"' in migration
    assert '"duration_ms"' in migration


def test_source_session_migration_declares_session_table() -> None:
    migration = (BACKEND_DIR / "migrations" / "versions" / "0003_source_sessions.py").read_text(encoding="utf-8")
    assert '"source_sessions",' in migration
    assert '"source_id"' in migration
    assert '"cookie"' in migration
    assert '"user_agent"' in migration
