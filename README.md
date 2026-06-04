# Jay Stock AI Server

FastAPI, OpenAI-compatible API, and `yfinance` based stock screening server.

This project uses a stable server template shape:

- `routers`: HTTP endpoints
- `services`: business logic
- `schemas`: request and response contracts
- `config`: environment variables
- `frontend`: Vite React dashboard

The custom recommendation logic lives mainly in:

- `backend/app/services/recommender.py`
- `backend/app/services/indicators.py`
- `backend/app/services/openai_analyzer.py`

## Current Custom Features

- Volume spike filter: latest volume must be at least `volume_multiplier` times the previous candle.
- RSI calculation is included in each candidate.
- MACD, MACD signal, and MACD histogram are included in each candidate.
- OpenAI prompt receives the filtered candidates plus RSI/MACD context.
- If OpenAI is not configured, the server returns a local rule-based analysis so development still works.

This server is a screening tool, not financial advice.

## Start Order

1. Make the backend run locally.
2. Confirm `/api/v1/health` works.
3. Run one recommendation scan without OpenAI.
4. Add OpenAI credentials.
5. Customize `build_candidate()` and `build_prompt()` for your own strategy.
6. Add persistence, scheduling, auth, and deployment.

## Backend

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r backend\requirements-dev.txt
uvicorn app.main:app --app-dir backend --reload --host 127.0.0.1 --port 8000
```

Health check:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/api/v1/health
```

Run a scan:

```powershell
Invoke-RestMethod `
  -Method Post `
  -Uri http://127.0.0.1:8000/api/v1/recommendations/run `
  -ContentType "application/json" `
  -Body '{"tickers":["AAPL","MSFT","NVDA"],"volume_multiplier":2.0,"period":"6mo","interval":"1d"}'
```

Smoke test with live `yfinance` data:

```powershell
python scripts\smoke-recommendations.py
```

## Frontend

```powershell
cd frontend
npm install
npm run dev
```

Open:

```text
http://localhost:5173
```

## Local Development Without Docker

Install backend and frontend dependencies once:

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\setup-local-dev.ps1
```

Start both backend and frontend directly on Windows:

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\start-local-dev.ps1
```

Open:

```text
http://127.0.0.1:5173
```

Check or stop the local dev servers:

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\status-local-dev.ps1
powershell.exe -ExecutionPolicy Bypass -File scripts\stop-local-dev.ps1
```

## Environment

Copy `.env.example` to `.env`.

```text
OPENAI_API_KEY=
OPENAI_MODEL=
```

`OPENAI_MODEL` can be any chat-completions-compatible model exposed by your configured `OPENAI_BASE_URL`.

## Docker Deployment

For server deployment, copy the production env template and start Docker Compose:

```powershell
Copy-Item .env.production.example .env
docker compose up -d --build
```

The frontend listens on port `80` and proxies `/api`, `/docs`, and
`/openapi.json` to the FastAPI backend container.

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for the Ubuntu VPS flow.
For a step-by-step first server deployment, see
[docs/VPS_DEPLOYMENT_STEP_BY_STEP.md](docs/VPS_DEPLOYMENT_STEP_BY_STEP.md).

## Local Docker Operations

Start or redeploy:

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\start-server.ps1
```

Check status:

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\status-server.ps1
```

Stop:

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\stop-server.ps1
```

Configure OpenAI key:

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\configure-production.ps1
```

On an Ubuntu VPS:

```bash
bash scripts/bootstrap-ubuntu.sh
bash scripts/configure-ubuntu-env.sh
bash scripts/deploy-ubuntu.sh
```

See [docs/SERVER_OPERATIONS.md](docs/SERVER_OPERATIONS.md) for daily operations.
