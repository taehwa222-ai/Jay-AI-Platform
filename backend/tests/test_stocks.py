import pytest

from app.config import Settings
from app.schemas.stocks import RecommendationRequest, StockCandle
from app.services.indicators import calculate_macd, calculate_rsi
from app.services.openai_analyzer import OpenAIAnalyzer
from app.services.recommender import RecommendationEngine, build_candidate


class FakeProvider:
    async def fetch_history(self, symbol: str, period: str, interval: str) -> list[StockCandle]:
        previous_volume = 1000
        latest_volume = 2500 if symbol == "SPIKE" else 1100
        candles = [
            StockCandle(
                date=f"2026-01-{day:02d}",
                open=float(day),
                high=float(day + 1),
                low=float(day - 1),
                close=float(100 + day),
                volume=previous_volume,
            )
            for day in range(1, 40)
        ]
        candles[-1] = candles[-1].model_copy(update={"volume": latest_volume, "close": 145.0})
        return candles


def test_health_endpoint():
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as client:
        response = client.get("/api/v1/health")

    assert response.status_code == 200
    assert response.json()["ok"] is True
    assert "default_tickers" in response.json()


def test_indicator_calculations_have_values_with_enough_history():
    closes = [float(100 + index) for index in range(60)]

    assert calculate_rsi(closes) is not None
    macd, signal, histogram = calculate_macd(closes)
    assert macd is not None
    assert signal is not None
    assert histogram is not None


def test_candidate_requires_volume_spike():
    candles = [
        StockCandle(date=str(index), open=1, high=1, low=1, close=100 + index, volume=1000)
        for index in range(40)
    ]
    candles[-1] = candles[-1].model_copy(update={"volume": 2500})

    candidate = build_candidate("SPIKE", candles, volume_multiplier=2.0)

    assert candidate is not None
    assert candidate.symbol == "SPIKE"
    assert candidate.volume_ratio == 2.5


@pytest.mark.anyio
async def test_recommendation_engine_filters_by_custom_volume_rule():
    settings = Settings(openai_api_key="", openai_model="")
    engine = RecommendationEngine(
        data_provider=FakeProvider(),
        analyzer=OpenAIAnalyzer(settings),
        settings=settings,
    )

    result = await engine.run(
        RecommendationRequest(tickers=["SPIKE", "NORMAL"], volume_multiplier=2.0)
    )

    assert result.scanned == ["SPIKE", "NORMAL"]
    assert [candidate.symbol for candidate in result.candidates] == ["SPIKE"]
    assert "Local analyst mode" in result.analysis
