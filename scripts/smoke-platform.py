import sys
from pathlib import Path

from fastapi.testclient import TestClient

ROOT_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT_DIR / "backend"))


def main() -> None:
    from app.main import app

    client = TestClient(app)

    health = client.get("/api/v1/health")
    health.raise_for_status()

    overview = client.get("/api/v1/platform/overview")
    overview.raise_for_status()

    modules = client.get("/api/v1/platform/modules")
    modules.raise_for_status()

    manual = client.get("/api/v1/platform/manual")
    manual.raise_for_status()

    monetization = client.get("/api/v1/platform/monetization")
    monetization.raise_for_status()

    print("Health:", health.json())
    print("Overview:", overview.json())
    print("Modules:", len(modules.json()["modules"]))
    print("Manual sections:", len(manual.json()["sections"]))
    print("Monetization ideas:", len(monetization.json()["ideas"]))


if __name__ == "__main__":
    main()
