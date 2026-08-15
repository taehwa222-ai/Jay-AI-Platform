from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import UTC, datetime

import httpx

from app.config import Settings
from app.schemas.notifications import NotificationEvent
from app.schemas.stocks import StockAnalysisResponse
from app.services.database import connect_database
from app.services.disclosures import Disclosure

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class TelegramDelivery:
    sent: bool
    error_message: str | None = None


class TelegramService:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.db_path = settings.database_path

    def init_db(self) -> None:
        with connect_database(self.db_path) as connection:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS telegram_notification_events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    event_type TEXT NOT NULL,
                    title TEXT NOT NULL,
                    message TEXT NOT NULL,
                    status TEXT NOT NULL,
                    item_count INTEGER NOT NULL DEFAULT 0,
                    error_message TEXT,
                    attempt_count INTEGER NOT NULL DEFAULT 1,
                    created_at TEXT NOT NULL,
                    last_attempt_at TEXT NOT NULL
                )
                """
            )

    @property
    def configured(self) -> bool:
        return bool(
            self.settings.telegram_bot_token.strip()
            and self.settings.telegram_chat_id.strip()
        )

    @property
    def masked_chat_target(self) -> str:
        chat_id = self.settings.telegram_chat_id.strip()
        if not chat_id:
            return "미설정"
        return f"••••{chat_id[-4:]}" if len(chat_id) > 4 else "••••"

    async def deliver_message(self, text: str) -> TelegramDelivery:
        if not self.configured:
            return TelegramDelivery(False, "Telegram bot token 또는 chat ID가 설정되지 않았습니다.")
        url = (
            f"https://api.telegram.org/bot"
            f"{self.settings.telegram_bot_token.strip()}/sendMessage"
        )
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                response = await client.post(
                    url,
                    json={
                        "chat_id": self.settings.telegram_chat_id.strip(),
                        "text": text,
                        "disable_web_page_preview": True,
                    },
                )
                response.raise_for_status()
        except httpx.HTTPError as error:
            error_name = type(error).__name__
            logger.warning("Telegram notification failed: %s", error_name)
            return TelegramDelivery(False, f"{error_name}: Telegram API 요청에 실패했습니다.")
        return TelegramDelivery(True)

    async def send_message(self, text: str) -> bool:
        return (await self.deliver_message(text)).sent

    async def send_test(self) -> bool:
        return await self.send_and_record(
            event_type="connection_test",
            title="텔레그램 연결 테스트",
            message="[Jay AI] Internal Business OS 알림 연결 테스트",
        )

    async def send_and_record(
        self,
        *,
        event_type: str,
        title: str,
        message: str,
        item_count: int = 0,
    ) -> bool:
        delivery = await self.deliver_message(message)
        self._record_event(
            event_type=event_type,
            title=title,
            message=message,
            status="sent" if delivery.sent else "failed",
            item_count=item_count,
            error_message=delivery.error_message,
        )
        return delivery.sent

    async def notify_analysis_complete(self, result: StockAnalysisResponse) -> bool:
        message = "\n".join(
            [
                "[Jay AI] 종목 분석 완료",
                f"{result.name} ({result.ticker})",
                f"점수: {result.score} / 판단: {result.rating_label}",
                result.summary,
            ]
        )
        return await self.send_and_record(
            event_type="analysis_complete",
            title=f"{result.name} AI 분석 완료",
            message=message,
            item_count=1,
        )

    async def notify_disclosures(
        self,
        ticker: str,
        disclosures: list[Disclosure],
    ) -> bool:
        if not disclosures:
            self._record_event(
                event_type="important_disclosures",
                title=f"{ticker} 주요 공시 확인",
                message=f"[Jay AI] {ticker} 주요 공시가 없습니다.",
                status="skipped",
                item_count=0,
                error_message=None,
            )
            return False
        lines = [f"[Jay AI] {ticker} 주요 공시 {len(disclosures)}건"]
        lines.extend(
            f"- {item.date} {item.title}\n  {item.url}" for item in disclosures[:5]
        )
        return await self.send_and_record(
            event_type="important_disclosures",
            title=f"{ticker} 주요 공시 {len(disclosures)}건",
            message="\n".join(lines),
            item_count=len(disclosures),
        )

    def list_events(self, limit: int = 20) -> list[NotificationEvent]:
        with connect_database(self.db_path) as connection:
            rows = connection.execute(
                """
                SELECT id, event_type, title, status, item_count, error_message,
                       attempt_count, created_at, last_attempt_at
                FROM telegram_notification_events
                ORDER BY id DESC
                LIMIT ?
                """,
                (limit,),
            ).fetchall()
        return [NotificationEvent.model_validate(dict(row)) for row in rows]

    async def retry_event(self, event_id: int) -> bool | None:
        with connect_database(self.db_path) as connection:
            row = connection.execute(
                """
                SELECT id, message, attempt_count
                FROM telegram_notification_events
                WHERE id = ?
                """,
                (event_id,),
            ).fetchone()
        if row is None:
            return None

        delivery = await self.deliver_message(str(row["message"]))
        attempted_at = datetime.now(UTC).isoformat()
        with connect_database(self.db_path) as connection:
            connection.execute(
                """
                UPDATE telegram_notification_events
                SET status = ?, error_message = ?, attempt_count = ?, last_attempt_at = ?
                WHERE id = ?
                """,
                (
                    "sent" if delivery.sent else "failed",
                    delivery.error_message,
                    int(row["attempt_count"]) + 1,
                    attempted_at,
                    event_id,
                ),
            )
        return delivery.sent

    def _record_event(
        self,
        *,
        event_type: str,
        title: str,
        message: str,
        status: str,
        item_count: int,
        error_message: str | None,
    ) -> None:
        now = datetime.now(UTC).isoformat()
        with connect_database(self.db_path) as connection:
            connection.execute(
                """
                INSERT INTO telegram_notification_events (
                    event_type, title, message, status, item_count, error_message,
                    attempt_count, created_at, last_attempt_at
                ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
                """,
                (
                    event_type,
                    title,
                    message,
                    status,
                    item_count,
                    error_message,
                    now,
                    now,
                ),
            )
