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
    assert "member-auth" in body["modules"]


def test_platform_modules_endpoint():
    with TestClient(app) as client:
        response = client.get("/api/v1/platform/modules")

    assert response.status_code == 200
    modules = response.json()["modules"]
    assert modules[0]["id"] == "member-auth"
    assert modules[1]["id"] == "admin-console"


def test_platform_manual_endpoint():
    with TestClient(app) as client:
        response = client.get("/api/v1/platform/manual")

    assert response.status_code == 200
    sections = response.json()["sections"]
    assert sections[0]["id"] == "local-setup"
    assert sections[-1]["id"] == "vps-deploy"


def test_platform_monetization_endpoint():
    with TestClient(app) as client:
        response = client.get("/api/v1/platform/monetization")

    assert response.status_code == 200
    ideas = response.json()["ideas"]
    assert ideas[0]["id"] == "subscription"
    assert ideas[-1]["id"] == "education"


def test_platform_roadmap_endpoint():
    with TestClient(app) as client:
        response = client.get("/api/v1/platform/roadmap")

    assert response.status_code == 200
    phases = response.json()["phases"]
    assert phases[0]["id"] == "foundation"
    assert phases[1]["id"] == "access"
