from pathlib import Path

from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import app
from app.services.stocks import MarketCandle, StockService


def candles() -> list[MarketCandle]:
    return [
        MarketCandle(
            trading_day=f"2026-04-{(day % 28) + 1:02d}",
            close=70_000 + day * 100,
            volume=1_000_000 + day * 10_000,
        )
        for day in range(1, 41)
    ]


def create_owner(client: TestClient) -> dict[str, str]:
    response = client.post(
        "/api/v1/auth/signup",
        json={"email": "owner@example.com", "password": "password123", "name": "Owner"},
    )
    assert response.status_code == 201
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def cache_by_name(payload: dict, name: str) -> dict:
    return next(cache for cache in payload["caches"] if cache["name"] == name)


def test_operations_overview_reports_runtime_ai_cache_database_and_errors(monkeypatch):
    async def fake_fetch(self: StockService, provider_symbol: str):
        return candles()

    monkeypatch.setattr(StockService, "fetch_yahoo_candles", fake_fetch)
    settings = get_settings()

    with TestClient(app) as client:
        auth = create_owner(client)
        client.app.state.ai_guardrail.reserve()

        backup_dir = settings.data_dir / "backups"
        backup_dir.mkdir(parents=True)
        Path(backup_dir / "jay_ai_platform-20260815.db").touch()

        first_market = client.get("/api/v1/stocks/market/005930", headers=auth)
        second_market = client.get("/api/v1/stocks/market/005930", headers=auth)
        failed_disclosure = client.get("/api/v1/disclosures/005930", headers=auth)
        response = client.get("/api/v1/admin/operations", headers=auth)

    assert first_market.status_code == 200
    assert second_market.status_code == 200
    assert failed_disclosure.status_code == 503
    assert response.status_code == 200

    payload = response.json()
    assert payload["status"] == "attention"
    assert payload["runtime"]["total_requests"] >= 5
    assert payload["runtime"]["server_error_count"] == 1
    assert payload["runtime"]["status_counts"]["5xx"] == 1
    assert payload["database"]["healthy"] is True
    assert payload["database"]["journal_mode"] == "wal"
    assert payload["backup"]["available"] is True
    assert payload["backup"]["backup_count"] == 1
    assert payload["ai_usage"]["today_count"] == 1
    assert payload["ai_usage"]["daily_limit"] == 100
    assert payload["ai_usage"]["history"][-1]["request_count"] == 1

    yahoo_cache = cache_by_name(payload, "yahoo_market")
    assert yahoo_cache["requests"] == 2
    assert yahoo_cache["hits"] == 1
    assert yahoo_cache["misses"] == 1
    assert yahoo_cache["loads"] == 1
    assert yahoo_cache["hit_rate"] == 0.5

    integrations = {item["name"]: item for item in payload["integrations"]}
    assert integrations["Yahoo Finance"]["configured"] is True
    assert integrations["OpenDART"]["configured"] is False
    assert payload["errors_last_24h"] == 1
    assert payload["recent_errors"][0]["path"] == "/api/v1/disclosures/005930"
    assert payload["recent_errors"][0]["status_code"] == 503
    assert "detail" not in payload["recent_errors"][0]


def test_operations_overview_requires_admin_role():
    with TestClient(app) as client:
        owner_auth = create_owner(client)
        pending = client.post(
            "/api/v1/auth/signup",
            json={
                "email": "member@example.com",
                "password": "password123",
                "name": "Member",
            },
        )
        member_id = pending.json()["user"]["id"]
        approved = client.patch(
            f"/api/v1/admin/users/{member_id}",
            headers=owner_auth,
            json={"is_active": True},
        )
        member_login = client.post(
            "/api/v1/auth/login",
            json={"email": "member@example.com", "password": "password123"},
        )
        member_auth = {
            "Authorization": f"Bearer {member_login.json()['access_token']}"
        }

        anonymous = client.get("/api/v1/admin/operations")
        member = client.get("/api/v1/admin/operations", headers=member_auth)

    assert approved.status_code == 200
    assert anonymous.status_code == 401
    assert member.status_code == 403
