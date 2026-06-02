from __future__ import annotations

import httpx

from app.config import Settings
from app.schemas.stocks import StockCandidate, TelegramResult


class TelegramNotifier:
    def __init__(self, settings: Settings):
        self.settings = settings

    async def send(
        self,
        candidates: list[StockCandidate],
        analysis: str,
        enabled: bool,
    ) -> TelegramResult:
        if not enabled:
            return TelegramResult(status="skipped", message="Telegram sending was not requested.")
        if not self.settings.has_telegram:
            return TelegramResult(
                status="skipped",
                message="Telegram bot token or chat id is missing.",
            )
        if not candidates:
            return TelegramResult(status="skipped", message="No candidates to send.")

        text = format_telegram_message(candidates, analysis)
        url = f"https://api.telegram.org/bot{self.settings.telegram_bot_token}/sendMessage"
        payload = {
            "chat_id": self.settings.telegram_chat_id,
            "text": text[:3900],
            "disable_web_page_preview": True,
        }
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                response = await client.post(url, json=payload)
                response.raise_for_status()
        except httpx.HTTPError as exc:
            return TelegramResult(status="failed", message=str(exc))
        return TelegramResult(status="sent", message="Telegram message sent.")


def format_telegram_message(candidates: list[StockCandidate], analysis: str) -> str:
    symbols = ", ".join(candidate.symbol for candidate in candidates)
    return f"Stock AI candidates: {symbols}\n\n{analysis}"
