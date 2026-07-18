from contextlib import asynccontextmanager
from pathlib import Path

from alembic.config import Config as AlembicConfig
from alembic.script import ScriptDirectory
from fastapi import FastAPI
from fastapi import HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.api.ai import router as ai_router
from app.api.auth import router as auth_router
from app.api.demo import router as demo_router
from app.api.library import router as library_router
from app.api.proxy import router as proxy_router
from app.api.proxy import close_proxy_http_client
from app.api.search import router as search_router
from app.api.sources import router as sources_router
from app.api.sync import router as sync_router
from app.core.config import get_settings
from app.core.observability import (
    http_exception_handler,
    request_observability_middleware,
    validation_exception_handler,
)
from app.models import models  # noqa: F401
from app.db.session import engine
from app.services.source_parser import close_source_http_client
from app.services.session_crypto import encrypt_legacy_source_sessions


settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    encrypt_legacy_source_sessions()
    yield
    await close_proxy_http_client()
    await close_source_http_client()

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="AI 阅读助手后端服务",
    swagger_ui_parameters={"persistAuthorization": True},
    lifespan=lifespan,
)

cors_origins = [origin.strip() for origin in settings.cors_allow_origins.split(",") if origin.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins or ["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.middleware("http")(request_observability_middleware)
app.add_exception_handler(HTTPException, http_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)


@app.get("/api/health")
def health_check() -> dict[str, str]:
    return {
        "status": "ok",
        "app": settings.app_name,
        "version": settings.app_version,
    }


@app.get("/api/health/live")
def liveness_check() -> dict[str, str]:
    return {"status": "ok"}


def expected_migration_head() -> str:
    backend_dir = Path(__file__).resolve().parents[1]
    config = AlembicConfig(str(backend_dir / "alembic.ini"))
    config.set_main_option("script_location", str(backend_dir / "migrations"))
    return str(ScriptDirectory.from_config(config).get_current_head() or "")


@app.get("/api/health/ready")
def readiness_check() -> dict[str, str]:
    try:
        with engine.connect() as connection:
            database_version = connection.execute(text("SELECT version_num FROM alembic_version")).scalar_one_or_none()
        migration_head = expected_migration_head()
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Database is not ready") from exc
    if database_version != migration_head:
        raise HTTPException(
            status_code=503,
            detail={
                "message": "Database migration is not current",
                "database_version": database_version,
                "expected_version": migration_head,
            },
        )
    return {"status": "ok", "database": "ready", "migration": migration_head}


app.include_router(auth_router)
app.include_router(library_router)
app.include_router(sources_router)
app.include_router(demo_router)
app.include_router(ai_router)
app.include_router(proxy_router)
app.include_router(sync_router)
app.include_router(search_router)
