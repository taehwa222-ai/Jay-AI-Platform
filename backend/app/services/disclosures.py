from __future__ import annotations

import io
import sqlite3
import xml.etree.ElementTree as ET
import zipfile
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from typing import Any

import httpx
from fastapi import HTTPException, status

from app.config import Settings
from app.services.cache import AsyncTTLCache
from app.services.database import connect_database


@dataclass(frozen=True)
class Disclosure:
    title: str
    date: str
    receipt_no: str
    url: str


class DisclosureService:
    CORP_CODE_URL = "https://opendart.fss.or.kr/api/corpCode.xml"
    DISCLOSURE_LIST_URL = "https://opendart.fss.or.kr/api/list.json"
    DART_DISCLOSURE_URL = "https://dart.fss.or.kr/dsaf001/main.do?rcptNo={receipt_no}"
    CACHE_MAX_AGE = timedelta(days=7)

    def __init__(self, settings: Settings):
        self.settings = settings
        self.db_path = settings.database_path
        self.disclosure_cache = AsyncTTLCache[list[Disclosure]](
            settings.disclosure_cache_ttl_seconds
        )

    def init_db(self) -> None:
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        with self.connect() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS dart_corp_codes (
                    corp_code TEXT PRIMARY KEY,
                    corp_name TEXT NOT NULL,
                    stock_code TEXT NOT NULL,
                    cached_at TEXT NOT NULL
                )
                """
            )
            conn.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_dart_corp_codes_stock
                ON dart_corp_codes(stock_code)
                """
            )

    def connect(self) -> sqlite3.Connection:
        return connect_database(self.db_path)

    async def ensure_corp_code_cache(self) -> None:
        self.init_db()
        if self._cache_is_fresh():
            return

        response = await self._get(
            self.CORP_CODE_URL,
            {"crtfc_key": self._api_key()},
            "OpenDART 회사코드 조회에 실패했습니다.",
        )
        entries = self._parse_corp_code_zip(response.content)
        cached_at = datetime.now(UTC).isoformat()

        with self.connect() as conn:
            conn.execute("DELETE FROM dart_corp_codes")
            conn.executemany(
                """
                INSERT INTO dart_corp_codes (corp_code, corp_name, stock_code, cached_at)
                VALUES (?, ?, ?, ?)
                """,
                [
                    (corp_code, corp_name, stock_code, cached_at)
                    for corp_code, corp_name, stock_code in entries
                ],
            )

    def resolve_corp_code(self, ticker: str) -> str | None:
        normalized_ticker = ticker.strip().upper()
        with self.connect() as conn:
            row = conn.execute(
                """
                SELECT corp_code
                FROM dart_corp_codes
                WHERE stock_code = ?
                LIMIT 1
                """,
                (normalized_ticker,),
            ).fetchone()
        return str(row["corp_code"]) if row is not None else None

    async def get_recent_disclosures(self, ticker: str) -> list[Disclosure]:
        normalized_ticker = ticker.strip().upper()
        self._api_key()
        disclosures = await self.disclosure_cache.get_or_create(
            normalized_ticker,
            lambda: self._load_recent_disclosures(normalized_ticker),
        )
        return list(disclosures)

    async def _load_recent_disclosures(self, ticker: str) -> list[Disclosure]:
        api_key = self._api_key()
        await self.ensure_corp_code_cache()
        corp_code = self.resolve_corp_code(ticker)
        if corp_code is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="종목코드에 해당하는 회사를 찾을 수 없습니다.",
            )

        today = date.today()
        response = await self._get(
            self.DISCLOSURE_LIST_URL,
            {
                "crtfc_key": api_key,
                "corp_code": corp_code,
                "bgn_de": (today - timedelta(days=365)).strftime("%Y%m%d"),
                "end_de": today.strftime("%Y%m%d"),
                "page_count": 10,
            },
            "OpenDART 공시 목록 조회에 실패했습니다.",
        )
        payload = self._decode_json(response)
        result_status = str(payload.get("status", ""))
        if result_status == "013":
            return []
        if result_status != "000":
            message = str(payload.get("message") or "알 수 없는 오류")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=(
                    f"OpenDART 공시 목록 조회에 실패했습니다: {message} (status: {result_status})"
                ),
            )

        raw_items = payload.get("list", [])
        if not isinstance(raw_items, list):
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="OpenDART 공시 목록 응답 형식이 올바르지 않습니다.",
            )

        return [self._to_disclosure(item) for item in raw_items]

    async def _get(self, url: str, params: dict[str, Any], error_detail: str) -> httpx.Response:
        try:
            async with httpx.AsyncClient(
                timeout=self.settings.market_data_timeout_seconds
            ) as client:
                response = await client.get(url, params=params)
                response.raise_for_status()
        except httpx.HTTPError as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=error_detail,
            ) from exc
        return response

    def _api_key(self) -> str:
        api_key = self.settings.opendart_api_key.strip()
        if not api_key:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="OpenDART API 키가 설정되지 않았습니다.",
            )
        return api_key

    def _cache_is_fresh(self) -> bool:
        with self.connect() as conn:
            row = conn.execute("SELECT MAX(cached_at) AS cached_at FROM dart_corp_codes").fetchone()
        cached_at = row["cached_at"] if row is not None else None
        if not cached_at:
            return False
        try:
            timestamp = datetime.fromisoformat(str(cached_at))
        except ValueError:
            return False
        if timestamp.tzinfo is None:
            timestamp = timestamp.replace(tzinfo=UTC)
        return datetime.now(UTC) - timestamp < self.CACHE_MAX_AGE

    @staticmethod
    def _parse_corp_code_zip(content: bytes) -> list[tuple[str, str, str]]:
        try:
            with zipfile.ZipFile(io.BytesIO(content)) as archive:
                xml_name = next(
                    name
                    for name in archive.namelist()
                    if name.rsplit("/", 1)[-1].upper() == "CORPCODE.XML"
                )
                root = ET.fromstring(archive.read(xml_name))
        except (ET.ParseError, KeyError, StopIteration, zipfile.BadZipFile) as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="OpenDART 회사코드 응답을 읽을 수 없습니다.",
            ) from exc

        entries: list[tuple[str, str, str]] = []
        for element in root.iter():
            if _local_name(element.tag) != "list":
                continue
            values = {
                field: _child_text(element, field)
                for field in ("corp_code", "corp_name", "stock_code")
            }
            if values["corp_code"]:
                entries.append((values["corp_code"], values["corp_name"], values["stock_code"]))

        if not entries:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="OpenDART 회사코드 응답에 회사 정보가 없습니다.",
            )
        return entries

    @staticmethod
    def _decode_json(response: httpx.Response) -> dict[str, Any]:
        try:
            payload = response.json()
        except (TypeError, ValueError) as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="OpenDART 공시 목록 응답이 올바른 JSON이 아닙니다.",
            ) from exc
        if not isinstance(payload, dict):
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="OpenDART 공시 목록 응답 형식이 올바르지 않습니다.",
            )
        return payload

    @classmethod
    def _to_disclosure(cls, item: Any) -> Disclosure:
        if not isinstance(item, dict):
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="OpenDART 공시 항목 형식이 올바르지 않습니다.",
            )
        try:
            title = str(item["report_nm"]).strip()
            raw_date = str(item["rcept_dt"]).strip()
            receipt_no = str(item["rcept_no"]).strip()
        except (KeyError, TypeError) as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="OpenDART 공시 항목에 필수 값이 없습니다.",
            ) from exc
        if len(raw_date) != 8 or not raw_date.isdigit() or not receipt_no:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="OpenDART 공시 항목의 날짜 또는 접수번호가 올바르지 않습니다.",
            )
        formatted_date = f"{raw_date[:4]}-{raw_date[4:6]}-{raw_date[6:]}"
        return Disclosure(
            title=title,
            date=formatted_date,
            receipt_no=receipt_no,
            url=cls.DART_DISCLOSURE_URL.format(receipt_no=receipt_no),
        )


def _local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def _child_text(element: ET.Element, field: str) -> str:
    for child in element:
        if _local_name(child.tag) == field:
            return (child.text or "").strip()
    return ""
