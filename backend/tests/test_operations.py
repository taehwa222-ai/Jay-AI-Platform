import sqlite3

import httpx
from fastapi.testclient import TestClient
from scripts.backup_db import backup_database

from app.config import get_settings
from app.main import app
from app.services.disclosures import Disclosure
from app.services.stocks import StockService


def create_owner(client: TestClient) -> dict[str, str]:
    response = client.post(
        "/api/v1/auth/signup",
        json={"email": "owner@example.com", "password": "password123", "name": "Owner"},
    )
    assert response.status_code == 201
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


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
    }


def test_database_runs_in_wal_mode_and_daily_backup_is_consistent():
    settings = get_settings()
    with TestClient(app) as client:
        create_owner(client)
        with sqlite3.connect(settings.database_path) as connection:
            journal_mode = connection.execute("PRAGMA journal_mode").fetchone()[0]

        destination, created = backup_database(settings.data_dir)
        same_destination, created_again = backup_database(settings.data_dir)

    assert journal_mode.lower() == "wal"
    assert created is True
    assert created_again is False
    assert destination == same_destination
    with sqlite3.connect(destination) as backup:
        assert backup.execute("PRAGMA integrity_check").fetchone()[0] == "ok"
        assert backup.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 1


def test_daily_ai_guardrail_blocks_requests_after_configured_limit(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "openai_api_key", "test-key")
    monkeypatch.setattr(settings, "ai_daily_limit", 1)

    async def fake_ai_summary(self: StockService, payload, metrics):
        return "테스트 AI 요약", True

    monkeypatch.setattr(StockService, "build_ai_summary", fake_ai_summary)

    with TestClient(app) as client:
        auth = create_owner(client)
        first = client.post("/api/v1/stocks/analyze", headers=auth, json=analysis_payload())
        second = client.post("/api/v1/stocks/analyze", headers=auth, json=analysis_payload())

    assert first.status_code == 200
    assert first.json()["ai_powered"] is True
    assert second.status_code == 429
    assert "Daily AI request limit" in second.json()["detail"]


def test_telegram_test_endpoint_reports_configuration_and_sends(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "telegram_bot_token", "bot-token")
    monkeypatch.setattr(settings, "telegram_chat_id", "chat-id")
    requests: list[tuple[str, dict]] = []

    class FakeAsyncClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, traceback):
            return None

        async def post(self, url, json):
            requests.append((url, json))
            response = httpx.Response(200, json={"ok": True})
            response.request = httpx.Request("POST", url)
            return response

    monkeypatch.setattr(httpx, "AsyncClient", FakeAsyncClient)
    with TestClient(app) as client:
        response = client.post("/api/v1/notifications/telegram/test", headers=create_owner(client))

    assert response.status_code == 200
    assert response.json() == {"configured": True, "sent": True, "item_count": 0}
    assert requests[0][1]["chat_id"] == "chat-id"


def test_important_disclosure_endpoint_filters_and_pushes(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "telegram_bot_token", "bot-token")
    monkeypatch.setattr(settings, "telegram_chat_id", "chat-id")
    pushed: list[tuple[str, list[Disclosure]]] = []

    async def fake_disclosures(ticker: str) -> list[Disclosure]:
        return [
            Disclosure(
                title="단일판매ㆍ공급계약체결",
                date="20260815",
                receipt_no="1",
                url="https://dart.example/1",
            ),
            Disclosure(
                title="기업설명회(IR)개최",
                date="20260815",
                receipt_no="2",
                url="https://dart.example/2",
            ),
        ]

    async def fake_notify(ticker: str, disclosures: list[Disclosure]) -> bool:
        pushed.append((ticker, disclosures))
        return True

    with TestClient(app) as client:
        auth = create_owner(client)
        monkeypatch.setattr(
            client.app.state.disclosure_service,
            "get_recent_disclosures",
            fake_disclosures,
        )
        monkeypatch.setattr(
            client.app.state.telegram_service,
            "notify_disclosures",
            fake_notify,
        )
        response = client.post(
            "/api/v1/notifications/telegram/disclosures/005930",
            headers=auth,
        )

    assert response.status_code == 200
    assert response.json() == {"configured": True, "sent": True, "item_count": 1}
    assert pushed[0][0] == "005930"
    assert [item.receipt_no for item in pushed[0][1]] == ["1"]


def test_notification_center_reports_usage_and_retries_failed_delivery(monkeypatch):
    settings = get_settings()

    with TestClient(app) as client:
        auth = create_owner(client)
        failed = client.post("/api/v1/notifications/telegram/test", headers=auth)
        center = client.get("/api/v1/notifications/status", headers=auth)

        assert failed.status_code == 200
        assert failed.json()["sent"] is False
        assert center.status_code == 200
        payload = center.json()
        assert payload["configured"] is False
        assert payload["chat_target"] == "미설정"
        assert payload["ai_daily_count"] == 0
        assert payload["ai_daily_limit"] == 100
        assert payload["events"][0]["status"] == "failed"
        event_id = payload["events"][0]["id"]

        monkeypatch.setattr(settings, "telegram_bot_token", "bot-token")
        monkeypatch.setattr(settings, "telegram_chat_id", "12345678")

        class FakeAsyncClient:
            def __init__(self, *args, **kwargs):
                pass

            async def __aenter__(self):
                return self

            async def __aexit__(self, exc_type, exc, traceback):
                return None

            async def post(self, url, json):
                response = httpx.Response(200, json={"ok": True})
                response.request = httpx.Request("POST", url)
                return response

        monkeypatch.setattr(httpx, "AsyncClient", FakeAsyncClient)
        retried = client.post(
            f"/api/v1/notifications/events/{event_id}/retry",
            headers=auth,
        )
        refreshed = client.get("/api/v1/notifications/status", headers=auth)

    assert retried.status_code == 200
    assert retried.json()["sent"] is True
    refreshed_event = refreshed.json()["events"][0]
    assert refreshed.json()["configured"] is True
    assert refreshed.json()["chat_target"] == "••••5678"
    assert refreshed_event["status"] == "sent"
    assert refreshed_event["attempt_count"] == 2
