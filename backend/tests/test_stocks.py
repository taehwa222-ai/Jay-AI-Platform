from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import app
from app.services.stocks import (
    MarketCandle,
    StockService,
    build_market_snapshot,
    calculate_macd,
    calculate_rsi,
)


def signup(client: TestClient, email: str = "owner@example.com") -> str:
    response = client.post(
        "/api/v1/auth/signup",
        json={"email": email, "password": "password123", "name": "Owner"},
    )
    assert response.status_code == 201
    return str(response.json()["access_token"])


def test_holdings_require_login():
    with TestClient(app) as client:
        response = client.get("/api/v1/stocks/holdings")

    assert response.status_code == 401


def test_watchlist_requires_login():
    with TestClient(app) as client:
        response = client.get("/api/v1/stocks/watchlist")

    assert response.status_code == 401


def test_user_can_create_update_list_and_delete_holding():
    with TestClient(app) as client:
        token = signup(client)
        headers = {"Authorization": f"Bearer {token}"}

        created = client.post(
            "/api/v1/stocks/holdings",
            headers=headers,
            json={
                "ticker": "005930",
                "name": "삼성전자",
                "quantity": 10,
                "average_price": 70000,
                "current_price": 73500,
                "investment_thesis": "반도체 업황 회복 관찰",
                "risk_memo": "환율과 업황 변동",
            },
        )
        holding_id = created.json()["id"]
        updated = client.patch(
            f"/api/v1/stocks/holdings/{holding_id}",
            headers=headers,
            json={"current_price": 75000, "risk_memo": "단기 과열 여부 확인"},
        )
        holdings = client.get("/api/v1/stocks/holdings", headers=headers)
        deleted = client.delete(f"/api/v1/stocks/holdings/{holding_id}", headers=headers)
        empty = client.get("/api/v1/stocks/holdings", headers=headers)

    assert created.status_code == 201
    assert created.json()["ticker"] == "005930"
    assert created.json()["profit_loss"] == 35000
    assert updated.status_code == 200
    assert updated.json()["current_price"] == 75000
    assert holdings.status_code == 200
    assert len(holdings.json()) == 1
    assert deleted.status_code == 204
    assert empty.json() == []


def test_user_can_refresh_holding_prices(monkeypatch):
    async def fake_market_snapshot(self: StockService, ticker: str):
        candles = [
            MarketCandle(
                trading_day=f"2026-04-{(day % 28) + 1:02d}",
                close=80000 + day * 100,
                volume=1_000_000 + day * 10_000,
            )
            for day in range(1, 41)
        ]
        return build_market_snapshot(ticker, f"{ticker}.KS", candles)

    monkeypatch.setattr(StockService, "market_snapshot", fake_market_snapshot)

    with TestClient(app) as client:
        token = signup(client)
        headers = {"Authorization": f"Bearer {token}"}

        created = client.post(
            "/api/v1/stocks/holdings",
            headers=headers,
            json={
                "ticker": "005930",
                "name": "삼성전자",
                "quantity": 10,
                "average_price": 70000,
                "current_price": 73500,
            },
        )
        response = client.post("/api/v1/stocks/holdings/refresh-prices", headers=headers)
        holdings = client.get("/api/v1/stocks/holdings", headers=headers)

    assert created.status_code == 201
    assert response.status_code == 200
    body = response.json()
    assert len(body["updated"]) == 1
    assert body["failed"] == []
    assert body["updated"][0]["current_price"] == 84000
    assert holdings.json()[0]["current_price"] == 84000


def test_user_can_manage_watchlist_and_duplicates_are_rejected():
    with TestClient(app) as client:
        token = signup(client)
        headers = {"Authorization": f"Bearer {token}"}

        created = client.post(
            "/api/v1/stocks/watchlist",
            headers=headers,
            json={"ticker": "005930", "name": "삼성전자", "note": "반도체 대표주"},
        )
        duplicate = client.post(
            "/api/v1/stocks/watchlist",
            headers=headers,
            json={"ticker": "005930", "name": "삼성전자"},
        )
        item_id = created.json()["id"]
        updated = client.patch(
            f"/api/v1/stocks/watchlist/{item_id}",
            headers=headers,
            json={"note": "실적 발표 전 체크"},
        )
        items = client.get("/api/v1/stocks/watchlist", headers=headers)
        deleted = client.delete(f"/api/v1/stocks/watchlist/{item_id}", headers=headers)
        empty = client.get("/api/v1/stocks/watchlist", headers=headers)

    assert created.status_code == 201
    assert created.json()["ticker"] == "005930"
    assert duplicate.status_code == 409
    assert updated.status_code == 200
    assert updated.json()["note"] == "실적 발표 전 체크"
    assert len(items.json()) == 1
    assert deleted.status_code == 204
    assert empty.json() == []


def test_user_cannot_update_another_users_holding():
    with TestClient(app) as client:
        owner_token = signup(client, "owner@example.com")
        other_token = signup(client, "other@example.com")
        owner_headers = {"Authorization": f"Bearer {owner_token}"}
        other_headers = {"Authorization": f"Bearer {other_token}"}

        created = client.post(
            "/api/v1/stocks/holdings",
            headers=owner_headers,
            json={
                "ticker": "035720",
                "name": "카카오",
                "quantity": 5,
                "average_price": 45000,
                "current_price": 47000,
            },
        )
        holding_id = created.json()["id"]
        response = client.patch(
            f"/api/v1/stocks/holdings/{holding_id}",
            headers=other_headers,
            json={"current_price": 49000},
        )

    assert response.status_code == 404


def test_user_cannot_manage_another_users_watchlist_item():
    with TestClient(app) as client:
        owner_token = signup(client, "owner@example.com")
        other_token = signup(client, "other@example.com")
        owner_headers = {"Authorization": f"Bearer {owner_token}"}
        other_headers = {"Authorization": f"Bearer {other_token}"}

        created = client.post(
            "/api/v1/stocks/watchlist",
            headers=owner_headers,
            json={"ticker": "000660", "name": "SK하이닉스"},
        )
        item_id = created.json()["id"]
        update = client.patch(
            f"/api/v1/stocks/watchlist/{item_id}",
            headers=other_headers,
            json={"note": "다른 사용자 수정"},
        )
        delete = client.delete(f"/api/v1/stocks/watchlist/{item_id}", headers=other_headers)

    assert update.status_code == 404
    assert delete.status_code == 404


def test_stock_analysis_returns_rule_based_report_without_openai_key():
    with TestClient(app) as client:
        token = signup(client)
        response = client.post(
            "/api/v1/stocks/analyze",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "ticker": "000660",
                "name": "SK하이닉스",
                "current_price": 120000,
                "previous_close": 115000,
                "volume": 3_000_000,
                "previous_volume": 1_000_000,
                "rsi": 58,
                "macd": 1200,
                "macd_signal": 900,
                "memo": "AI 반도체 수요 관찰",
            },
        )

    assert response.status_code == 200
    body = response.json()
    assert body["ticker"] == "000660"
    assert body["score"] >= 75
    assert body["rating"] == "candidate"
    assert body["ai_powered"] is False
    assert body["volume_multiplier"] == 3
    assert body["disclaimer"]


def test_stock_analysis_is_saved_and_can_be_deleted():
    with TestClient(app) as client:
        token = signup(client)
        headers = {"Authorization": f"Bearer {token}"}
        analysis = client.post(
            "/api/v1/stocks/analyze",
            headers=headers,
            json={
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
            },
        )
        records = client.get("/api/v1/stocks/analysis-records", headers=headers)
        record_id = records.json()[0]["id"]
        deleted = client.delete(
            f"/api/v1/stocks/analysis-records/{record_id}",
            headers=headers,
        )
        empty = client.get("/api/v1/stocks/analysis-records", headers=headers)

    assert analysis.status_code == 200
    assert records.status_code == 200
    assert len(records.json()) == 1
    assert records.json()[0]["ticker"] == "005930"
    assert records.json()[0]["memo"] == "거래량 급증 후보"
    assert records.json()[0]["signals"]
    assert deleted.status_code == 204
    assert empty.json() == []


def test_user_can_create_list_and_delete_report_from_analysis_record():
    with TestClient(app) as client:
        token = signup(client)
        headers = {"Authorization": f"Bearer {token}"}
        analysis = client.post(
            "/api/v1/stocks/analyze",
            headers=headers,
            json={
                "ticker": "005930",
                "name": "Samsung Electronics",
                "current_price": 76000,
                "previous_close": 74000,
                "volume": 2_500_000,
                "previous_volume": 1_000_000,
                "rsi": 54,
                "macd": 150,
                "macd_signal": 100,
                "memo": "Volume spike candidate",
            },
        )
        records = client.get("/api/v1/stocks/analysis-records", headers=headers)
        record_id = records.json()[0]["id"]
        created = client.post(
            f"/api/v1/stocks/reports/from-analysis/{record_id}",
            headers=headers,
        )
        reports = client.get("/api/v1/stocks/reports", headers=headers)
        report_id = created.json()["id"]
        published = client.patch(
            f"/api/v1/stocks/reports/{report_id}/publish",
            headers=headers,
            json={"access_level": "pro", "is_published": True},
        )
        private = client.patch(
            f"/api/v1/stocks/reports/{report_id}/publish",
            headers=headers,
            json={"access_level": "private", "is_published": True},
        )
        download = client.get(f"/api/v1/stocks/reports/{report_id}/download", headers=headers)
        deleted = client.delete(f"/api/v1/stocks/reports/{report_id}", headers=headers)
        empty = client.get("/api/v1/stocks/reports", headers=headers)

    assert analysis.status_code == 200
    assert created.status_code == 201
    assert created.json()["analysis_record_id"] == record_id
    assert created.json()["ticker"] == "005930"
    assert created.json()["report_type"] == "paid_report_draft"
    assert created.json()["access_level"] == "private"
    assert created.json()["is_published"] is False
    assert "Action Checklist" in created.json()["body"]
    assert reports.status_code == 200
    assert len(reports.json()) == 1
    assert published.status_code == 200
    assert published.json()["access_level"] == "pro"
    assert published.json()["is_published"] is True
    assert private.status_code == 200
    assert private.json()["access_level"] == "private"
    assert private.json()["is_published"] is False
    assert download.status_code == 200
    assert "005930-report" in download.headers["content-disposition"]
    assert "# Samsung Electronics(005930) AI analysis report" in download.text
    assert deleted.status_code == 204
    assert empty.json() == []


def test_user_cannot_create_report_from_another_users_analysis_record():
    with TestClient(app) as client:
        owner_token = signup(client, "owner@example.com")
        other_token = signup(client, "other@example.com")
        owner_headers = {"Authorization": f"Bearer {owner_token}"}
        other_headers = {"Authorization": f"Bearer {other_token}"}
        client.post(
            "/api/v1/stocks/analyze",
            headers=owner_headers,
            json={
                "ticker": "005930",
                "name": "Samsung Electronics",
                "current_price": 76000,
                "previous_close": 74000,
                "volume": 2_500_000,
                "previous_volume": 1_000_000,
                "rsi": 54,
                "macd": 150,
                "macd_signal": 100,
            },
        )
        record_id = client.get("/api/v1/stocks/analysis-records", headers=owner_headers).json()[0][
            "id"
        ]
        response = client.post(
            f"/api/v1/stocks/reports/from-analysis/{record_id}",
            headers=other_headers,
        )

    assert response.status_code == 404


def test_user_cannot_download_another_users_report():
    with TestClient(app) as client:
        owner_token = signup(client, "owner@example.com")
        other_token = signup(client, "other@example.com")
        owner_headers = {"Authorization": f"Bearer {owner_token}"}
        other_headers = {"Authorization": f"Bearer {other_token}"}
        client.post(
            "/api/v1/stocks/analyze",
            headers=owner_headers,
            json={
                "ticker": "005930",
                "name": "Samsung Electronics",
                "current_price": 76000,
                "previous_close": 74000,
                "volume": 2_500_000,
                "previous_volume": 1_000_000,
                "rsi": 54,
                "macd": 150,
                "macd_signal": 100,
            },
        )
        record_id = client.get("/api/v1/stocks/analysis-records", headers=owner_headers).json()[0][
            "id"
        ]
        report = client.post(
            f"/api/v1/stocks/reports/from-analysis/{record_id}",
            headers=owner_headers,
        )
        response = client.get(
            f"/api/v1/stocks/reports/{report.json()['id']}/download",
            headers=other_headers,
        )

    assert response.status_code == 404


def test_free_plan_analysis_limit_and_pro_upgrade(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "free_monthly_analysis_limit", 1)

    with TestClient(app) as client:
        admin_token = signup(client, "admin@example.com")
        member_token = signup(client, "member@example.com")
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        member_headers = {"Authorization": f"Bearer {member_token}"}
        member_id = client.get("/api/v1/auth/me", headers=member_headers).json()["id"]
        payload = {
            "ticker": "005930",
            "name": "삼성전자",
            "current_price": 76000,
            "previous_close": 74000,
            "volume": 2_500_000,
            "previous_volume": 1_000_000,
            "rsi": 54,
            "macd": 150,
            "macd_signal": 100,
        }

        first = client.post("/api/v1/stocks/analyze", headers=member_headers, json=payload)
        limited = client.post("/api/v1/stocks/analyze", headers=member_headers, json=payload)
        upgrade = client.patch(
            f"/api/v1/admin/users/{member_id}",
            headers=admin_headers,
            json={"plan": "pro"},
        )
        member_login = client.post(
            "/api/v1/auth/login",
            json={"email": "member@example.com", "password": "password123"},
        )
        pro_headers = {"Authorization": f"Bearer {member_login.json()['access_token']}"}
        pro_analysis = client.post("/api/v1/stocks/analyze", headers=pro_headers, json=payload)

    assert first.status_code == 200
    assert limited.status_code == 403
    assert "monthly analysis limit" in limited.json()["detail"]
    assert upgrade.status_code == 200
    assert upgrade.json()["plan"] == "pro"
    assert pro_analysis.status_code == 200


def test_market_snapshot_requires_login():
    with TestClient(app) as client:
        response = client.get("/api/v1/stocks/market/005930")

    assert response.status_code == 401


def test_stock_scan_requires_login():
    with TestClient(app) as client:
        response = client.post("/api/v1/stocks/scan", json={"tickers": ["005930"]})

    assert response.status_code == 401


def test_market_snapshot_endpoint_uses_service(monkeypatch):
    async def fake_market_snapshot(self: StockService, ticker: str):
        candles = [
            MarketCandle(
                trading_day=f"2026-01-{day:02d}",
                close=70000 + day * 100,
                volume=1_000_000 + day * 10_000,
            )
            for day in range(1, 41)
        ]
        return build_market_snapshot(ticker, "005930.KS", candles)

    monkeypatch.setattr(StockService, "market_snapshot", fake_market_snapshot)

    with TestClient(app) as client:
        token = signup(client)
        response = client.get(
            "/api/v1/stocks/market/005930",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 200
    body = response.json()
    assert body["ticker"] == "005930"
    assert body["provider_symbol"] == "005930.KS"
    assert body["current_price"] > body["previous_close"]
    assert body["volume"] > body["previous_volume"]


def test_stock_scan_ranks_candidates_and_reports_failures(monkeypatch):
    async def fake_market_snapshot(self: StockService, ticker: str):
        if ticker == "BAD":
            from fastapi import HTTPException

            raise HTTPException(status_code=404, detail="not found")

        volume_step = 500_000 if ticker == "000660" else 10_000
        candles = [
            MarketCandle(
                trading_day=f"2026-03-{(day % 28) + 1:02d}",
                close=60000 + day * 200,
                volume=1_000_000 + day * volume_step,
            )
            for day in range(1, 41)
        ]
        return build_market_snapshot(ticker, f"{ticker}.KS", candles)

    monkeypatch.setattr(StockService, "market_snapshot", fake_market_snapshot)

    with TestClient(app) as client:
        token = signup(client)
        response = client.post(
            "/api/v1/stocks/scan",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "tickers": ["005930", "000660", "BAD"],
                "name_map": {"005930": "삼성전자", "000660": "SK하이닉스"},
                "memo": "거래량 급증 후보 확인",
            },
        )

    assert response.status_code == 200
    body = response.json()
    assert len(body["candidates"]) == 2
    assert body["candidates"][0]["ticker"] == "000660"
    assert body["candidates"][0]["score"] >= body["candidates"][1]["score"]
    assert body["failed"] == [{"ticker": "BAD", "reason": "not found"}]
    assert body["disclaimer"]


def test_indicator_calculation_and_market_snapshot():
    closes = [100 + index for index in range(40)]
    rsi = calculate_rsi(closes)
    macd, macd_signal = calculate_macd(closes)
    candles = [
        MarketCandle(
            trading_day=f"2026-02-{(index % 28) + 1:02d}",
            close=float(100 + index),
            volume=1_000 + index * 100,
        )
        for index in range(40)
    ]

    snapshot = build_market_snapshot("000660", "000660.KS", candles)

    assert rsi == 100
    assert macd > macd_signal
    assert snapshot.current_price == 139
    assert snapshot.previous_close == 138
    assert snapshot.rsi == 100
    assert snapshot.volume_multiplier > 1
