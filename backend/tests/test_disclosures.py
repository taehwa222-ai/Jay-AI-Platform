import io
import re
import zipfile

import httpx
from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import app


def corp_code_zip(*, stock_code: str = "005930") -> bytes:
    xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<result>
  <list>
    <corp_code>00126380</corp_code>
    <corp_name>삼성전자</corp_name>
    <stock_code>{stock_code}</stock_code>
    <modify_date>20260101</modify_date>
  </list>
</result>"""
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("CORPCODE.xml", xml.encode("utf-8"))
    return buffer.getvalue()


def patch_opendart(monkeypatch, list_payload: dict | None = None, *, stock_code: str = "005930"):
    calls: list[tuple[str, dict]] = []
    responses = [httpx.Response(200, content=corp_code_zip(stock_code=stock_code))]
    if list_payload is not None:
        responses.append(httpx.Response(200, json=list_payload))

    class FakeAsyncClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, traceback):
            return None

        async def get(self, url, params=None):
            calls.append((url, params or {}))
            response = responses.pop(0)
            response.request = httpx.Request("GET", url)
            return response

    monkeypatch.setattr(httpx, "AsyncClient", FakeAsyncClient)
    return calls


def auth_headers(client: TestClient) -> dict[str, str]:
    signup = client.post(
        "/api/v1/auth/signup",
        json={"email": "disclosures@example.com", "password": "password123", "name": "Disclosures"},
    )
    assert signup.status_code == 201
    return {"Authorization": f"Bearer {signup.json()['access_token']}"}


def test_disclosures_require_authentication():
    with TestClient(app) as client:
        response = client.get("/api/v1/disclosures/005930")

    assert response.status_code == 401


def test_missing_opendart_key_returns_503(monkeypatch):
    get_settings().opendart_api_key = ""
    with TestClient(app) as client:
        response = client.get("/api/v1/disclosures/005930", headers=auth_headers(client))

    assert response.status_code == 503
    assert "API 키" in response.json()["detail"]


def test_unknown_ticker_returns_404(monkeypatch):
    get_settings().opendart_api_key = "test-key"
    calls = patch_opendart(monkeypatch, stock_code="005930")
    with TestClient(app) as client:
        response = client.get("/api/v1/disclosures/999999", headers=auth_headers(client))

    assert response.status_code == 404
    assert len(calls) == 1


def test_disclosures_map_successful_response(monkeypatch):
    get_settings().opendart_api_key = "test-key"
    calls = patch_opendart(
        monkeypatch,
        {
            "status": "000",
            "list": [
                {
                    "report_nm": "사업보고서",
                    "rcept_dt": "20260201",
                    "rcept_no": "20260201000001",
                }
            ],
        },
    )
    with TestClient(app) as client:
        headers = auth_headers(client)
        response = client.get("/api/v1/disclosures/005930", headers=headers)
        cached = client.get("/api/v1/disclosures/005930", headers=headers)

    assert response.status_code == 200
    assert cached.json() == response.json()
    assert response.json() == [
        {
            "title": "사업보고서",
            "date": "2026-02-01",
            "receipt_no": "20260201000001",
            "url": "https://dart.fss.or.kr/dsaf001/main.do?rcptNo=20260201000001",
        }
    ]
    assert calls[0][0].endswith("/corpCode.xml")
    assert calls[0][1] == {"crtfc_key": "test-key"}
    assert calls[1][1]["corp_code"] == "00126380"
    assert calls[1][1]["page_count"] == 10
    assert len(calls) == 2
    assert re.fullmatch(r"\d{8}", calls[1][1]["bgn_de"])
    assert re.fullmatch(r"\d{8}", calls[1][1]["end_de"])


def test_status_013_returns_empty_list(monkeypatch):
    get_settings().opendart_api_key = "test-key"
    patch_opendart(monkeypatch, {"status": "013", "message": "조회된 데이터가 없습니다."})
    with TestClient(app) as client:
        response = client.get("/api/v1/disclosures/005930", headers=auth_headers(client))

    assert response.status_code == 200
    assert response.json() == []


def test_failed_opendart_status_returns_502(monkeypatch):
    get_settings().opendart_api_key = "test-key"
    patch_opendart(monkeypatch, {"status": "020", "message": "응답 오류"})
    with TestClient(app) as client:
        response = client.get("/api/v1/disclosures/005930", headers=auth_headers(client))

    assert response.status_code == 502
    assert "020" in response.json()["detail"]
