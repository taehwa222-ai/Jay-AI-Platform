from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.config import Settings, get_settings
from app.routers.auth import get_current_user
from app.schemas.payments import (
    PaymentConfirmRequest,
    PaymentOrderCreate,
    PaymentOrderRequest,
    PaymentPublic,
)
from app.services.auth import User
from app.services.payments import PaymentService

router = APIRouter(prefix="/api/v1/payments", tags=["payments"])


def get_payment_service(request: Request) -> PaymentService:
    return request.app.state.payment_service


@router.post(
    "/orders",
    response_model=PaymentOrderCreate,
    status_code=status.HTTP_201_CREATED,
)
async def create_order(
    payload: PaymentOrderRequest,
    user: Annotated[User, Depends(get_current_user)],
    payment_service: Annotated[PaymentService, Depends(get_payment_service)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> PaymentOrderCreate:
    if payload.amount != settings.pro_upgrade_price_krw:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Payment amount does not match the pro plan price.",
        )

    payment = payment_service.create_pending_payment(user.id, payload.amount)
    return PaymentOrderCreate(
        order_id=payment.order_id,
        amount=payment.amount,
        client_key=settings.toss_client_key,
    )


@router.post("/confirm", response_model=PaymentPublic)
async def confirm(
    payload: PaymentConfirmRequest,
    user: Annotated[User, Depends(get_current_user)],
    payment_service: Annotated[PaymentService, Depends(get_payment_service)],
) -> PaymentPublic:
    pending = payment_service.get_pending_payment(payload.order_id)
    if pending is None or pending.user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Pending payment order not found for this user.",
        )

    payment = payment_service.confirm_payment(
        payload.order_id,
        payload.payment_key,
        payload.amount,
    )
    return PaymentPublic(**payment.public())


@router.get("/me", response_model=list[PaymentPublic])
async def my_payments(
    user: Annotated[User, Depends(get_current_user)],
    payment_service: Annotated[PaymentService, Depends(get_payment_service)],
) -> list[PaymentPublic]:
    return [
        PaymentPublic(**payment.public()) for payment in payment_service.get_my_payments(user.id)
    ]
