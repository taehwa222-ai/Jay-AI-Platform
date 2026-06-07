from fastapi.testclient import TestClient

from app.main import app


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
