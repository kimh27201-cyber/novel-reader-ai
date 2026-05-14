from fastapi import FastAPI

from app.api.auth import router as auth_router
from app.api.library import router as library_router
from app.api.sources import router as sources_router
from app.core.config import get_settings
from app.models import models  # noqa: F401


settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="AI 阅读助手第一阶段后端服务",
)


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
