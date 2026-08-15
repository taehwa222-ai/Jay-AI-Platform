from contextlib import asynccontextmanager
from time import perf_counter

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
    operations,
    platform,
    stocks,
    video_pipeline,
    workspace,
)
from app.services.ai_guardrail import AIDailyLimitReached, AIGuardrailService
from app.services.auth import AuthService
from app.services.content_ops import ContentOpsService
from app.services.disclosures import DisclosureService
from app.services.operations import OperationsService
from app.services.stocks import StockService
from app.services.telegram import TelegramService
from app.services.video_pipeline import VideoPipelineService
from app.services.workspace import WorkspaceService

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
    operations_service = OperationsService(settings)
    operations_service.init_db()
    video_pipeline_service = VideoPipelineService(settings)
    video_pipeline_service.init_db()
    workspace_service = WorkspaceService(settings)
    workspace_service.init_db()
    app.state.auth_service = auth_service
    app.state.stock_service = stock_service
    app.state.disclosure_service = disclosure_service
    app.state.content_service = content_service
    app.state.ai_guardrail = ai_guardrail
    app.state.telegram_service = telegram_service
    app.state.operations_service = operations_service
    app.state.video_pipeline_service = video_pipeline_service
    app.state.workspace_service = workspace_service
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
async def collect_operations_metrics(request: Request, call_next):
    service: OperationsService | None = getattr(
        request.app.state,
        "operations_service",
        None,
    )
    if service is None:
        return await call_next(request)

    service.request_started()
    started_at = perf_counter()
    try:
        response = await call_next(request)
    except Exception as exc:
        service.request_finished(
            method=request.method,
            path=request.url.path,
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            duration_ms=(perf_counter() - started_at) * 1000,
            error_type=type(exc).__name__,
        )
        raise
    service.request_finished(
        method=request.method,
        path=request.url.path,
        status_code=response.status_code,
        duration_ms=(perf_counter() - started_at) * 1000,
    )
    return response


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
app.include_router(operations.router)
app.include_router(video_pipeline.router)
app.include_router(workspace.router)


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
