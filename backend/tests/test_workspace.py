from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import app


def owner_headers(client: TestClient) -> dict[str, str]:
    response = client.post(
        "/api/v1/auth/signup",
        json={"email": "owner@example.com", "password": "password123", "name": "Owner"},
    )
    assert response.status_code == 201
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_global_search_finds_user_stocks_content_and_tasks():
    project = get_settings().content_dir / "youtube" / "2026-08-15-semiconductor"
    project.mkdir(parents=True)
    (project / "script.md").write_text("Samsung semiconductor outlook", encoding="utf-8")

    with TestClient(app) as client:
        headers = owner_headers(client)
        holding = client.post(
            "/api/v1/stocks/holdings",
            headers=headers,
            json={
                "ticker": "005930",
                "name": "Samsung Electronics",
                "quantity": 10,
                "average_price": 70000,
                "current_price": 75000,
            },
        )
        task = client.post(
            "/api/v1/workspace/tasks",
            headers=headers,
            json={"title": "Review Samsung disclosure", "priority": "high"},
        )
        search = client.get("/api/v1/workspace/search?q=Samsung", headers=headers)

    assert holding.status_code == 201
    assert task.status_code == 201
    assert search.status_code == 200
    kinds = {item["kind"] for item in search.json()["results"]}
    assert {"holding", "youtube_document", "task"} <= kinds


def test_task_lifecycle_is_scoped_to_current_user():
    with TestClient(app) as client:
        headers = owner_headers(client)
        created = client.post(
            "/api/v1/workspace/tasks",
            headers=headers,
            json={"title": "Ship release", "due_date": "2026-08-20"},
        )
        task_id = created.json()["id"]
        updated = client.patch(
            f"/api/v1/workspace/tasks/{task_id}",
            headers=headers,
            json={"status": "done"},
        )
        listed = client.get("/api/v1/workspace/tasks", headers=headers)
        deleted = client.delete(f"/api/v1/workspace/tasks/{task_id}", headers=headers)

    assert updated.status_code == 200
    assert updated.json()["status"] == "done"
    assert updated.json()["completed_at"]
    assert listed.json()[0]["title"] == "Ship release"
    assert deleted.status_code == 204


def test_content_document_versions_can_be_listed_and_restored():
    project = get_settings().content_dir / "youtube" / "2026-08-15-versioned"
    project.mkdir(parents=True)
    document = project / "script.md"
    document.write_text("version one", encoding="utf-8")

    with TestClient(app) as client:
        headers = owner_headers(client)
        saved = client.put(
            "/api/v1/content-ops/documents/youtube/2026-08-15-versioned/script.md",
            headers=headers,
            json={"content": "version two"},
        )
        versions = client.get(
            "/api/v1/content-ops/documents/youtube/2026-08-15-versioned/script.md/versions",
            headers=headers,
        )
        version_id = versions.json()[0]["id"]
        restored = client.post(
            f"/api/v1/content-ops/documents/youtube/2026-08-15-versioned/script.md/versions/{version_id}/restore",
            headers=headers,
        )

    assert saved.status_code == 200
    assert versions.status_code == 200
    assert versions.json()[0]["content"] == "version one"
    assert restored.status_code == 200
    assert restored.json()["content"] == "version one"
    assert document.read_text(encoding="utf-8") == "version one"


def test_daily_stock_briefing_and_backup_management():
    with TestClient(app) as client:
        headers = owner_headers(client)
        briefing = client.get("/api/v1/workspace/stock-briefing", headers=headers)
        data = client.get("/api/v1/workspace/data", headers=headers)
        backup = client.post("/api/v1/workspace/data/backups", headers=headers)
        filename = backup.json()["backup"]["filename"]
        verified = client.post(
            f"/api/v1/workspace/data/backups/{filename}/verify", headers=headers
        )
        exported = client.get("/api/v1/workspace/data/export", headers=headers)
        refused_restore = client.post(
            f"/api/v1/workspace/data/backups/{filename}/restore",
            headers=headers,
            json={"confirmation": "do not restore"},
        )

    assert briefing.status_code == 200
    assert briefing.json()["holding_count"] == 0
    assert data.status_code == 200
    assert data.json()["wal_enabled"] is True
    assert backup.status_code == 200
    assert verified.json()["integrity"] == "ok"
    assert exported.status_code == 200
    assert exported.headers["content-type"] == "application/zip"
    assert refused_restore.status_code == 422


def test_invitation_activates_matching_user_and_is_single_use():
    with TestClient(app) as client:
        headers = owner_headers(client)
        invitation = client.post(
            "/api/v1/admin/invitations",
            headers=headers,
            json={
                "email": "member@example.com",
                "role": "member",
                "can_access_stocks": True,
                "can_access_content_ops": False,
            },
        )
        token = invitation.json()["token"]
        signup = client.post(
            "/api/v1/auth/signup",
            json={
                "email": "member@example.com",
                "password": "password123",
                "name": "Member",
                "invite_token": token,
            },
        )
        invitations = client.get("/api/v1/admin/invitations", headers=headers)
        reused = client.post(
            "/api/v1/auth/signup",
            json={
                "email": "second@example.com",
                "password": "password123",
                "name": "Second",
                "invite_token": token,
            },
        )

    assert invitation.status_code == 201
    assert signup.status_code == 201
    assert signup.json()["approval_status"] == "approved"
    assert signup.json()["user"]["can_access_content_ops"] is False
    assert invitations.json()[0]["used_at"]
    assert reused.status_code == 400
