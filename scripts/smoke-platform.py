from __future__ import annotations

import argparse
import json
import os
import urllib.error
import urllib.request
from typing import Any


def request_json(
    base_url: str,
    path: str,
    *,
    method: str = "GET",
    payload: dict[str, Any] | None = None,
    token: str | None = None,
) -> Any:
    body = json.dumps(payload).encode() if payload is not None else None
    headers = {"Accept": "application/json"}
    if body is not None:
        headers["Content-Type"] = "application/json"
    if token:
        headers["Authorization"] = f"Bearer {token}"
    request = urllib.request.Request(
        f"{base_url.rstrip('/')}{path}",
        data=body,
        headers=headers,
        method=method,
    )
    with urllib.request.urlopen(request, timeout=15) as response:
        return json.load(response)


def check_frontend(frontend_url: str) -> None:
    request = urllib.request.Request(frontend_url, headers={"Accept": "text/html"})
    with urllib.request.urlopen(request, timeout=15) as response:
        body = response.read().decode("utf-8", errors="replace")
    if "<div id=\"root\"></div>" not in body:
        raise RuntimeError("Frontend response does not contain the React root element.")
    print("PASS frontend shell")


def authenticated_checks(base_url: str, email: str, password: str, external: bool) -> None:
    login = request_json(
        base_url,
        "/api/v1/auth/login",
        method="POST",
        payload={"email": email, "password": password},
    )
    token = login["access_token"]
    checks = [
        "/api/v1/auth/me",
        "/api/v1/stocks/holdings",
        "/api/v1/stocks/watchlist",
        "/api/v1/stocks/analysis-records",
        "/api/v1/stocks/reports",
        "/api/v1/content-ops/youtube",
        "/api/v1/content-ops/emoticon",
        "/api/v1/notifications/status",
    ]
    if external:
        checks.extend(["/api/v1/stocks/market/005930", "/api/v1/disclosures/005930"])
    for path in checks:
        request_json(base_url, path, token=token)
        print(f"PASS {path}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run read-only Jay AI production smoke checks.")
    parser.add_argument("--base-url", default="http://127.0.0.1:8000")
    parser.add_argument("--frontend-url")
    parser.add_argument("--email", default=os.environ.get("SMOKE_OWNER_EMAIL"))
    parser.add_argument("--password", default=os.environ.get("SMOKE_OWNER_PASSWORD"))
    parser.add_argument(
        "--external",
        action="store_true",
        help="Also query Yahoo Finance and OpenDART through authenticated APIs.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        health = request_json(args.base_url, "/api/v1/health")
        if health.get("ok") is not True:
            raise RuntimeError("Health endpoint did not report ok=true.")
        print("PASS /api/v1/health")

        for path in (
            "/api/v1/platform/overview",
            "/api/v1/platform/modules",
            "/api/v1/platform/manual",
        ):
            request_json(args.base_url, path)
            print(f"PASS {path}")

        if args.frontend_url:
            check_frontend(args.frontend_url)

        if bool(args.email) != bool(args.password):
            raise ValueError("Both --email and --password are required for authenticated checks.")
        if args.email and args.password:
            authenticated_checks(args.base_url, args.email, args.password, args.external)
        elif args.external:
            raise ValueError("--external requires owner credentials.")
        else:
            print("SKIP authenticated checks (owner credentials not provided)")
    except (KeyError, RuntimeError, ValueError, urllib.error.URLError) as exc:
        print(f"Smoke check failed: {exc}")
        return 1

    print("Smoke checks passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
