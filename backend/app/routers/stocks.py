from fastapi import APIRouter, Request

from app.config import get_settings
from app.schemas.stocks import RecommendationRequest, RecommendationResponse
from app.services.recommender import RecommendationEngine

router = APIRouter(prefix="/api/v1/recommendations", tags=["recommendations"])


@router.get("/defaults")
async def recommendation_defaults() -> dict[str, object]:
    settings = get_settings()
    return {
        "tickers": settings.default_ticker_list,
        "volume_multiplier": settings.default_volume_multiplier,
        "period": "6mo",
        "interval": "1d",
        "telegram_configured": settings.has_telegram,
        "model_provider": "openai-compatible" if settings.has_model_provider else "local-demo",
    }


@router.post("/run", response_model=RecommendationResponse)
async def run_recommendations(
    payload: RecommendationRequest,
    request: Request,
) -> RecommendationResponse:
    engine: RecommendationEngine = request.app.state.recommender
    if payload.tickers:
        return await engine.run(payload)
    return await engine.run(
        payload.model_copy(update={"tickers": get_settings().default_ticker_list})
    )
