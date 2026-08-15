import sqlite3

from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import app
from app.services.auth import hash_password


def owner_payload(email: str = "owner@example.com") -> dict[str, str]:
    return {"email": email, "password": "password123", "name": "Owner"}


def test_first_signup_bootstraps_the_only_owner_account():
    with TestClient(app) as client:
        first = client.post("/api/v1/auth/signup", json=owner_payload())
        second = client.post(
            "/api/v1/auth/signup",
            json=owner_payload("another@example.com"),
        )

    assert first.status_code == 201
    assert first.json()["user"]["role"] == "admin"
    assert "plan" not in first.json()["user"]
    assert second.status_code == 409
    assert "already initialized" in second.json()["detail"]


def test_owner_can_login_and_restore_session():
    with TestClient(app) as client:
        signup = client.post("/api/v1/auth/signup", json=owner_payload())
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


def test_inactive_or_legacy_non_owner_account_cannot_login():
    with TestClient(app) as client:
        client.post("/api/v1/auth/signup", json=owner_payload())
        with sqlite3.connect(get_settings().database_path) as connection:
            connection.execute("UPDATE users SET is_active = 0")
        response = client.post(
            "/api/v1/auth/login",
            json={"email": "owner@example.com", "password": "password123"},
        )

    assert response.status_code == 403


def test_additional_legacy_admin_is_not_treated_as_an_owner():
    with TestClient(app) as client:
        client.post("/api/v1/auth/signup", json=owner_payload())
        with sqlite3.connect(get_settings().database_path) as connection:
            connection.execute(
                """
                INSERT INTO users (email, name, role, password_hash, is_active, created_at)
                VALUES (?, ?, 'admin', ?, 1, ?)
                """,
                (
                    "legacy-admin@example.com",
                    "Legacy Admin",
                    hash_password("password123"),
                    "2026-01-02T00:00:00Z",
                ),
            )
        response = client.post(
            "/api/v1/auth/login",
            json={"email": "legacy-admin@example.com", "password": "password123"},
        )

    assert response.status_code == 403


def test_removed_b2c_admin_and_upgrade_routes_are_not_registered():
    with TestClient(app) as client:
        signup = client.post("/api/v1/auth/signup", json=owner_payload())
        headers = {"Authorization": f"Bearer {signup.json()['access_token']}"}
        admin = client.get("/api/v1/admin/users", headers=headers)
        upgrade = client.get("/api/v1/auth/pro-request", headers=headers)
        payment = client.get("/api/v1/payments/me", headers=headers)

    assert admin.status_code == 404
    assert upgrade.status_code == 404
    assert payment.status_code == 404
