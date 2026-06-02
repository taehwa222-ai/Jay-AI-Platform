from __future__ import annotations

import httpx

from app.config import Settings
from app.schemas.stocks import RecommendationRequest, StockCandidate


class OpenAIAnalyzer:
    def __init__(self, settings: Settings):
        self.settings = settings

    async def analyze(
        self,
        request: RecommendationRequest,
        candidates: list[StockCandidate],
    ) -> str:
        if not candidates:
            return "No symbols passed the current custom volume filter."
        if not self.settings.has_model_provider:
            return self._local_analysis(request, candidates)
        return await self._openai_analysis(request, candidates)

    def _local_analysis(
        self,
        request: RecommendationRequest,
        candidates: list[StockCandidate],
    ) -> str:
        top = sorted(candidates, key=lambda item: item.volume_ratio, reverse=True)[:3]
        lines = [
            (
                "Local analyst mode: OpenAI credentials are not configured, "
                "so this is a rule-based summary."
            ),
            f"Custom rule: current volume >= previous volume x {request.volume_multiplier:.2f}.",
        ]
        for item in top:
            rsi = format_indicator(item.indicators.rsi)
            macd_hist = format_indicator(item.indicators.macd_histogram)
            lines.append(
                f"- {item.symbol}: volume ratio {item.volume_ratio:.2f}x, "
                f"price change {item.change_percent:.2f}%, RSI {rsi}, MACD histogram {macd_hist}."
            )
        lines.append("Use this as a screening signal, not as financial advice.")
        return "\n".join(lines)

    async def _openai_analysis(
        self,
        request: RecommendationRequest,
        candidates: list[StockCandidate],
    ) -> str:
        prompt = build_prompt(request, candidates)
        payload = {
            "model": self.settings.openai_model,
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "You are a cautious stock screening assistant. Explain signals, "
                        "risks, and what to verify next. Do not promise returns."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
            "temperature": 0.2,
        }
        url = self.settings.openai_base_url.rstrip("/") + "/chat/completions"
        headers = {"Authorization": f"Bearer {self.settings.openai_api_key}"}
        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.post(url, json=payload, headers=headers)
            response.raise_for_status()
        data = response.json()
        return data["choices"][0]["message"]["content"]


def build_prompt(request: RecommendationRequest, candidates: list[StockCandidate]) -> str:
    # Customize this prompt when you want the AI to rank candidates differently.
    rows = []
    for item in candidates:
        rows.append(
            {
                "symbol": item.symbol,
                "close": item.close,
                "change_percent": item.change_percent,
                "volume": item.volume,
                "previous_volume": item.previous_volume,
                "volume_ratio": item.volume_ratio,
                "rsi": item.indicators.rsi,
                "macd": item.indicators.macd,
                "macd_signal": item.indicators.macd_signal,
                "macd_histogram": item.indicators.macd_histogram,
            }
        )
    return (
        "Analyze these stock screening candidates.\n"
        f"Custom filter: current volume must be at least {request.volume_multiplier:.2f}x "
        "the previous candle volume.\n"
        "Use RSI and MACD as supporting indicators. Give a short ranked view, risk notes, "
        "and what I should verify before trading.\n\n"
        f"Candidates: {rows}"
    )


def format_indicator(value: float | None) -> str:
    return "n/a" if value is None else f"{value:.2f}"
