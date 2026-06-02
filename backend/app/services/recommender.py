from __future__ import annotations

from app.config import Settings
from app.schemas.stocks import (
    RecommendationRequest,
    RecommendationResponse,
    StockCandidate,
    StockCandle,
    TechnicalIndicators,
    TickerError,
)
from app.services.indicators import calculate_indicators
from app.services.openai_analyzer import OpenAIAnalyzer
from app.services.stock_data import StockDataError, StockDataProvider


class RecommendationEngine:
    def __init__(
        self,
        data_provider: StockDataProvider,
        analyzer: OpenAIAnalyzer,
        settings: Settings,
    ):
        self.data_provider = data_provider
        self.analyzer = analyzer
        self.settings = settings

    async def run(self, request: RecommendationRequest) -> RecommendationResponse:
        symbols = normalize_symbols(request.tickers or self.settings.default_ticker_list)
        candidates: list[StockCandidate] = []
        errors: list[TickerError] = []

        for symbol in symbols:
            try:
                candles = await self.data_provider.fetch_history(
                    symbol=symbol,
                    period=request.period,
                    interval=request.interval,
                )
                candidate = build_candidate(symbol, candles, request.volume_multiplier)
                if candidate:
                    candidates.append(candidate)
            except StockDataError as exc:
                errors.append(TickerError(symbol=symbol, message=str(exc)))
            except Exception as exc:  # pragma: no cover - broker/data APIs can fail in many ways
                errors.append(TickerError(symbol=symbol, message=f"Unexpected error: {exc}"))

        candidates.sort(key=lambda item: item.volume_ratio, reverse=True)
        analysis = await self.analyzer.analyze(request=request, candidates=candidates)
        return RecommendationResponse(
            scanned=symbols,
            candidates=candidates,
            analysis=analysis,
            errors=errors,
        )


def normalize_symbols(symbols: list[str]) -> list[str]:
    normalized: list[str] = []
    for symbol in symbols:
        clean = symbol.strip().upper()
        if clean and clean not in normalized:
            normalized.append(clean)
    return normalized


def build_candidate(
    symbol: str,
    candles: list[StockCandle],
    volume_multiplier: float,
) -> StockCandidate | None:
    # This is the core custom rule area. Add your own filters here:
    # moving-average trend, market cap, sector, earnings date, ATR, or risk limits.
    if len(candles) < 35:
        raise StockDataError("At least 35 candles are required for RSI/MACD.")

    previous = candles[-2]
    latest = candles[-1]
    if previous.volume <= 0:
        return None

    volume_ratio = latest.volume / previous.volume
    if volume_ratio < volume_multiplier:
        return None

    closes = [candle.close for candle in candles]
    change_percent = ((latest.close - previous.close) / previous.close) * 100
    indicators = calculate_indicators(closes)
    return StockCandidate(
        symbol=symbol,
        close=round(latest.close, 4),
        previous_close=round(previous.close, 4),
        change_percent=round(change_percent, 2),
        volume=latest.volume,
        previous_volume=previous.volume,
        volume_ratio=round(volume_ratio, 2),
        indicators=indicators
        if indicators
        else TechnicalIndicators(rsi=None, macd=None, macd_signal=None, macd_histogram=None),
        reason=(
            f"Volume spike detected: {latest.volume:,} vs {previous.volume:,} "
            f"({volume_ratio:.2f}x)."
        ),
    )
