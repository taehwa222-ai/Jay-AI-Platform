from datetime import UTC, datetime

from fastapi import APIRouter, Request

from app.config import get_settings

router = APIRouter(prefix="/api/v1/health", tags=["health"])


@router.get("")
async def health(request: Request) -> dict[str, object]:
    settings = get_settings()
    return {
        "ok": True,
        "app": settings.app_name,
        "env": settings.app_env,
        "time": datetime.now(UTC).isoformat(),
        "model_provider": "openai-compatible" if settings.has_model_provider else "local-demo",
        "default_tickers": settings.default_ticker_list,
        "volume_multiplier": settings.default_volume_multiplier,
    }
