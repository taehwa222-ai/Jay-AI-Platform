from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import admin, auth, health, platform, stocks
from app.services.auth import AuthService
from app.services.stocks import StockService

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    auth_service = AuthService(settings)
    auth_service.init_db()
    stock_service = StockService(settings)
    stock_service.init_db()
    app.state.auth_service = auth_service
    app.state.stock_service = stock_service
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

app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(health.router)
app.include_router(platform.router)
app.include_router(stocks.router)


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
