from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.routers.auth import require_admin
from app.schemas.notifications import NotificationCenterStatus, TelegramNotificationResult
from app.services.auth import User
from app.services.disclosures import DisclosureService
from app.services.telegram import TelegramService

router = APIRouter(prefix="/api/v1/notifications", tags=["notifications"])

IMPORTANT_DISCLOSURE_KEYWORDS = (
    "주요사항보고서",
    "공급계약",
    "유상증자",
    "무상증자",
    "합병",
    "분할",
    "최대주주",
    "소송",
    "영업정지",
    "부도",
)


@router.post("/telegram/test", response_model=TelegramNotificationResult)
async def test_telegram(
    _: Annotated[User, Depends(require_admin)],
    request: Request,
) -> TelegramNotificationResult:
    service: TelegramService = request.app.state.telegram_service
    sent = await service.send_test()
    return TelegramNotificationResult(configured=service.configured, sent=sent)


@router.post("/telegram/disclosures/{ticker}", response_model=TelegramNotificationResult)
async def notify_important_disclosures(
    ticker: str,
    _: Annotated[User, Depends(require_admin)],
    request: Request,
) -> TelegramNotificationResult:
    disclosure_service: DisclosureService = request.app.state.disclosure_service
    telegram_service: TelegramService = request.app.state.telegram_service
    disclosures = await disclosure_service.get_recent_disclosures(ticker)
    important = [
        item
        for item in disclosures
        if any(keyword in item.title for keyword in IMPORTANT_DISCLOSURE_KEYWORDS)
    ]
    sent = await telegram_service.notify_disclosures(ticker.strip().upper(), important)
    return TelegramNotificationResult(
        configured=telegram_service.configured,
        sent=sent,
        item_count=len(important),
    )


@router.get("/status", response_model=NotificationCenterStatus)
async def get_notification_status(
    _: Annotated[User, Depends(require_admin)],
    request: Request,
) -> NotificationCenterStatus:
    telegram_service: TelegramService = request.app.state.telegram_service
    ai_guardrail = request.app.state.ai_guardrail
    return NotificationCenterStatus(
        configured=telegram_service.configured,
        chat_target=telegram_service.masked_chat_target,
        ai_daily_count=ai_guardrail.today_count(),
        ai_daily_limit=ai_guardrail.settings.ai_daily_limit,
        events=telegram_service.list_events(),
    )


@router.post("/events/{event_id}/retry", response_model=TelegramNotificationResult)
async def retry_notification(
    event_id: int,
    _: Annotated[User, Depends(require_admin)],
    request: Request,
) -> TelegramNotificationResult:
    service: TelegramService = request.app.state.telegram_service
    sent = await service.retry_event(event_id)
    if sent is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification event not found.",
        )
    return TelegramNotificationResult(configured=service.configured, sent=sent)
