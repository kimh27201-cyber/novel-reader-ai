import os
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.append(str(BACKEND_DIR))
os.chdir(BACKEND_DIR)

from app.db.session import Base, engine  # noqa: E402
from app.models import models  # noqa: F401, E402


def main() -> None:
    Base.metadata.create_all(bind=engine)
    print("Database initialized.")


if __name__ == "__main__":
    main()
