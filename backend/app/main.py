from fastapi import FastAPI
from fastapi import HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware

from app.api.ai import router as ai_router
from app.api.auth import router as auth_router
from app.api.demo import router as demo_router
from app.api.library import router as library_router
from app.api.sources import router as sources_router
from app.core.config import get_settings
from app.core.observability import (
    http_exception_handler,
    request_observability_middleware,
    validation_exception_handler,
)
from app.models import models  # noqa: F401


settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="AI 阅读助手后端服务",
    swagger_ui_parameters={"persistAuthorization": True},
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


app.include_router(auth_router)
app.include_router(library_router)
app.include_router(sources_router)
app.include_router(demo_router)
app.include_router(ai_router)
