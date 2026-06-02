from __future__ import annotations

import asyncio
from typing import Any

from app.schemas.stocks import StockCandle


class StockDataError(RuntimeError):
    pass


class StockDataProvider:
    async def fetch_history(self, symbol: str, period: str, interval: str) -> list[StockCandle]:
        raise NotImplementedError


class YFinanceStockDataProvider(StockDataProvider):
    async def fetch_history(self, symbol: str, period: str, interval: str) -> list[StockCandle]:
        return await asyncio.to_thread(self._fetch_history_sync, symbol, period, interval)

    def _fetch_history_sync(self, symbol: str, period: str, interval: str) -> list[StockCandle]:
        try:
            import yfinance as yf
        except ImportError as exc:
            raise StockDataError("Install yfinance to fetch live market data.") from exc

        ticker = yf.Ticker(symbol)
        frame = ticker.history(period=period, interval=interval, auto_adjust=False)
        if frame is None or frame.empty:
            raise StockDataError("No price history returned.")

        candles: list[StockCandle] = []
        for index, row in frame.tail(240).iterrows():
            date_value = index.date() if hasattr(index, "date") else index
            candles.append(
                StockCandle(
                    date=str(date_value),
                    open=safe_float(row.get("Open")),
                    high=safe_float(row.get("High")),
                    low=safe_float(row.get("Low")),
                    close=safe_float(row.get("Close")),
                    volume=int(safe_float(row.get("Volume"))),
                )
            )
        return [candle for candle in candles if candle.close > 0 and candle.volume >= 0]


def safe_float(value: Any) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0
