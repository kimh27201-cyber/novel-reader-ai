import os
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]

os.environ["DATABASE_URL"] = f"sqlite:///{BACKEND_DIR / 'data' / 'test_novel_reader.db'}"
os.environ["JWT_SECRET_KEY"] = "test-secret-key"

sys.path.append(str(BACKEND_DIR))

from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_h5_preview_can_preflight_api_requests():
    response = client.options(
        "/api/auth/login",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type,authorization",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] in {"*", "http://localhost:5173"}
    assert "POST" in response.headers["access-control-allow-methods"]
