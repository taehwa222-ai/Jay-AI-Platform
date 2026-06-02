from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


def main() -> None:
    payload = {
        "tickers": ["AAPL", "MSFT"],
        "volume_multiplier": 1.0,
        "period": "6mo",
        "interval": "1d",
    }
    with TestClient(app) as client:
        response = client.post("/api/v1/recommendations/run", json=payload)
        response.raise_for_status()
        body = response.json()
        print(f"status={response.status_code}")
        print(f"scanned={','.join(body['scanned'])}")
        print(f"candidates={len(body['candidates'])}")


if __name__ == "__main__":
    main()
