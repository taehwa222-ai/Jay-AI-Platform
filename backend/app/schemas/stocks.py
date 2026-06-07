from typing import Literal

from pydantic import BaseModel, Field, field_validator


class StockHoldingCreateRequest(BaseModel):
    ticker: str = Field(min_length=3, max_length=20)
    name: str = Field(min_length=1, max_length=80)
    quantity: float = Field(gt=0)
    average_price: float = Field(gt=0)
    current_price: float = Field(gt=0)
    investment_thesis: str = Field(default="", max_length=500)
    risk_memo: str = Field(default="", max_length=500)

    @field_validator("ticker")
    @classmethod
    def normalize_ticker(cls, value: str) -> str:
        return value.strip().upper()

    @field_validator("name", "investment_thesis", "risk_memo")
    @classmethod
    def strip_text(cls, value: str) -> str:
        return value.strip()


class StockHoldingUpdateRequest(BaseModel):
    ticker: str | None = Field(default=None, min_length=3, max_length=20)
    name: str | None = Field(default=None, min_length=1, max_length=80)
    quantity: float | None = Field(default=None, gt=0)
    average_price: float | None = Field(default=None, gt=0)
    current_price: float | None = Field(default=None, gt=0)
    investment_thesis: str | None = Field(default=None, max_length=500)
    risk_memo: str | None = Field(default=None, max_length=500)

    @field_validator("ticker")
    @classmethod
    def normalize_optional_ticker(cls, value: str | None) -> str | None:
        return value.strip().upper() if value is not None else None

    @field_validator("name", "investment_thesis", "risk_memo")
    @classmethod
    def strip_optional_text(cls, value: str | None) -> str | None:
        return value.strip() if value is not None else None


class StockHoldingPublic(BaseModel):
    id: int
    ticker: str
    name: str
    quantity: float
    average_price: float
    current_price: float
    cost_basis: float
    market_value: float
    profit_loss: float
    profit_loss_percent: float
    investment_thesis: str
    risk_memo: str
    created_at: str
    updated_at: str


class StockAnalysisRequest(BaseModel):
    ticker: str = Field(min_length=3, max_length=20)
    name: str = Field(min_length=1, max_length=80)
    current_price: float = Field(gt=0)
    previous_close: float = Field(gt=0)
    volume: int = Field(ge=0)
    previous_volume: int = Field(gt=0)
    rsi: float = Field(ge=0, le=100)
    macd: float
    macd_signal: float
    memo: str = Field(default="", max_length=700)

    @field_validator("ticker")
    @classmethod
    def normalize_ticker(cls, value: str) -> str:
        return value.strip().upper()

    @field_validator("name", "memo")
    @classmethod
    def strip_text(cls, value: str) -> str:
        return value.strip()


class StockAnalysisResponse(BaseModel):
    ticker: str
    name: str
    score: int
    rating: Literal["candidate", "watch", "caution"]
    rating_label: str
    summary: str
    ai_summary: str
    ai_powered: bool
    price_change_percent: float
    volume_multiplier: float
    signals: list[str]
    risk_notes: list[str]
    action_checklist: list[str]
    disclaimer: str
