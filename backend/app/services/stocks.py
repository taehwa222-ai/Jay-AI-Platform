from __future__ import annotations

import json
import sqlite3
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

import httpx
from fastapi import HTTPException, status

from app.config import Settings
from app.schemas.stocks import (
    StockAnalysisRecordPublic,
    StockAnalysisRequest,
    StockAnalysisResponse,
    StockHoldingCreateRequest,
    StockHoldingPriceRefreshFailure,
    StockHoldingPriceRefreshResponse,
    StockHoldingPublic,
    StockHoldingUpdateRequest,
    StockMarketSnapshot,
    StockReportPublic,
    StockScanCandidate,
    StockScanFailure,
    StockScanRequest,
    StockScanResponse,
    StockWatchlistCreateRequest,
    StockWatchlistItemPublic,
    StockWatchlistUpdateRequest,
)
from app.services.auth import User

DISCLAIMER = (
    "이 결과는 투자 판단을 돕기 위한 정보 정리이며, 수익을 보장하거나 매수/매도 지시를 "
    "제공하지 않습니다."
)


@dataclass(frozen=True)
class StockHolding:
    id: int
    user_id: int
    ticker: str
    name: str
    quantity: float
    average_price: float
    current_price: float
    investment_thesis: str
    risk_memo: str
    created_at: str
    updated_at: str

    def public(self) -> StockHoldingPublic:
        cost_basis = self.quantity * self.average_price
        market_value = self.quantity * self.current_price
        profit_loss = market_value - cost_basis
        profit_loss_percent = (profit_loss / cost_basis * 100) if cost_basis else 0
        return StockHoldingPublic(
            id=self.id,
            ticker=self.ticker,
            name=self.name,
            quantity=round(self.quantity, 4),
            average_price=round(self.average_price, 2),
            current_price=round(self.current_price, 2),
            cost_basis=round(cost_basis, 2),
            market_value=round(market_value, 2),
            profit_loss=round(profit_loss, 2),
            profit_loss_percent=round(profit_loss_percent, 2),
            investment_thesis=self.investment_thesis,
            risk_memo=self.risk_memo,
            created_at=self.created_at,
            updated_at=self.updated_at,
        )


@dataclass(frozen=True)
class MarketCandle:
    trading_day: str
    close: float
    volume: int


@dataclass(frozen=True)
class StockWatchlistItem:
    id: int
    user_id: int
    ticker: str
    name: str
    note: str
    created_at: str
    updated_at: str

    def public(self) -> StockWatchlistItemPublic:
        return StockWatchlistItemPublic(
            id=self.id,
            ticker=self.ticker,
            name=self.name,
            note=self.note,
            created_at=self.created_at,
            updated_at=self.updated_at,
        )


@dataclass(frozen=True)
class StockAnalysisRecord:
    id: int
    user_id: int
    ticker: str
    name: str
    score: int
    rating: str
    rating_label: str
    summary: str
    ai_summary: str
    ai_powered: bool
    price_change_percent: float
    volume_multiplier: float
    signals: str
    risk_notes: str
    action_checklist: str
    memo: str
    disclaimer: str
    created_at: str

    def public(self) -> StockAnalysisRecordPublic:
        return StockAnalysisRecordPublic(
            id=self.id,
            ticker=self.ticker,
            name=self.name,
            score=self.score,
            rating=self.rating,
            rating_label=self.rating_label,
            summary=self.summary,
            ai_summary=self.ai_summary,
            ai_powered=self.ai_powered,
            price_change_percent=round(self.price_change_percent, 2),
            volume_multiplier=round(self.volume_multiplier, 2),
            signals=json_list(self.signals),
            risk_notes=json_list(self.risk_notes),
            action_checklist=json_list(self.action_checklist),
            memo=self.memo,
            disclaimer=self.disclaimer,
            created_at=self.created_at,
        )


@dataclass(frozen=True)
class StockReport:
    id: int
    user_id: int
    analysis_record_id: int
    ticker: str
    name: str
    title: str
    body: str
    score: int
    rating: str
    rating_label: str
    report_type: str
    created_at: str

    def public(self) -> StockReportPublic:
        return StockReportPublic(
            id=self.id,
            analysis_record_id=self.analysis_record_id,
            ticker=self.ticker,
            name=self.name,
            title=self.title,
            body=self.body,
            score=self.score,
            rating=self.rating,
            rating_label=self.rating_label,
            report_type=self.report_type,
            created_at=self.created_at,
        )


class StockService:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.db_path = settings.database_path

    def init_db(self) -> None:
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        with self.connect() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS stock_holdings (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    ticker TEXT NOT NULL,
                    name TEXT NOT NULL,
                    quantity REAL NOT NULL,
                    average_price REAL NOT NULL,
                    current_price REAL NOT NULL,
                    investment_thesis TEXT NOT NULL DEFAULT '',
                    risk_memo TEXT NOT NULL DEFAULT '',
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
                """
            )
            conn.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_stock_holdings_user
                ON stock_holdings(user_id, ticker)
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS stock_watchlist_items (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    ticker TEXT NOT NULL,
                    name TEXT NOT NULL DEFAULT '',
                    note TEXT NOT NULL DEFAULT '',
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
                """
            )
            conn.execute(
                """
                CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_watchlist_user_ticker
                ON stock_watchlist_items(user_id, ticker)
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS stock_analysis_records (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    ticker TEXT NOT NULL,
                    name TEXT NOT NULL,
                    score INTEGER NOT NULL,
                    rating TEXT NOT NULL,
                    rating_label TEXT NOT NULL,
                    summary TEXT NOT NULL,
                    ai_summary TEXT NOT NULL,
                    ai_powered INTEGER NOT NULL,
                    price_change_percent REAL NOT NULL,
                    volume_multiplier REAL NOT NULL,
                    signals TEXT NOT NULL,
                    risk_notes TEXT NOT NULL,
                    action_checklist TEXT NOT NULL,
                    memo TEXT NOT NULL DEFAULT '',
                    disclaimer TEXT NOT NULL,
                    created_at TEXT NOT NULL
                )
                """
            )
            conn.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_stock_analysis_records_user
                ON stock_analysis_records(user_id, created_at DESC)
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS stock_reports (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    analysis_record_id INTEGER NOT NULL,
                    ticker TEXT NOT NULL,
                    name TEXT NOT NULL,
                    title TEXT NOT NULL,
                    body TEXT NOT NULL,
                    score INTEGER NOT NULL,
                    rating TEXT NOT NULL,
                    rating_label TEXT NOT NULL,
                    report_type TEXT NOT NULL DEFAULT 'paid_report_draft',
                    created_at TEXT NOT NULL
                )
                """
            )
            conn.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_stock_reports_user
                ON stock_reports(user_id, created_at DESC)
                """
            )

    def connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def list_holdings(self, user: User) -> list[StockHoldingPublic]:
        with self.connect() as conn:
            rows = conn.execute(
                """
                SELECT *
                FROM stock_holdings
                WHERE user_id = ?
                ORDER BY updated_at DESC, id DESC
                """,
                (user.id,),
            ).fetchall()
        return [row_to_holding(row).public() for row in rows]

    def create_holding(self, user: User, payload: StockHoldingCreateRequest) -> StockHoldingPublic:
        now = now_iso()
        with self.connect() as conn:
            cursor = conn.execute(
                """
                INSERT INTO stock_holdings (
                    user_id, ticker, name, quantity, average_price, current_price,
                    investment_thesis, risk_memo, created_at, updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    user.id,
                    payload.ticker,
                    payload.name,
                    payload.quantity,
                    payload.average_price,
                    payload.current_price,
                    payload.investment_thesis,
                    payload.risk_memo,
                    now,
                    now,
                ),
            )
            holding = self.get_holding(cursor.lastrowid, user.id, conn)
        return holding.public()

    def update_holding(
        self,
        holding_id: int,
        user: User,
        payload: StockHoldingUpdateRequest,
    ) -> StockHoldingPublic:
        update_data = payload.model_dump(exclude_unset=True)
        if not update_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No update fields provided.",
            )

        with self.connect() as conn:
            current = self.get_holding(holding_id, user.id, conn)
            values = {
                "ticker": update_data.get("ticker", current.ticker),
                "name": update_data.get("name", current.name),
                "quantity": update_data.get("quantity", current.quantity),
                "average_price": update_data.get("average_price", current.average_price),
                "current_price": update_data.get("current_price", current.current_price),
                "investment_thesis": update_data.get(
                    "investment_thesis",
                    current.investment_thesis,
                ),
                "risk_memo": update_data.get("risk_memo", current.risk_memo),
                "updated_at": now_iso(),
                "id": holding_id,
                "user_id": user.id,
            }
            conn.execute(
                """
                UPDATE stock_holdings
                SET ticker = :ticker,
                    name = :name,
                    quantity = :quantity,
                    average_price = :average_price,
                    current_price = :current_price,
                    investment_thesis = :investment_thesis,
                    risk_memo = :risk_memo,
                    updated_at = :updated_at
                WHERE id = :id AND user_id = :user_id
                """,
                values,
            )
            updated = self.get_holding(holding_id, user.id, conn)
        return updated.public()

    async def refresh_holding_prices(self, user: User) -> StockHoldingPriceRefreshResponse:
        with self.connect() as conn:
            rows = conn.execute(
                """
                SELECT *
                FROM stock_holdings
                WHERE user_id = ?
                ORDER BY updated_at DESC, id DESC
                """,
                (user.id,),
            ).fetchall()

        updated: list[StockHoldingPublic] = []
        failed: list[StockHoldingPriceRefreshFailure] = []

        for row in rows:
            holding = row_to_holding(row)
            try:
                snapshot = await self.market_snapshot(holding.ticker)
            except HTTPException as exc:
                failed.append(
                    StockHoldingPriceRefreshFailure(
                        id=holding.id,
                        ticker=holding.ticker,
                        name=holding.name,
                        reason=str(exc.detail),
                    )
                )
                continue

            with self.connect() as conn:
                conn.execute(
                    """
                    UPDATE stock_holdings
                    SET current_price = ?,
                        updated_at = ?
                    WHERE id = ? AND user_id = ?
                    """,
                    (snapshot.current_price, now_iso(), holding.id, user.id),
                )
                refreshed = self.get_holding(holding.id, user.id, conn)
            updated.append(refreshed.public())

        return StockHoldingPriceRefreshResponse(updated=updated, failed=failed)

    def delete_holding(self, holding_id: int, user: User) -> None:
        with self.connect() as conn:
            self.get_holding(holding_id, user.id, conn)
            conn.execute(
                "DELETE FROM stock_holdings WHERE id = ? AND user_id = ?",
                (holding_id, user.id),
            )

    def list_watchlist(self, user: User) -> list[StockWatchlistItemPublic]:
        with self.connect() as conn:
            rows = conn.execute(
                """
                SELECT *
                FROM stock_watchlist_items
                WHERE user_id = ?
                ORDER BY updated_at DESC, id DESC
                """,
                (user.id,),
            ).fetchall()
        return [row_to_watchlist_item(row).public() for row in rows]

    def create_watchlist_item(
        self,
        user: User,
        payload: StockWatchlistCreateRequest,
    ) -> StockWatchlistItemPublic:
        now = now_iso()
        with self.connect() as conn:
            try:
                cursor = conn.execute(
                    """
                    INSERT INTO stock_watchlist_items (
                        user_id, ticker, name, note, created_at, updated_at
                    )
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (user.id, payload.ticker, payload.name, payload.note, now, now),
                )
            except sqlite3.IntegrityError as exc:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Ticker is already in your watchlist.",
                ) from exc
            item = self.get_watchlist_item(cursor.lastrowid, user.id, conn)
        return item.public()

    def update_watchlist_item(
        self,
        item_id: int,
        user: User,
        payload: StockWatchlistUpdateRequest,
    ) -> StockWatchlistItemPublic:
        update_data = payload.model_dump(exclude_unset=True)
        if not update_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No update fields provided.",
            )

        with self.connect() as conn:
            current = self.get_watchlist_item(item_id, user.id, conn)
            values = {
                "ticker": update_data.get("ticker", current.ticker),
                "name": update_data.get("name", current.name),
                "note": update_data.get("note", current.note),
                "updated_at": now_iso(),
                "id": item_id,
                "user_id": user.id,
            }
            try:
                conn.execute(
                    """
                    UPDATE stock_watchlist_items
                    SET ticker = :ticker,
                        name = :name,
                        note = :note,
                        updated_at = :updated_at
                    WHERE id = :id AND user_id = :user_id
                    """,
                    values,
                )
            except sqlite3.IntegrityError as exc:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Ticker is already in your watchlist.",
                ) from exc
            updated = self.get_watchlist_item(item_id, user.id, conn)
        return updated.public()

    def delete_watchlist_item(self, item_id: int, user: User) -> None:
        with self.connect() as conn:
            self.get_watchlist_item(item_id, user.id, conn)
            conn.execute(
                "DELETE FROM stock_watchlist_items WHERE id = ? AND user_id = ?",
                (item_id, user.id),
            )

    def list_analysis_records(self, user: User) -> list[StockAnalysisRecordPublic]:
        with self.connect() as conn:
            rows = conn.execute(
                """
                SELECT *
                FROM stock_analysis_records
                WHERE user_id = ?
                ORDER BY created_at DESC, id DESC
                LIMIT 50
                """,
                (user.id,),
            ).fetchall()
        return [row_to_analysis_record(row).public() for row in rows]

    def delete_analysis_record(self, record_id: int, user: User) -> None:
        with self.connect() as conn:
            row = conn.execute(
                """
                SELECT id
                FROM stock_analysis_records
                WHERE id = ? AND user_id = ?
                """,
                (record_id, user.id),
            ).fetchone()
            if row is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Stock analysis record not found.",
                )
            conn.execute(
                "DELETE FROM stock_analysis_records WHERE id = ? AND user_id = ?",
                (record_id, user.id),
            )

    def list_reports(self, user: User) -> list[StockReportPublic]:
        with self.connect() as conn:
            rows = conn.execute(
                """
                SELECT *
                FROM stock_reports
                WHERE user_id = ?
                ORDER BY created_at DESC, id DESC
                LIMIT 50
                """,
                (user.id,),
            ).fetchall()
        return [row_to_report(row).public() for row in rows]

    def create_report_from_analysis(
        self,
        record_id: int,
        user: User,
    ) -> StockReportPublic:
        now = now_iso()
        with self.connect() as conn:
            record = self.get_analysis_record(record_id, user.id, conn)
            title = f"{record.name}({record.ticker}) AI analysis report"
            body = build_report_body(record)
            cursor = conn.execute(
                """
                INSERT INTO stock_reports (
                    user_id, analysis_record_id, ticker, name, title, body, score,
                    rating, rating_label, report_type, created_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    user.id,
                    record.id,
                    record.ticker,
                    record.name,
                    title,
                    body,
                    record.score,
                    record.rating,
                    record.rating_label,
                    "paid_report_draft",
                    now,
                ),
            )
            report = self.get_report(cursor.lastrowid, user.id, conn)
        return report.public()

    def delete_report(self, report_id: int, user: User) -> None:
        with self.connect() as conn:
            self.get_report(report_id, user.id, conn)
            conn.execute(
                "DELETE FROM stock_reports WHERE id = ? AND user_id = ?",
                (report_id, user.id),
            )

    async def analyze(
        self,
        payload: StockAnalysisRequest,
        user: User | None = None,
    ) -> StockAnalysisResponse:
        if user is not None:
            self.ensure_analysis_allowed(user)

        metrics = build_local_analysis(payload)
        ai_summary, ai_powered = await self.build_ai_summary(payload, metrics)
        result = StockAnalysisResponse(
            ticker=payload.ticker,
            name=payload.name,
            score=metrics["score"],
            rating=metrics["rating"],
            rating_label=metrics["rating_label"],
            summary=metrics["summary"],
            ai_summary=ai_summary,
            ai_powered=ai_powered,
            price_change_percent=metrics["price_change_percent"],
            volume_multiplier=metrics["volume_multiplier"],
            signals=metrics["signals"],
            risk_notes=metrics["risk_notes"],
            action_checklist=metrics["action_checklist"],
            disclaimer=DISCLAIMER,
        )
        if user is not None:
            self.save_analysis_record(user, payload, result)
        return result

    def ensure_analysis_allowed(self, user: User) -> None:
        if user.role == "admin" or user.plan == "pro":
            return

        used_count = self.monthly_analysis_count(user)
        if used_count < self.settings.free_monthly_analysis_limit:
            return

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Free plan monthly analysis limit reached. "
                "Ask an admin to upgrade this account to pro."
            ),
        )

    def monthly_analysis_count(self, user: User) -> int:
        month_start = datetime.now(UTC).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        with self.connect() as conn:
            row = conn.execute(
                """
                SELECT COUNT(*) AS count
                FROM stock_analysis_records
                WHERE user_id = ? AND created_at >= ?
                """,
                (user.id, month_start.isoformat()),
            ).fetchone()
        return int(row["count"])

    def save_analysis_record(
        self,
        user: User,
        payload: StockAnalysisRequest,
        result: StockAnalysisResponse,
    ) -> None:
        with self.connect() as conn:
            conn.execute(
                """
                INSERT INTO stock_analysis_records (
                    user_id, ticker, name, score, rating, rating_label, summary,
                    ai_summary, ai_powered, price_change_percent, volume_multiplier,
                    signals, risk_notes, action_checklist, memo, disclaimer, created_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    user.id,
                    result.ticker,
                    result.name,
                    result.score,
                    result.rating,
                    result.rating_label,
                    result.summary,
                    result.ai_summary,
                    int(result.ai_powered),
                    result.price_change_percent,
                    result.volume_multiplier,
                    json.dumps(result.signals, ensure_ascii=False),
                    json.dumps(result.risk_notes, ensure_ascii=False),
                    json.dumps(result.action_checklist, ensure_ascii=False),
                    payload.memo,
                    result.disclaimer,
                    now_iso(),
                ),
            )

    async def market_snapshot(self, ticker: str) -> StockMarketSnapshot:
        normalized_ticker = normalize_ticker(ticker)
        errors: list[str] = []

        for provider_symbol in yahoo_provider_symbols(normalized_ticker):
            try:
                candles = await self.fetch_yahoo_candles(provider_symbol)
            except httpx.HTTPError as exc:
                errors.append(f"{provider_symbol}: {exc}")
                continue

            if len(candles) >= 35:
                return build_market_snapshot(normalized_ticker, provider_symbol, candles)

            errors.append(f"{provider_symbol}: not enough market data")

        detail = "Could not load market data for this ticker."
        if errors:
            detail = f"{detail} {'; '.join(errors[:2])}"
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=detail)

    async def scan(self, payload: StockScanRequest) -> StockScanResponse:
        candidates: list[StockScanCandidate] = []
        failed: list[StockScanFailure] = []

        for ticker in payload.tickers:
            try:
                snapshot = await self.market_snapshot(ticker)
            except HTTPException as exc:
                failed.append(StockScanFailure(ticker=ticker, reason=str(exc.detail)))
                continue

            name = payload.name_map.get(snapshot.ticker, snapshot.ticker)
            analysis_payload = StockAnalysisRequest(
                ticker=snapshot.ticker,
                name=name,
                current_price=snapshot.current_price,
                previous_close=snapshot.previous_close,
                volume=snapshot.volume,
                previous_volume=snapshot.previous_volume,
                rsi=snapshot.rsi,
                macd=snapshot.macd,
                macd_signal=snapshot.macd_signal,
                memo=payload.memo,
            )
            metrics = build_local_analysis(analysis_payload)
            candidates.append(
                StockScanCandidate(
                    ticker=snapshot.ticker,
                    name=name,
                    provider_symbol=snapshot.provider_symbol,
                    latest_trading_day=snapshot.latest_trading_day,
                    current_price=snapshot.current_price,
                    previous_close=snapshot.previous_close,
                    price_change_percent=snapshot.price_change_percent,
                    volume_multiplier=snapshot.volume_multiplier,
                    rsi=snapshot.rsi,
                    macd=snapshot.macd,
                    macd_signal=snapshot.macd_signal,
                    score=metrics["score"],
                    rating=metrics["rating"],
                    rating_label=metrics["rating_label"],
                    summary=metrics["summary"],
                    signals=metrics["signals"],
                    risk_notes=metrics["risk_notes"],
                )
            )

        candidates.sort(
            key=lambda candidate: (
                candidate.score,
                candidate.volume_multiplier,
                candidate.price_change_percent,
            ),
            reverse=True,
        )
        return StockScanResponse(candidates=candidates, failed=failed, disclaimer=DISCLAIMER)

    async def fetch_yahoo_candles(self, provider_symbol: str) -> list[MarketCandle]:
        url = f"https://query1.finance.yahoo.com/v8/finance/chart/{provider_symbol}"
        params = {"range": "6mo", "interval": "1d"}

        async with httpx.AsyncClient(timeout=self.settings.market_data_timeout_seconds) as client:
            response = await client.get(url, params=params)
            response.raise_for_status()

        return parse_yahoo_chart(response.json())

    def get_holding(
        self,
        holding_id: int,
        user_id: int,
        conn: sqlite3.Connection,
    ) -> StockHolding:
        row = conn.execute(
            """
            SELECT *
            FROM stock_holdings
            WHERE id = ? AND user_id = ?
            """,
            (holding_id, user_id),
        ).fetchone()
        if row is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Stock holding not found.",
            )
        return row_to_holding(row)

    def get_watchlist_item(
        self,
        item_id: int,
        user_id: int,
        conn: sqlite3.Connection,
    ) -> StockWatchlistItem:
        row = conn.execute(
            """
            SELECT *
            FROM stock_watchlist_items
            WHERE id = ? AND user_id = ?
            """,
            (item_id, user_id),
        ).fetchone()
        if row is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Watchlist item not found.",
            )
        return row_to_watchlist_item(row)

    def get_analysis_record(
        self,
        record_id: int,
        user_id: int,
        conn: sqlite3.Connection,
    ) -> StockAnalysisRecord:
        row = conn.execute(
            """
            SELECT *
            FROM stock_analysis_records
            WHERE id = ? AND user_id = ?
            """,
            (record_id, user_id),
        ).fetchone()
        if row is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Stock analysis record not found.",
            )
        return row_to_analysis_record(row)

    def get_report(
        self,
        report_id: int,
        user_id: int,
        conn: sqlite3.Connection,
    ) -> StockReport:
        row = conn.execute(
            """
            SELECT *
            FROM stock_reports
            WHERE id = ? AND user_id = ?
            """,
            (report_id, user_id),
        ).fetchone()
        if row is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Stock report not found.",
            )
        return row_to_report(row)

    async def build_ai_summary(
        self,
        payload: StockAnalysisRequest,
        metrics: dict[str, Any],
    ) -> tuple[str, bool]:
        fallback = (
            f"{payload.name}({payload.ticker})은 현재 점수 {metrics['score']}점입니다. "
            f"거래량 배수 {metrics['volume_multiplier']}배, RSI {payload.rsi} 기준으로 "
            "관심 후보 여부를 체크하세요."
        )
        if not self.settings.openai_api_key:
            return fallback, False

        prompt = {
            "ticker": payload.ticker,
            "name": payload.name,
            "current_price": payload.current_price,
            "price_change_percent": metrics["price_change_percent"],
            "volume_multiplier": metrics["volume_multiplier"],
            "rsi": payload.rsi,
            "macd": payload.macd,
            "macd_signal": payload.macd_signal,
            "signals": metrics["signals"],
            "risk_notes": metrics["risk_notes"],
            "memo": payload.memo,
        }
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                response = await client.post(
                    f"{self.settings.openai_base_url.rstrip('/')}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {self.settings.openai_api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": self.settings.openai_model,
                        "temperature": 0.2,
                        "messages": [
                            {
                                "role": "system",
                                "content": (
                                    "너는 한국 주식 리서치 보조자다. 투자 권유가 아니라 "
                                    "조건 기반 체크리스트와 리스크를 간결하게 정리한다."
                                ),
                            },
                            {
                                "role": "user",
                                "content": (
                                    "다음 데이터를 바탕으로 4문장 이내 한국어 분석 요약을 "
                                    f"작성해줘. 데이터: {prompt}"
                                ),
                            },
                        ],
                    },
                )
                response.raise_for_status()
                data = response.json()
        except (httpx.HTTPError, KeyError, IndexError, TypeError, ValueError):
            return fallback, False

        content = data["choices"][0]["message"]["content"].strip()
        return content or fallback, bool(content)


def build_local_analysis(payload: StockAnalysisRequest) -> dict[str, Any]:
    price_change_percent = (payload.current_price - payload.previous_close) / payload.previous_close
    price_change_percent *= 100
    volume_multiplier = payload.volume / payload.previous_volume

    score = 50
    signals: list[str] = []
    risk_notes: list[str] = []

    if volume_multiplier >= 2:
        score += 18
        signals.append("전일 대비 거래량이 200% 이상 증가했습니다.")
    elif volume_multiplier >= 1.3:
        score += 8
        signals.append("거래량이 전일보다 의미 있게 증가했습니다.")
    else:
        risk_notes.append("거래량 증가가 약해 추세 확인이 더 필요합니다.")

    if payload.macd > payload.macd_signal:
        score += 12
        signals.append("MACD가 시그널선 위에 있어 단기 모멘텀이 우호적입니다.")
    else:
        score -= 8
        risk_notes.append("MACD가 시그널선 아래에 있어 모멘텀이 약합니다.")

    if 45 <= payload.rsi <= 65:
        score += 10
        signals.append("RSI가 과열권이 아닌 구간에서 추세 확인이 가능합니다.")
    elif payload.rsi > 70:
        score -= 12
        risk_notes.append("RSI가 70을 넘어 단기 과열 가능성이 있습니다.")
    elif payload.rsi < 30:
        score -= 8
        risk_notes.append("RSI가 30 미만으로 약세 또는 반등 확인 구간입니다.")

    if price_change_percent > 0:
        score += 8
        signals.append("전일 종가 대비 주가가 상승했습니다.")
    else:
        score -= 6
        risk_notes.append("전일 종가 대비 주가가 하락했습니다.")

    score = max(0, min(100, score))
    rating, rating_label = rating_for_score(score)
    summary = (
        f"{payload.name}({payload.ticker}) 조건 점수는 {score}점입니다. "
        f"가격 변화율 {price_change_percent:.2f}%, 거래량 배수 {volume_multiplier:.2f}배를 "
        "기준으로 검토했습니다."
    )

    if not risk_notes:
        risk_notes.append("현재 입력값 기준의 핵심 위험 신호는 크지 않습니다.")

    return {
        "score": score,
        "rating": rating,
        "rating_label": rating_label,
        "summary": summary,
        "price_change_percent": round(price_change_percent, 2),
        "volume_multiplier": round(volume_multiplier, 2),
        "signals": signals,
        "risk_notes": risk_notes,
        "action_checklist": [
            "실제 공시, 뉴스, 재무 상태를 추가로 확인하세요.",
            "손절 기준과 분할 매수 기준을 먼저 정리하세요.",
            "추천 결과를 그대로 주문으로 연결하지 말고 본인 판단으로 검토하세요.",
        ],
    }


def build_market_snapshot(
    ticker: str,
    provider_symbol: str,
    candles: list[MarketCandle],
) -> StockMarketSnapshot:
    if len(candles) < 35:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="At least 35 daily candles are required.",
        )

    latest = candles[-1]
    previous = candles[-2]
    closes = [candle.close for candle in candles]
    macd, macd_signal = calculate_macd(closes)
    price_change_percent = (latest.close - previous.close) / previous.close * 100
    volume_multiplier = latest.volume / previous.volume if previous.volume else 0

    return StockMarketSnapshot(
        ticker=ticker,
        provider_symbol=provider_symbol,
        source="Yahoo Finance chart API",
        latest_trading_day=latest.trading_day,
        current_price=round(latest.close, 2),
        previous_close=round(previous.close, 2),
        volume=latest.volume,
        previous_volume=max(previous.volume, 1),
        rsi=round(calculate_rsi(closes), 2),
        macd=round(macd, 4),
        macd_signal=round(macd_signal, 4),
        price_change_percent=round(price_change_percent, 2),
        volume_multiplier=round(volume_multiplier, 2),
        fetched_at=now_iso(),
    )


def parse_yahoo_chart(data: dict[str, Any]) -> list[MarketCandle]:
    try:
        result = data["chart"]["result"][0]
        timestamps = result["timestamp"]
        quote = result["indicators"]["quote"][0]
        closes = quote["close"]
        volumes = quote["volume"]
    except (KeyError, IndexError, TypeError) as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Market data provider returned an unexpected response.",
        ) from exc

    candles: list[MarketCandle] = []
    for timestamp, close, volume in zip(timestamps, closes, volumes, strict=False):
        if close is None or volume is None:
            continue
        trading_day = datetime.fromtimestamp(int(timestamp), UTC).date().isoformat()
        candles.append(
            MarketCandle(
                trading_day=trading_day,
                close=float(close),
                volume=int(volume),
            )
        )
    return candles


def calculate_rsi(closes: list[float], period: int = 14) -> float:
    if len(closes) <= period:
        return 50.0

    deltas = [closes[index] - closes[index - 1] for index in range(1, len(closes))]
    recent = deltas[-period:]
    gains = [max(delta, 0) for delta in recent]
    losses = [abs(min(delta, 0)) for delta in recent]
    average_gain = sum(gains) / period
    average_loss = sum(losses) / period

    if average_loss == 0:
        return 100.0 if average_gain > 0 else 50.0

    relative_strength = average_gain / average_loss
    return 100 - (100 / (1 + relative_strength))


def calculate_macd(closes: list[float]) -> tuple[float, float]:
    if len(closes) < 35:
        return 0.0, 0.0

    ema_12 = ema_series(closes, 12)
    ema_26 = ema_series(closes, 26)
    macd_values = [short - long for short, long in zip(ema_12, ema_26, strict=False)]
    signal_values = ema_series(macd_values, 9)
    return macd_values[-1], signal_values[-1]


def ema_series(values: list[float], period: int) -> list[float]:
    if not values:
        return []

    alpha = 2 / (period + 1)
    current = values[0]
    result = [current]
    for value in values[1:]:
        current = value * alpha + current * (1 - alpha)
        result.append(current)
    return result


def yahoo_provider_symbols(ticker: str) -> list[str]:
    if "." in ticker:
        return [ticker]
    return [f"{ticker}.KS", f"{ticker}.KQ"]


def normalize_ticker(ticker: str) -> str:
    return ticker.strip().upper()


def rating_for_score(score: int) -> tuple[str, str]:
    if score >= 75:
        return "candidate", "관심 후보"
    if score >= 55:
        return "watch", "관찰 필요"
    return "caution", "주의"


def row_to_holding(row: sqlite3.Row) -> StockHolding:
    return StockHolding(
        id=int(row["id"]),
        user_id=int(row["user_id"]),
        ticker=str(row["ticker"]),
        name=str(row["name"]),
        quantity=float(row["quantity"]),
        average_price=float(row["average_price"]),
        current_price=float(row["current_price"]),
        investment_thesis=str(row["investment_thesis"]),
        risk_memo=str(row["risk_memo"]),
        created_at=str(row["created_at"]),
        updated_at=str(row["updated_at"]),
    )


def row_to_watchlist_item(row: sqlite3.Row) -> StockWatchlistItem:
    return StockWatchlistItem(
        id=int(row["id"]),
        user_id=int(row["user_id"]),
        ticker=str(row["ticker"]),
        name=str(row["name"]),
        note=str(row["note"]),
        created_at=str(row["created_at"]),
        updated_at=str(row["updated_at"]),
    )


def row_to_analysis_record(row: sqlite3.Row) -> StockAnalysisRecord:
    return StockAnalysisRecord(
        id=int(row["id"]),
        user_id=int(row["user_id"]),
        ticker=str(row["ticker"]),
        name=str(row["name"]),
        score=int(row["score"]),
        rating=str(row["rating"]),
        rating_label=str(row["rating_label"]),
        summary=str(row["summary"]),
        ai_summary=str(row["ai_summary"]),
        ai_powered=bool(row["ai_powered"]),
        price_change_percent=float(row["price_change_percent"]),
        volume_multiplier=float(row["volume_multiplier"]),
        signals=str(row["signals"]),
        risk_notes=str(row["risk_notes"]),
        action_checklist=str(row["action_checklist"]),
        memo=str(row["memo"]),
        disclaimer=str(row["disclaimer"]),
        created_at=str(row["created_at"]),
    )


def row_to_report(row: sqlite3.Row) -> StockReport:
    return StockReport(
        id=int(row["id"]),
        user_id=int(row["user_id"]),
        analysis_record_id=int(row["analysis_record_id"]),
        ticker=str(row["ticker"]),
        name=str(row["name"]),
        title=str(row["title"]),
        body=str(row["body"]),
        score=int(row["score"]),
        rating=str(row["rating"]),
        rating_label=str(row["rating_label"]),
        report_type=str(row["report_type"]),
        created_at=str(row["created_at"]),
    )


def build_report_body(record: StockAnalysisRecord) -> str:
    signals = json_list(record.signals)
    risk_notes = json_list(record.risk_notes)
    checklist = json_list(record.action_checklist)

    return "\n\n".join(
        [
            f"# {record.name}({record.ticker}) AI analysis report",
            (
                "## Summary\n"
                f"- Score: {record.score}/100 ({record.rating_label})\n"
                f"- Price change: {record.price_change_percent:.2f}%\n"
                f"- Volume multiplier: {record.volume_multiplier:.2f}x\n"
                f"- Generated from analysis record #{record.id}"
            ),
            f"## Core View\n{record.summary}\n\n{record.ai_summary}",
            "## Positive Signals\n" + bullet_list(signals),
            "## Risk Notes\n" + bullet_list(risk_notes),
            "## Action Checklist\n" + bullet_list(checklist),
            f"## Analyst Memo\n{record.memo or 'No memo was saved for this analysis.'}",
            (
                "## Usage Note\n"
                "This is a draft for a paid or member-only report. Review market news, "
                "disclosures, liquidity, and your own investment rules before publishing."
            ),
            f"## Disclaimer\n{record.disclaimer}",
        ]
    )


def bullet_list(items: list[str]) -> str:
    if not items:
        return "- No items."
    return "\n".join(f"- {item}" for item in items)


def json_list(value: str) -> list[str]:
    try:
        loaded = json.loads(value)
    except json.JSONDecodeError:
        return []
    if not isinstance(loaded, list):
        return []
    return [str(item) for item in loaded]


def now_iso() -> str:
    return datetime.now(UTC).isoformat()
