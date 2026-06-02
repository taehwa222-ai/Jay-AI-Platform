from app.schemas.stocks import TechnicalIndicators


def calculate_indicators(closes: list[float]) -> TechnicalIndicators:
    """Calculate the indicators we want to pass into the AI prompt."""
    macd, macd_signal, macd_histogram = calculate_macd(closes)
    return TechnicalIndicators(
        rsi=round_optional(calculate_rsi(closes)),
        macd=round_optional(macd),
        macd_signal=round_optional(macd_signal),
        macd_histogram=round_optional(macd_histogram),
    )


def calculate_rsi(closes: list[float], period: int = 14) -> float | None:
    if len(closes) <= period:
        return None

    gains: list[float] = []
    losses: list[float] = []
    for previous, current in zip(closes[:-1], closes[1:], strict=False):
        delta = current - previous
        gains.append(max(delta, 0.0))
        losses.append(abs(min(delta, 0.0)))

    average_gain = sum(gains[-period:]) / period
    average_loss = sum(losses[-period:]) / period
    if average_loss == 0:
        return 100.0

    relative_strength = average_gain / average_loss
    return 100 - (100 / (1 + relative_strength))


def calculate_macd(
    closes: list[float],
    fast_period: int = 12,
    slow_period: int = 26,
    signal_period: int = 9,
) -> tuple[float | None, float | None, float | None]:
    if len(closes) < slow_period + signal_period:
        return None, None, None

    fast_ema = ema_series(closes, fast_period)
    slow_ema = ema_series(closes, slow_period)
    macd_line = [fast - slow for fast, slow in zip(fast_ema, slow_ema, strict=False)]
    signal_line = ema_series(macd_line, signal_period)
    histogram = macd_line[-1] - signal_line[-1]
    return macd_line[-1], signal_line[-1], histogram


def ema_series(values: list[float], period: int) -> list[float]:
    if not values:
        return []
    multiplier = 2 / (period + 1)
    ema_values = [values[0]]
    for value in values[1:]:
        ema_values.append((value - ema_values[-1]) * multiplier + ema_values[-1])
    return ema_values


def round_optional(value: float | None, digits: int = 2) -> float | None:
    return None if value is None else round(value, digits)
