"""Obtain and save a YouTube OAuth refresh token through a local browser flow.

The script reads YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET from the repository
.env file, opens Google's consent page, receives the callback on 127.0.0.1, and
stores the refresh token in the repository .env file. It never prints the token
or writes credentials to source control.

Run from the repository root:

    .\\.venv\\Scripts\\python.exe scripts\\youtube-oauth.py
"""

from __future__ import annotations

import argparse
import secrets
import sys
import threading
import webbrowser
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlencode, urlparse

import httpx

PROJECT_ROOT = Path(__file__).resolve().parents[1]
ENV_PATH = PROJECT_ROOT / ".env"
sys.path.insert(0, str(PROJECT_ROOT / "backend"))

from app.config import get_settings  # noqa: E402

AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"
SCOPE = "https://www.googleapis.com/auth/youtube.upload"


class OAuthError(RuntimeError):
    pass


class CallbackServer(HTTPServer):
    result: dict[str, str] | None = None


class CallbackHandler(BaseHTTPRequestHandler):
    expected_state = ""

    def do_GET(self) -> None:  # noqa: N802
        query = parse_qs(urlparse(self.path).query)
        state = query.get("state", [""])[0]
        code = query.get("code", [""])[0]
        error = query.get("error", [""])[0]
        if state != self.expected_state:
            self.server.result = {"error": "OAuth state validation failed."}
        elif error:
            self.server.result = {"error": error}
        elif not code:
            self.server.result = {"error": "Google returned no authorization code."}
        else:
            self.server.result = {"code": code}
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.end_headers()
        self.wfile.write(
            "<html><body><h2>승인이 완료되었습니다.</h2>"
            "<p>이 창을 닫고 터미널로 돌아가세요.</p></body></html>".encode()
        )
        threading.Thread(target=self.server.shutdown, daemon=True).start()

    def log_message(self, format: str, *args: object) -> None:
        return


def main() -> int:
    parser = argparse.ArgumentParser(description="Get a YouTube OAuth refresh token locally.")
    parser.add_argument(
        "--no-open",
        action="store_true",
        help="Print the consent URL instead of opening the browser automatically.",
    )
    args = parser.parse_args()
    settings = get_settings()
    if not settings.youtube_client_id.strip() or not settings.youtube_client_secret.strip():
        raise OAuthError(
            "YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET must be set in the repository .env."
        )

    state = secrets.token_urlsafe(32)
    CallbackHandler.expected_state = state
    # Bind first so the browser never races a server that is not listening yet.
    # Desktop OAuth clients support the loopback redirect with a dynamic port.
    server = CallbackServer(("127.0.0.1", 0), CallbackHandler)
    redirect_uri = f"http://127.0.0.1:{server.server_port}/oauth2callback"
    authorization_url = AUTH_ENDPOINT + "?" + urlencode(
        {
            "client_id": settings.youtube_client_id.strip(),
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": SCOPE,
            "access_type": "offline",
            "prompt": "consent",
            "state": state,
        }
    )
    server_thread = threading.Thread(target=server.serve_forever, daemon=True)
    server_thread.start()
    print("Google 승인 화면을 엽니다. YouTube 채널이 있는 계정으로 승인하세요.")
    if args.no_open:
        print(authorization_url)
    elif not webbrowser.open(authorization_url):
        print("브라우저를 자동으로 열지 못했습니다. 아래 URL을 직접 여세요:")
        print(authorization_url)

    try:
        if args.no_open:
            print(f"콜백 대기 중: {redirect_uri}")
        server_thread.join()
    finally:
        server.shutdown()
        server_thread.join(timeout=2)
        server.server_close()
    result = server.result or {"error": "OAuth callback was not received."}
    if "error" in result:
        raise OAuthError(result["error"])

    response = httpx.post(
        TOKEN_ENDPOINT,
        data={
            "code": result["code"],
            "client_id": settings.youtube_client_id.strip(),
            "client_secret": settings.youtube_client_secret.strip(),
            "redirect_uri": redirect_uri,
            "grant_type": "authorization_code",
        },
        timeout=30,
    )
    if response.is_error:
        raise OAuthError(f"Google token exchange failed ({response.status_code}).")
    token_payload = response.json()
    refresh_token = str(token_payload.get("refresh_token", "")).strip()
    if not refresh_token:
        raise OAuthError(
            "Google returned no refresh token. Re-run the tool and approve access again."
        )
    save_refresh_token(refresh_token)
    print("\nRefresh token 발급 및 .env 저장이 완료되었습니다.")
    print("토큰 값은 보안을 위해 화면에 표시하지 않았습니다.")
    return 0


def save_refresh_token(refresh_token: str) -> None:
    """Replace or append the token without printing or committing its value."""
    lines = ENV_PATH.read_text(encoding="utf-8").splitlines() if ENV_PATH.is_file() else []
    replacement = f"YOUTUBE_REFRESH_TOKEN={refresh_token}"
    updated = False
    output: list[str] = []
    for line in lines:
        if line.strip().startswith("YOUTUBE_REFRESH_TOKEN="):
            output.append(replacement)
            updated = True
        else:
            output.append(line)
    if not updated:
        if output and output[-1].strip():
            output.append("")
        output.append(replacement)
    ENV_PATH.write_text("\n".join(output) + "\n", encoding="utf-8")


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OAuthError, OSError, httpx.HTTPError) as error:
        print(f"ERROR: {error}", file=sys.stderr)
        raise SystemExit(1) from error
