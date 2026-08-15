from datetime import datetime

from pydantic import BaseModel


class TelegramNotificationResult(BaseModel):
    configured: bool
    sent: bool
    item_count: int = 0


class NotificationEvent(BaseModel):
    id: int
    event_type: str
    title: str
    status: str
    item_count: int
    error_message: str | None
    attempt_count: int
    created_at: datetime
    last_attempt_at: datetime


class NotificationCenterStatus(BaseModel):
    configured: bool
    chat_target: str
    ai_daily_count: int
    ai_daily_limit: int
    events: list[NotificationEvent]
