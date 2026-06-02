# Start Here

The first goal is one working vertical slice:

```text
Ticker input -> FastAPI route -> yfinance data -> custom filter -> RSI/MACD
-> OpenAI analysis -> web result -> optional Telegram message
```

## Architecture

```text
backend/app/main.py
  routers/stocks.py
    services/recommender.py
      services/stock_data.py
      services/indicators.py
      services/openai_analyzer.py
      services/telegram.py
```

## Where To Customize

1. `backend/app/services/recommender.py`

   Change the screening rule in `build_candidate()`.

2. `backend/app/services/indicators.py`

   Add Bollinger Bands, moving averages, ATR, or your own indicator.

3. `backend/app/services/openai_analyzer.py`

   Change `build_prompt()` to control what the AI sees and how it ranks candidates.

4. `backend/app/services/telegram.py`

   Change the alert format.

## Next Build Steps

- Add a watchlist table in PostgreSQL.
- Save every scan result.
- Add a scheduler for market close scans.
- Add auth before exposing the server.
- Add backtesting before trusting a new rule.
