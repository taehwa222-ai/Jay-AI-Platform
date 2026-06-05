from datetime import UTC, datetime

from fastapi import APIRouter

from app.config import get_settings

router = APIRouter(prefix="/api/v1/health", tags=["health"])


@router.get("")
async def health() -> dict[str, object]:
    settings = get_settings()
    return {
        "ok": True,
        "app": settings.app_name,
        "env": settings.app_env,
        "time": datetime.now(UTC).isoformat(),
    }
