from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.routers import (
    admin,
    auth,
    content_ops,
    disclosures,
    health,
    notifications,
    platform,
    stocks,
    video_pipeline,
)
from app.services.ai_guardrail import AIDailyLimitReached, AIGuardrailService
from app.services.auth import AuthService
from app.services.content_ops import ContentOpsService
from app.services.disclosures import DisclosureService
from app.services.stocks import StockService
from app.services.telegram import TelegramService
from app.services.video_pipeline import VideoPipelineService

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    auth_service = AuthService(settings)
    auth_service.init_db()
    stock_service = StockService(settings)
    stock_service.init_db()
    disclosure_service = DisclosureService(settings)
    disclosure_service.init_db()
    content_service = ContentOpsService(settings)
    ai_guardrail = AIGuardrailService(settings)
    ai_guardrail.init_db()
    telegram_service = TelegramService(settings)
    telegram_service.init_db()
    video_pipeline_service = VideoPipelineService(settings)
    video_pipeline_service.init_db()
    app.state.auth_service = auth_service
    app.state.stock_service = stock_service
    app.state.disclosure_service = disclosure_service
    app.state.content_service = content_service
    app.state.ai_guardrail = ai_guardrail
    app.state.telegram_service = telegram_service
    app.state.video_pipeline_service = video_pipeline_service
    yield


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def enforce_ai_daily_limit(request: Request, call_next):
    is_ai_analysis = request.method == "POST" and request.url.path == "/api/v1/stocks/analyze"
    if is_ai_analysis and settings.openai_api_key.strip():
        try:
            request.app.state.ai_guardrail.reserve()
        except AIDailyLimitReached:
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={
                    "detail": (
                        f"Daily AI request limit ({settings.ai_daily_limit}) reached. "
                        "Use local analysis or continue tomorrow."
                    )
                },
            )
    return await call_next(request)

app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(health.router)
app.include_router(platform.router)
app.include_router(stocks.router)
app.include_router(disclosures.router)
app.include_router(content_ops.router)
app.include_router(notifications.router)
app.include_router(video_pipeline.router)


@app.get("/")
async def root() -> dict[str, str]:
    return {
        "name": settings.app_name,
        "docs": "/docs",
        "health": "/api/v1/health",
        "platform": "/api/v1/platform/overview",
        "auth": "/api/v1/auth/me",
        "stocks": "/api/v1/stocks/holdings",
    }
