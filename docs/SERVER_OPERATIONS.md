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
http://localhost/docs
http://localhost/api/v1/health
http://localhost/api/v1/platform/overview
```

## Member Data

The app stores member accounts in SQLite:

```text
DATA_DIR/jay_ai_platform.db
```

In Docker/VPS deployment, `./data` is mounted into the backend container. Keep
that folder when redeploying so accounts are preserved.

The first registered account becomes `admin`. Admin users can change member
roles and enable or disable accounts from the dashboard.

## Stock And Portfolio Data

The same SQLite database also stores each user's stock holdings. The frontend
uses `/api/v1/stocks/holdings` for portfolio management and
`/api/v1/stocks/analyze` for condition-based stock analysis.

OpenAI summary generation is optional. Set these values in `.env` on the VPS
when you want AI-generated summaries:

```text
OPENAI_API_KEY=your_key_here
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini
```

When `OPENAI_API_KEY` is empty, the stock analyzer still returns a local
rule-based summary.

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
