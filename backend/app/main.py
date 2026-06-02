from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import health, platform, stocks
from app.services.openai_analyzer import OpenAIAnalyzer
from app.services.recommender import RecommendationEngine
from app.services.stock_data import YFinanceStockDataProvider
from app.services.telegram import TelegramNotifier


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    app.state.recommender = RecommendationEngine(
        data_provider=YFinanceStockDataProvider(),
        analyzer=OpenAIAnalyzer(settings),
        notifier=TelegramNotifier(settings),
        settings=settings,
    )
    yield


settings = get_settings()

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

app.include_router(health.router)
app.include_router(platform.router)
app.include_router(stocks.router)


@app.get("/")
async def root() -> dict[str, str]:
    return {
        "name": settings.app_name,
        "docs": "/docs",
        "health": "/api/v1/health",
        "recommendations": "/api/v1/recommendations/run",
    }
