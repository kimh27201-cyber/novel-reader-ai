import os
import sqlite3
import tempfile
from pathlib import Path


def configure_test_environment(test_file: str) -> Path:
    backend_dir = Path(test_file).resolve().parents[1]
    database_path = _resolve_writable_database_path(backend_dir)

    os.environ["DATABASE_URL"] = f"sqlite:///{database_path.as_posix()}"
    os.environ["JWT_SECRET_KEY"] = "test-secret-key"

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
