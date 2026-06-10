from fastapi.testclient import TestClient

from app.main import app


def test_signup_first_user_becomes_admin():
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/auth/signup",
            json={"email": "admin@example.com", "password": "password123", "name": "Admin"},
        )

    assert response.status_code == 201
    body = response.json()
    assert body["access_token"]
    assert body["user"]["email"] == "admin@example.com"
    assert body["user"]["role"] == "admin"


def test_login_and_me():
    with TestClient(app) as client:
        signup = client.post(
            "/api/v1/auth/signup",
            json={"email": "owner@example.com", "password": "password123", "name": "Owner"},
        )
        token = signup.json()["access_token"]

        me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})

        login = client.post(
            "/api/v1/auth/login",
            json={"email": "owner@example.com", "password": "password123"},
        )

    assert me.status_code == 200
    assert me.json()["email"] == "owner@example.com"
    assert login.status_code == 200
    assert login.json()["user"]["role"] == "admin"


def test_admin_can_list_users_and_member_cannot():
    with TestClient(app) as client:
        admin_signup = client.post(
            "/api/v1/auth/signup",
            json={"email": "admin@example.com", "password": "password123", "name": "Admin"},
        )
        member_signup = client.post(
            "/api/v1/auth/signup",
            json={"email": "member@example.com", "password": "password123", "name": "Member"},
        )

        admin_token = admin_signup.json()["access_token"]
        member_token = member_signup.json()["access_token"]

        admin_response = client.get(
            "/api/v1/admin/users",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        member_response = client.get(
            "/api/v1/admin/users",
            headers={"Authorization": f"Bearer {member_token}"},
        )

    assert admin_response.status_code == 200
    assert len(admin_response.json()) == 2
    assert member_response.status_code == 403


def test_admin_can_view_user_usage_and_member_cannot():
    with TestClient(app) as client:
        admin_signup = client.post(
            "/api/v1/auth/signup",
            json={"email": "admin@example.com", "password": "password123", "name": "Admin"},
        )
        member_signup = client.post(
            "/api/v1/auth/signup",
            json={"email": "member@example.com", "password": "password123", "name": "Member"},
        )
        admin_token = admin_signup.json()["access_token"]
        member_token = member_signup.json()["access_token"]

        analysis = client.post(
            "/api/v1/stocks/analyze",
            headers={"Authorization": f"Bearer {member_token}"},
            json={
                "ticker": "005930",
                "name": "삼성전자",
                "current_price": 76000,
                "previous_close": 74000,
                "volume": 2_000_000,
                "previous_volume": 1_000_000,
                "rsi": 55,
                "macd": 10,
                "macd_signal": 8,
            },
        )
        admin_response = client.get(
            "/api/v1/admin/user-usage",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        member_response = client.get(
            "/api/v1/admin/user-usage",
            headers={"Authorization": f"Bearer {member_token}"},
        )

    assert analysis.status_code == 200
    assert admin_response.status_code == 200
    member_usage = next(
        item for item in admin_response.json() if item["email"] == "member@example.com"
    )
    assert member_usage["analysis_count"] == 1
    assert member_usage["latest_analysis_at"]
    assert member_response.status_code == 403


def test_duplicate_email_is_rejected():
    with TestClient(app) as client:
        first = client.post(
            "/api/v1/auth/signup",
            json={"email": "same@example.com", "password": "password123", "name": "First"},
        )
        second = client.post(
            "/api/v1/auth/signup",
            json={"email": "same@example.com", "password": "password123", "name": "Second"},
        )

    assert first.status_code == 201
    assert second.status_code == 409


def test_admin_can_update_member_role_and_active_state():
    with TestClient(app) as client:
        admin_signup = client.post(
            "/api/v1/auth/signup",
            json={"email": "admin@example.com", "password": "password123", "name": "Admin"},
        )
        member_signup = client.post(
            "/api/v1/auth/signup",
            json={"email": "member@example.com", "password": "password123", "name": "Member"},
        )

        admin_token = admin_signup.json()["access_token"]
        member_id = member_signup.json()["user"]["id"]

        promoted = client.patch(
            f"/api/v1/admin/users/{member_id}",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"role": "admin"},
        )
        disabled = client.patch(
            f"/api/v1/admin/users/{member_id}",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"is_active": False},
        )
        login = client.post(
            "/api/v1/auth/login",
            json={"email": "member@example.com", "password": "password123"},
        )

    assert promoted.status_code == 200
    assert promoted.json()["role"] == "admin"
    assert disabled.status_code == 200
    assert disabled.json()["is_active"] is False
    assert login.status_code == 403


def test_admin_cannot_disable_self_or_remove_last_admin():
    with TestClient(app) as client:
        admin_signup = client.post(
            "/api/v1/auth/signup",
            json={"email": "admin@example.com", "password": "password123", "name": "Admin"},
        )
        admin_token = admin_signup.json()["access_token"]
        admin_id = admin_signup.json()["user"]["id"]

        disable_self = client.patch(
            f"/api/v1/admin/users/{admin_id}",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"is_active": False},
        )
        demote_self = client.patch(
            f"/api/v1/admin/users/{admin_id}",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"role": "member"},
        )

    assert disable_self.status_code == 400
    assert demote_self.status_code == 400
