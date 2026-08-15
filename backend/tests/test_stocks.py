from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.main import app
from app.services.stocks import (
    MarketCandle,
    StockService,
    build_market_snapshot,
    calculate_macd,
    calculate_rsi,
)


def signup(client: TestClient) -> str:
    response = client.post(
        "/api/v1/auth/signup",
        json={"email": "owner@example.com", "password": "password123", "name": "Owner"},
    )
    assert response.status_code == 201
    return str(response.json()["access_token"])


def headers(client: TestClient) -> dict[str, str]:
    return {"Authorization": f"Bearer {signup(client)}"}


def analysis_payload() -> dict[str, object]:
    return {
        "ticker": "005930",
        "name": "삼성전자",
        "current_price": 76000,
        "previous_close": 74000,
        "volume": 2_500_000,
        "previous_volume": 1_000_000,
        "rsi": 54,
        "macd": 150,
        "macd_signal": 100,
        "memo": "거래량 급증 후보",
    }


def candles(ticker: str = "005930") -> list[MarketCandle]:
    return [
        MarketCandle(
            trading_day=f"2026-04-{(day % 28) + 1:02d}",
            close=70000 + day * 100,
            volume=1_000_000 + day * 10_000,
        )
        for day in range(1, 41)
    ]


def test_stock_endpoints_require_owner_login():
    with TestClient(app) as client:
        holdings = client.get("/api/v1/stocks/holdings")
        watchlist = client.get("/api/v1/stocks/watchlist")
        market = client.get("/api/v1/stocks/market/005930")

    assert holdings.status_code == 401
    assert watchlist.status_code == 401
    assert market.status_code == 401


def test_owner_can_manage_holdings_and_watchlist():
    with TestClient(app) as client:
        auth = headers(client)
        holding = client.post(
            "/api/v1/stocks/holdings",
            headers=auth,
            json={
                "ticker": "005930",
                "name": "삼성전자",
                "quantity": 10,
                "average_price": 70000,
                "current_price": 73500,
                "investment_thesis": "반도체 업황 회복",
                "risk_memo": "환율 변동",
            },
        )
        holding_id = holding.json()["id"]
        updated = client.patch(
            f"/api/v1/stocks/holdings/{holding_id}",
            headers=auth,
            json={"current_price": 75000},
        )
        watch = client.post(
            "/api/v1/stocks/watchlist",
            headers=auth,
            json={"ticker": "000660", "name": "SK하이닉스", "note": "HBM"},
        )
        duplicate = client.post(
            "/api/v1/stocks/watchlist",
            headers=auth,
            json={"ticker": "000660"},
        )
        listed_holdings = client.get("/api/v1/stocks/holdings", headers=auth)
        listed_watchlist = client.get("/api/v1/stocks/watchlist", headers=auth)
        deleted_holding = client.delete(
            f"/api/v1/stocks/holdings/{holding_id}", headers=auth
        )
        deleted_watch = client.delete(
            f"/api/v1/stocks/watchlist/{watch.json()['id']}", headers=auth
        )

    assert holding.status_code == 201
    assert holding.json()["profit_loss"] == 35000
    assert updated.json()["current_price"] == 75000
    assert duplicate.status_code == 409
    assert len(listed_holdings.json()) == 1
    assert len(listed_watchlist.json()) == 1
    assert deleted_holding.status_code == 204
    assert deleted_watch.status_code == 204


def test_owner_can_refresh_holding_prices(monkeypatch):
    async def fake_market_snapshot(self: StockService, ticker: str):
        return build_market_snapshot(ticker, f"{ticker}.KS", candles(ticker))

    monkeypatch.setattr(StockService, "market_snapshot", fake_market_snapshot)
    with TestClient(app) as client:
        auth = headers(client)
        client.post(
            "/api/v1/stocks/holdings",
            headers=auth,
            json={
                "ticker": "005930",
                "name": "삼성전자",
                "quantity": 10,
                "average_price": 70000,
                "current_price": 73500,
            },
        )
        response = client.post("/api/v1/stocks/holdings/refresh-prices", headers=auth)

    assert response.status_code == 200
    assert response.json()["failed"] == []
    assert response.json()["updated"][0]["current_price"] == 74000


def test_analysis_is_saved_and_internal_report_can_be_downloaded():
    with TestClient(app) as client:
        auth = headers(client)
        analysis = client.post("/api/v1/stocks/analyze", headers=auth, json=analysis_payload())
        records = client.get("/api/v1/stocks/analysis-records", headers=auth)
        record_id = records.json()[0]["id"]
        report = client.post(
            f"/api/v1/stocks/reports/from-analysis/{record_id}", headers=auth
        )
        report_id = report.json()["id"]
        download = client.get(f"/api/v1/stocks/reports/{report_id}/download", headers=auth)
        removed_market = client.get("/api/v1/stocks/reports/market", headers=auth)

    assert analysis.status_code == 200
    assert analysis.json()["ai_powered"] is False
    assert records.json()[0]["memo"] == "거래량 급증 후보"
    assert report.status_code == 201
    assert report.json()["report_type"] == "internal_analysis"
    assert "access_level" not in report.json()
    assert "내부 검토용" in report.json()["body"]
    assert download.status_code == 200
    assert removed_market.status_code == 405


def test_market_snapshot_uses_five_minute_cache(monkeypatch):
    calls = 0

    async def fake_fetch(self: StockService, provider_symbol: str):
        nonlocal calls
        calls += 1
        return candles()

    monkeypatch.setattr(StockService, "fetch_yahoo_candles", fake_fetch)
    with TestClient(app) as client:
        auth = headers(client)
        first = client.get("/api/v1/stocks/market/005930", headers=auth)
        second = client.get("/api/v1/stocks/market/005930", headers=auth)

    assert first.status_code == 200
    assert second.status_code == 200
    assert first.json() == second.json()
    assert calls == 1


def test_stock_scan_ranks_candidates_and_reports_failures(monkeypatch):
    async def fake_market_snapshot(self: StockService, ticker: str):
        if ticker == "BAD":
            raise HTTPException(status_code=404, detail="not found")
        volume_step = 50_000 if ticker == "000660" else 10_000
        series = [
            MarketCandle(
                trading_day=f"2026-03-{(day % 28) + 1:02d}",
                close=60000 + day * 200,
                volume=1_000_000 + day * volume_step,
            )
            for day in range(1, 41)
        ]
        return build_market_snapshot(ticker, f"{ticker}.KS", series)

    monkeypatch.setattr(StockService, "market_snapshot", fake_market_snapshot)
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/stocks/scan",
            headers=headers(client),
            json={"tickers": ["005930", "000660", "BAD"]},
        )

    assert response.status_code == 200
    assert len(response.json()["candidates"]) == 2
    assert response.json()["failed"] == [{"ticker": "BAD", "reason": "not found"}]


def test_indicator_calculation_and_market_snapshot():
    closes = [100 + index for index in range(40)]
    rsi = calculate_rsi(closes)
    macd, macd_signal = calculate_macd(closes)
    snapshot = build_market_snapshot("000660", "000660.KS", candles("000660"))

    assert rsi == 100
    assert macd > macd_signal
    assert snapshot.current_price == 74000
    assert snapshot.previous_close == 73900
    assert snapshot.volume_multiplier > 1
