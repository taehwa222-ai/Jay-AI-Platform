from typing import Literal

from pydantic import BaseModel, Field


class PaymentOrderRequest(BaseModel):
    amount: int = Field(gt=0)


class PaymentOrderCreate(BaseModel):
    order_id: str
    amount: int
    client_key: str


class PaymentConfirmRequest(BaseModel):
    order_id: str = Field(min_length=1, max_length=200)
    payment_key: str = Field(min_length=1, max_length=200)
    amount: int = Field(gt=0)


class PaymentPublic(BaseModel):
    id: int
    order_id: str
    amount: int
    status: Literal["pending", "approved", "failed"]
    created_at: str
    approved_at: str | None = None
