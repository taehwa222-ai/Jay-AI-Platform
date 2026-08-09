import httpx
from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import app


def signup_member(client: TestClient) -> str:
    client.post(
        "/api/v1/auth/signup",
        json={"email": "admin@example.com", "password": "password123", "name": "Admin"},
    )
    member = client.post(
        "/api/v1/auth/signup",
        json={"email": "member@example.com", "password": "password123", "name": "Member"},
    )
    return member.json()["access_token"]


class FakeResponse:
    def __init__(self, status_code: int, text: str):
        self.status_code = status_code
        self.text = text


def test_order_creation_validates_price_and_returns_toss_client_key(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "toss_client_key", "test-client-key")

    with TestClient(app) as client:
        token = signup_member(client)
        headers = {"Authorization": f"Bearer {token}"}
        created = client.post(
            "/api/v1/payments/orders",
            headers=headers,
            json={"amount": settings.pro_upgrade_price_krw},
        )
        rejected = client.post(
            "/api/v1/payments/orders",
            headers=headers,
            json={"amount": settings.pro_upgrade_price_krw - 1},
        )

    assert created.status_code == 201
    assert created.json()["order_id"]
    assert created.json()["amount"] == settings.pro_upgrade_price_krw
    assert created.json()["client_key"] == "test-client-key"
    assert rejected.status_code == 422


def test_confirm_success_upgrades_user_to_pro(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "toss_secret_key", "test-secret-key")
    calls: dict[str, object] = {}

    def fake_post(url: str, **kwargs: object) -> FakeResponse:
        calls["url"] = url
        calls.update(kwargs)
        return FakeResponse(200, '{"status":"DONE"}')

    monkeypatch.setattr(httpx, "post", fake_post)

    with TestClient(app) as client:
        token = signup_member(client)
        headers = {"Authorization": f"Bearer {token}"}
        order = client.post(
            "/api/v1/payments/orders",
            headers=headers,
            json={"amount": settings.pro_upgrade_price_krw},
        )
        order_id = order.json()["order_id"]
        confirmed = client.post(
            "/api/v1/payments/confirm",
            headers=headers,
            json={
                "order_id": order_id,
                "payment_key": "test-payment-key",
                "amount": settings.pro_upgrade_price_krw,
            },
        )
        me = client.get("/api/v1/auth/me", headers=headers)

    assert confirmed.status_code == 200
    assert confirmed.json()["status"] == "approved"
    assert confirmed.json()["order_id"] == order_id
    assert me.status_code == 200
    assert me.json()["plan"] == "pro"
    assert calls["url"] == "https://api.tosspayments.com/v1/payments/confirm"
    assert calls["auth"] == ("test-secret-key", "")
    assert calls["json"] == {
        "paymentKey": "test-payment-key",
        "orderId": order_id,
        "amount": settings.pro_upgrade_price_krw,
    }


def test_confirm_rejects_amount_mismatch_without_calling_toss(monkeypatch):
    called = False

    def fake_post(*args: object, **kwargs: object) -> FakeResponse:
        nonlocal called
        called = True
        return FakeResponse(200, "")

    monkeypatch.setattr(httpx, "post", fake_post)

    with TestClient(app) as client:
        token = signup_member(client)
        headers = {"Authorization": f"Bearer {token}"}
        order = client.post(
            "/api/v1/payments/orders",
            headers=headers,
            json={"amount": 9900},
        )
        confirmed = client.post(
            "/api/v1/payments/confirm",
            headers=headers,
            json={
                "order_id": order.json()["order_id"],
                "payment_key": "test-payment-key",
                "amount": 9800,
            },
        )

    assert confirmed.status_code == 422
    assert called is False


def test_toss_failure_marks_payment_failed_without_upgrading_user(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "toss_secret_key", "test-secret-key")

    def fake_post(*args: object, **kwargs: object) -> FakeResponse:
        return FakeResponse(400, '{"code":"INVALID_PAYMENT"}')

    monkeypatch.setattr(httpx, "post", fake_post)

    with TestClient(app) as client:
        token = signup_member(client)
        headers = {"Authorization": f"Bearer {token}"}
        order = client.post(
            "/api/v1/payments/orders",
            headers=headers,
            json={"amount": settings.pro_upgrade_price_krw},
        )
        confirmed = client.post(
            "/api/v1/payments/confirm",
            headers=headers,
            json={
                "order_id": order.json()["order_id"],
                "payment_key": "bad-payment-key",
                "amount": settings.pro_upgrade_price_krw,
            },
        )
        payments = client.get("/api/v1/payments/me", headers=headers)
        me = client.get("/api/v1/auth/me", headers=headers)

    assert confirmed.status_code == 422
    assert "INVALID_PAYMENT" in confirmed.json()["detail"]
    assert payments.status_code == 200
    assert payments.json()[0]["status"] == "failed"
    assert me.status_code == 200
    assert me.json()["plan"] == "free"
