# Local Development Without Docker

Use this when you want to run the app directly on your PC instead of through
Docker Desktop.

```text
Backend:  FastAPI/Uvicorn -> http://127.0.0.1:8001
Frontend: Vite React     -> http://127.0.0.1:5173
```

The frontend dev server proxies `/api` requests to the backend.

## 1. Install Requirements Once

From the project folder:

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\setup-local-dev.ps1
```

This creates `.venv`, installs Python packages, and runs `npm install` for the
frontend.

When the dev server starts, it writes `.env.local` with local-only settings such
as `APP_ENV=development`. Keep real service keys in `.env`; `.env.local` is
ignored by Git.

## 2. Start The App

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\start-local-dev.ps1
```

This starts a stable no-Docker local server. If you want backend auto-reload
while editing Python files, run `scripts\dev-backend.ps1` manually in a separate
PowerShell window.

Open:

```text
http://127.0.0.1:5173
```

API docs:

```text
http://127.0.0.1:8001/docs
```

## 3. Check Status

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\status-local-dev.ps1
```

## 4. Stop

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\stop-local-dev.ps1
```

## Docker Or No Docker?

Use direct local development when you are changing Python or React code often.

Use Docker when you want to test the same shape that will later run on a VPS.
