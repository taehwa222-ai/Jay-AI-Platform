import sqlite3

from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import app
from app.services.auth import AuthService, hash_password


def user_payload(
    email: str = "owner@example.com",
    name: str = "Owner",
) -> dict[str, str]:
    return {"email": email, "password": "password123", "name": name}


def signup_owner(client: TestClient) -> tuple[dict, dict[str, str]]:
    response = client.post("/api/v1/auth/signup", json=user_payload())
    assert response.status_code == 201
    payload = response.json()
    return payload, {"Authorization": f"Bearer {payload['access_token']}"}


def test_first_signup_is_owner_and_later_signup_waits_for_approval():
    with TestClient(app) as client:
        owner, _ = signup_owner(client)
        member = client.post(
            "/api/v1/auth/signup",
            json=user_payload("member@example.com", "Member"),
        )

    assert owner["user"]["role"] == "owner"
    assert owner["user"]["approval_status"] == "approved"
    assert owner["access_token"]
    assert member.status_code == 201
    assert member.json()["user"]["role"] == "member"
    assert member.json()["user"]["is_active"] is False
    assert member.json()["approval_status"] == "pending"
    assert member.json()["access_token"] is None
    assert "plan" not in member.json()["user"]


def test_owner_approves_member_then_member_can_login_and_use_workspaces():
    with TestClient(app) as client:
        _, owner_headers = signup_owner(client)
        pending = client.post(
            "/api/v1/auth/signup",
            json=user_payload("member@example.com", "Member"),
        ).json()["user"]
        pending_login = client.post(
            "/api/v1/auth/login",
            json={"email": "member@example.com", "password": "password123"},
        )
        approved = client.patch(
            f"/api/v1/admin/users/{pending['id']}",
            headers=owner_headers,
            json={"is_active": True},
        )
        login = client.post(
            "/api/v1/auth/login",
            json={"email": "member@example.com", "password": "password123"},
        )
        member_headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
        me = client.get("/api/v1/auth/me", headers=member_headers)
        stocks = client.get("/api/v1/stocks/holdings", headers=member_headers)
        content = client.get("/api/v1/content-ops/youtube", headers=member_headers)
        admin = client.get("/api/v1/admin/users", headers=member_headers)

    assert pending_login.status_code == 403
    assert "pending" in pending_login.json()["detail"].lower()
    assert approved.status_code == 200
    assert approved.json()["approval_status"] == "approved"
    assert login.status_code == 200
    assert me.json()["role"] == "member"
    assert stocks.status_code == 200
    assert content.status_code == 200
    assert admin.status_code == 403


def test_owner_and_admin_management_boundaries_protect_owner_account():
    with TestClient(app) as client:
        owner, owner_headers = signup_owner(client)
        admin_user = client.post(
            "/api/v1/auth/signup",
            json=user_payload("admin@example.com", "Admin"),
        ).json()["user"]
        member_user = client.post(
            "/api/v1/auth/signup",
            json=user_payload("member@example.com", "Member"),
        ).json()["user"]
        promoted = client.patch(
            f"/api/v1/admin/users/{admin_user['id']}",
            headers=owner_headers,
            json={"role": "admin", "is_active": True},
        )
        admin_login = client.post(
            "/api/v1/auth/login",
            json={"email": "admin@example.com", "password": "password123"},
        )
        admin_headers = {
            "Authorization": f"Bearer {admin_login.json()['access_token']}"
        }
        approved = client.patch(
            f"/api/v1/admin/users/{member_user['id']}",
            headers=admin_headers,
            json={"is_active": True},
        )
        forbidden_promotion = client.patch(
            f"/api/v1/admin/users/{member_user['id']}",
            headers=admin_headers,
            json={"role": "admin"},
        )
        protected_owner = client.patch(
            f"/api/v1/admin/users/{owner['user']['id']}",
            headers=admin_headers,
            json={"is_active": False},
        )

    assert promoted.status_code == 200
    assert promoted.json()["role"] == "admin"
    assert approved.status_code == 200
    assert forbidden_promotion.status_code == 403
    assert protected_owner.status_code == 400


def test_disabling_account_invalidates_existing_token():
    with TestClient(app) as client:
        _, owner_headers = signup_owner(client)
        member = client.post(
            "/api/v1/auth/signup",
            json=user_payload("member@example.com", "Member"),
        ).json()["user"]
        client.patch(
            f"/api/v1/admin/users/{member['id']}",
            headers=owner_headers,
            json={"is_active": True},
        )
        login = client.post(
            "/api/v1/auth/login",
            json={"email": "member@example.com", "password": "password123"},
        )
        member_headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
        client.patch(
            f"/api/v1/admin/users/{member['id']}",
            headers=owner_headers,
            json={"is_active": False},
        )
        me = client.get("/api/v1/auth/me", headers=member_headers)

    assert me.status_code == 401


def test_legacy_first_admin_is_migrated_to_protected_owner():
    settings = get_settings()
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(settings.database_path) as connection:
        connection.execute(
            """
            CREATE TABLE users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT NOT NULL UNIQUE,
                name TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'admin',
                password_hash TEXT NOT NULL,
                is_active INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL,
                last_login_at TEXT
            )
            """
        )
        connection.execute(
            """
            INSERT INTO users (email, name, role, password_hash, created_at)
            VALUES (?, ?, 'admin', ?, ?)
            """,
            (
                "legacy-owner@example.com",
                "Legacy Owner",
                hash_password("password123"),
                "2026-01-01T00:00:00Z",
            ),
        )

    service = AuthService(settings)
    service.init_db()
    migrated = service.get_user_by_email("legacy-owner@example.com")

    assert migrated is not None
    assert migrated.role == "owner"
    assert migrated.is_active is True
    assert migrated.approval_status == "approved"


def test_admin_routes_return_users_while_payment_routes_stay_removed():
    with TestClient(app) as client:
        _, headers = signup_owner(client)
        users = client.get("/api/v1/admin/users", headers=headers)
        upgrade = client.get("/api/v1/auth/pro-request", headers=headers)
        payment = client.get("/api/v1/payments/me", headers=headers)

    assert users.status_code == 200
    assert len(users.json()) == 1
    assert upgrade.status_code == 404
    assert payment.status_code == 404
