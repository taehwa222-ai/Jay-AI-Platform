# Jay AI Platform

FastAPI, React, Docker Compose, and VPS deployment foundation for building an
AI revenue platform.

The previous sample feature set has been removed. The project is now a clean
base that you can extend with your own modules.

## Current Foundation

- FastAPI backend with `/api/v1/health`
- Platform overview, module, manual, roadmap, and monetization routes
- Vite React operation dashboard
- Docker Compose deployment shape
- Ubuntu VPS bootstrap and deploy scripts
- Local no-Docker development scripts

## Product Direction

- Build member signup, login, and role-based admin pages first.
- Provide an in-app manual for local development, GitHub flow, and VPS deployment.
- Add Korea stock analysis and portfolio management as a later module.
- Explore revenue models such as subscriptions, paid reports, B2B automation, and education content.

## Screen Structure

- `Dashboard`: service status, platform overview, module map, and roadmap.
- `Login`: signup, login, logout, and account status.
- `Admin`: member list, role control, and account activation.
- `Manual`: local development, GitHub flow, and VPS deployment steps.
- `Korea Stocks`: tabbed portfolio, watchlist, stock analysis, and candidate scanning.
- `Revenue`: subscription, report, B2B automation, and education ideas.

## Member Access

- The first signed-up user automatically becomes `admin`.
- Later signed-up users become `member`.
- Admin users can open the member list from the dedicated admin screen.
- Admin users can promote/demote members and enable/disable accounts.
- The app prevents disabling your own account or removing the last active admin.
- User data is stored in SQLite at `DATA_DIR/jay_ai_platform.db`.
- In Docker/VPS deployment, `./data` is mounted into the backend container so user data survives rebuilds.

## Korea Stock Lab

- Logged-in users can save Korean stock holdings with ticker, quantity, average price, current price, thesis, and risk memo.
- Logged-in users can save a separate watchlist for stocks they want to monitor before buying.
- The portfolio screen calculates cost basis, market value, profit/loss, and profit/loss percentage.
- The stock analyzer scores a candidate using price change, volume multiplier, RSI, and MACD inputs.
- Users can load a Korean stock market snapshot by ticker; the server tries `.KS` and `.KQ` Yahoo Finance symbols.
- The snapshot fills current price, previous close, volume, previous volume, RSI, MACD, and MACD signal.
- Users can refresh all saved holding prices at once from the portfolio tab.
- Users can scan multiple tickers at once and review ranked candidates by score.
- Users can scan their saved watchlist with one click.
- The stock screen is split into `Holdings`, `Watchlist`, `AI Analysis`, and `Candidate Scan` tabs so each workflow stays focused.
- If `OPENAI_API_KEY` is configured on the server, the analyzer also adds an AI-generated Korean summary.
- If the OpenAI key is empty, the same endpoint still returns a rule-based local summary.
- Analysis results are informational only and include a non-advisory disclaimer.

## Project Shape

```text
backend/app/main.py          FastAPI app wiring
backend/app/routers          HTTP routes
backend/app/services         Future business logic
backend/app/schemas          Future request/response contracts
frontend/src                 React dashboard
scripts                      Local and VPS operation scripts
docs                         Beginner deployment notes
```

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

Platform overview:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/api/v1/platform/overview
```

Smoke test:

```powershell
python scripts\smoke-platform.py
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

Copy `.env.example` to `.env` when you need to override local settings.

```text
APP_NAME=Jay AI Platform
APP_ENV=development
API_HOST=127.0.0.1
API_PORT=8000
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
DATA_DIR=backend/data
AUTH_SECRET_KEY=change-this-local-secret
ACCESS_TOKEN_MINUTES=720
OPENAI_API_KEY=
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini
MARKET_DATA_TIMEOUT_SECONDS=10
```

Keep real service keys out of GitHub, screenshots, chat messages, and commit
history. `.env` is ignored by Git.

## Docker Deployment

For server deployment, copy the production env template and start Docker Compose:

```powershell
Copy-Item .env.production.example .env
docker compose up -d --build
```

The frontend listens on port `80` and proxies `/api`, `/docs`, and
`/openapi.json` to the FastAPI backend container.

## One Command VPS Deployment

After SSH access from your PC to the VPS is configured, this command verifies,
pushes, deploys, and checks the public health endpoint:

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\deploy-vps.ps1 -ServerHost YOUR_SERVER_IP
```

If your SSH key is a local file, pass it explicitly:

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\deploy-vps.ps1 `
  -ServerHost YOUR_SERVER_IP `
  -IdentityFile C:\path\to\your-key.pem
```

If there are local changes, pass a commit message:

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\deploy-vps.ps1 `
  -ServerHost YOUR_SERVER_IP `
  -CommitMessage "Your change"
```

## GitHub Push Auto Deploy

The repository includes `.github/workflows/deploy-vps.yml`. To enable automatic
deployment after every push to `main`, add these GitHub Actions values:

```text
Repository variable:
AUTO_DEPLOY_ENABLED=true

Repository secrets:
VPS_HOST=YOUR_SERVER_IP
VPS_USER=ubuntu
VPS_DEPLOY_PATH=/home/ubuntu/Jay-AI-Platform
VPS_SSH_KEY=your private deploy key
```

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

Configure production `.env`:

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
