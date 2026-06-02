# Server Operations

Use these commands from the repository root.

## Start Or Redeploy

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\start-server.ps1
```

This builds the containers and starts the server.

## Status

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\status-server.ps1
```

Expected URLs:

```text
http://localhost
http://localhost/docs
http://localhost/api/v1/health
```

## Stop

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\stop-server.ps1
```

## Configure Keys

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\configure-production.ps1
```

Then restart:

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\start-server.ps1
```

Secrets are written to `.env`, which is ignored by Git.
