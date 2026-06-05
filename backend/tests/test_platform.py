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
    assert body["modules"] == []


def test_platform_roadmap_endpoint():
    with TestClient(app) as client:
        response = client.get("/api/v1/platform/roadmap")

    assert response.status_code == 200
    phases = response.json()["phases"]
    assert phases[0]["id"] == "foundation"
    assert phases[1]["id"] == "custom"
