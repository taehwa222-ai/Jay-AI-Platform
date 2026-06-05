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
