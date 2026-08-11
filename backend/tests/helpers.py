import os
import sqlite3
import tempfile
from pathlib import Path
from typing import Any


_INITIALIZED_ENGINES: set[int] = set()


def configure_test_environment(test_file: str) -> Path:
    backend_dir = Path(test_file).resolve().parents[1]
    test_database_url = os.environ.get("NOVEL_READER_TEST_DATABASE_URL", "").strip()
    if test_database_url:
        os.environ["DATABASE_URL"] = test_database_url
    else:
        database_path = _resolve_writable_database_path(backend_dir)
        os.environ["DATABASE_URL"] = f"sqlite:///{database_path.as_posix()}"
    os.environ["JWT_SECRET_KEY"] = "test-secret-key"
    os.environ["APP_ENV"] = "test"
    os.environ["BCRYPT_ROUNDS"] = "4"
    os.environ["ALLOW_QUERY_TOKEN_AUTH"] = "false"

    return backend_dir


def _resolve_writable_database_path(backend_dir: Path) -> Path:
    env_data_dir = os.environ.get("NOVEL_READER_TEST_DATA_DIR")
    candidate_dirs = [
        backend_dir.parent / ".test-data",
        backend_dir.parent.parent / "novel-reader-uniapp-test-data",
        Path(tempfile.gettempdir()) / "novel-reader-uniapp-test-data",
    ]

    if env_data_dir:
        candidate_dirs.insert(0, Path(env_data_dir))

    for data_dir in candidate_dirs:
        database_path = data_dir / "test_novel_reader.db"
        if _can_write_sqlite_database(database_path):
            return database_path

    searched = ", ".join(str(path) for path in candidate_dirs)
    raise RuntimeError(f"No writable SQLite test database path found. Tried: {searched}")


def _can_write_sqlite_database(database_path: Path) -> bool:
    try:
        database_path.parent.mkdir(parents=True, exist_ok=True)
        connection = sqlite3.connect(database_path)
        connection.execute("create table if not exists __write_probe(id integer)")
        connection.execute("drop table __write_probe")
        connection.commit()
        connection.close()
        return True
    except (OSError, sqlite3.Error):
        return False


def reset_database(base: Any, engine: Any) -> None:
    """Build a fresh current-model schema once, then only clear rows."""
    engine_key = id(engine)
    if engine_key not in _INITIALIZED_ENGINES:
        base.metadata.drop_all(bind=engine)
        base.metadata.create_all(bind=engine)
        _INITIALIZED_ENGINES.add(engine_key)
    with engine.begin() as connection:
        for table in reversed(base.metadata.sorted_tables):
            connection.execute(table.delete())
