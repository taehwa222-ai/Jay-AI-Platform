from datetime import UTC, datetime

from pydantic import BaseModel, Field


class RecommendationRequest(BaseModel):
    tickers: list[str] = Field(default_factory=list)
    period: str = "6mo"
    interval: str = "1d"
    volume_multiplier: float = Field(default=2.0, ge=1.0, le=20.0)


class StockCandle(BaseModel):
    date: str
    open: float
    high: float
    low: float
    close: float
    volume: int


class TechnicalIndicators(BaseModel):
    rsi: float | None
    macd: float | None
    macd_signal: float | None
    macd_histogram: float | None


class StockCandidate(BaseModel):
    symbol: str
    close: float
    previous_close: float
    change_percent: float
    volume: int
    previous_volume: int
    volume_ratio: float
    indicators: TechnicalIndicators
    reason: str


class TickerError(BaseModel):
    symbol: str
    message: str


class RecommendationResponse(BaseModel):
    generated_at: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())
    scanned: list[str]
    candidates: list[StockCandidate]
    analysis: str
    errors: list[TickerError] = Field(default_factory=list)
