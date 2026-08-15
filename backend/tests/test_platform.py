from fastapi.testclient import TestClient

from app.main import app


def test_health_endpoint():
    with TestClient(app) as client:
        response = client.get("/api/v1/health")

    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is True
    assert isinstance(body["app"], str)
    assert body["app"]


def test_platform_overview_endpoint():
    with TestClient(app) as client:
        response = client.get("/api/v1/platform/overview")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ready"
    assert body["modules"] == ["stock-lab", "content-ops"]


def test_platform_modules_endpoint():
    with TestClient(app) as client:
        response = client.get("/api/v1/platform/modules")

    assert response.status_code == 200
    modules = response.json()["modules"]
    assert [module["id"] for module in modules] == ["stock-lab", "content-ops"]


def test_platform_manual_endpoint():
    with TestClient(app) as client:
        response = client.get("/api/v1/platform/manual")

    assert response.status_code == 200
    sections = response.json()["sections"]
    assert [section["id"] for section in sections] == ["local-run", "daily-backup"]


def test_platform_roadmap_endpoint():
    with TestClient(app) as client:
        response = client.get("/api/v1/platform/roadmap")

    assert response.status_code == 200
    phases = response.json()["phases"]
    assert phases[0]["id"] == "internal-os"
