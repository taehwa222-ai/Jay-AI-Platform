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

    print("Health:", health.json())
    print("Overview:", overview.json())


if __name__ == "__main__":
    main()
