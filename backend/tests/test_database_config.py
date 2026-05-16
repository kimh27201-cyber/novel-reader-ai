from app.db.session import get_engine_connect_args


def test_sqlite_engine_uses_check_same_thread_false() -> None:
    assert get_engine_connect_args("sqlite:///./data/novel_reader.db") == {
        "check_same_thread": False
    }


def test_postgresql_engine_does_not_use_sqlite_connect_args() -> None:
    assert get_engine_connect_args("postgresql+psycopg://reader:secret@db:5432/novel_reader") == {}
