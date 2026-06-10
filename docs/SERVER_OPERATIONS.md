# Server Operations

Use these commands from the repository root.

## Start Or Redeploy

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\start-server.ps1
```

This builds the containers and starts the server.

## Deploy To VPS From Local PC

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\deploy-vps.ps1 -ServerHost YOUR_SERVER_IP
```

With a local SSH key file:

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\deploy-vps.ps1 `
  -ServerHost YOUR_SERVER_IP `
  -IdentityFile C:\path\to\your-key.pem
```

This runs verification, pushes to GitHub, deploys on the VPS over SSH, and then
checks the public health endpoint.

## Status

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\status-server.ps1
```

Expected URLs:

```text
http://localhost
http://localhost/#dashboard
http://localhost/#auth
http://localhost/#admin
http://localhost/#manual
http://localhost/#stocks
http://localhost/#revenue
http://localhost/docs
http://localhost/api/v1/health
http://localhost/api/v1/platform/overview
```

The frontend uses hash-based screens so non-technical users can work from one
clear page at a time without adding another routing dependency.

## Member Data

The app stores member accounts in SQLite:

```text
DATA_DIR/jay_ai_platform.db
```

In Docker/VPS deployment, `./data` is mounted into the backend container. Keep
that folder when redeploying so accounts are preserved.

The first registered account becomes `admin`. Admin users can change member
roles and enable or disable accounts from the admin screen.

## Stock And Portfolio Data

The same SQLite database also stores each user's stock holdings. The frontend
uses `/api/v1/stocks/holdings` for portfolio management and
`/api/v1/stocks/watchlist` for pre-buy monitoring lists.
`/api/v1/stocks/holdings/refresh-prices` refreshes saved holding prices from
the market data provider and reports failed tickers separately.
`/api/v1/stocks/analyze` handles condition-based stock analysis. The endpoint
`/api/v1/stocks/market/{ticker}` loads a market snapshot and calculates RSI and
MACD so users do not need to enter every indicator manually.
`/api/v1/stocks/analysis-records` lists saved analysis history, and individual
records can be deleted when they are no longer useful.
`/api/v1/stocks/scan` accepts multiple tickers and returns ranked candidates
with failed lookups separated from successful results.
The frontend separates this into focused stock tabs for holdings, watchlist,
single-stock analysis, and multi-stock scanning.

OpenAI summary generation is optional. Set these values in `.env` on the VPS
when you want AI-generated summaries:

```text
OPENAI_API_KEY=your_key_here
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini
MARKET_DATA_TIMEOUT_SECONDS=10
FREE_MONTHLY_ANALYSIS_LIMIT=20
```

When `OPENAI_API_KEY` is empty, the stock analyzer still returns a local
rule-based summary.

Admins can switch members between `free` and `pro` plans. Free members are
limited by `FREE_MONTHLY_ANALYSIS_LIMIT`; pro members and admins are unlimited.

## Stop

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\stop-server.ps1
```

## Configure Production Environment

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\configure-production.ps1
```

Then restart:

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\start-server.ps1
```

Secrets are written to `.env`, which is ignored by Git.
