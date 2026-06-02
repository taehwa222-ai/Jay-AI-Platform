from fastapi import APIRouter

router = APIRouter(prefix="/api/v1/platform", tags=["platform"])


@router.get("/roadmap")
async def roadmap() -> dict[str, object]:
    return {
        "phases": [
            {
                "id": "mvp",
                "title": "Stock Recommender MVP",
                "status": "active",
                "items": ["FastAPI API", "stock scan", "volume filter", "RSI/MACD", "web result"],
            },
            {
                "id": "alerts",
                "title": "Alert Automation",
                "status": "next",
                "items": ["Telegram", "scheduled runs", "watchlists", "alert logs"],
            },
            {
                "id": "portfolio",
                "title": "Portfolio Rules",
                "status": "planned",
                "items": ["risk limits", "position sizing", "excluded symbols", "backtesting"],
            },
            {
                "id": "operations",
                "title": "Operations",
                "status": "planned",
                "items": ["auth", "logs", "database", "cloud deployment"],
            },
        ]
    }
