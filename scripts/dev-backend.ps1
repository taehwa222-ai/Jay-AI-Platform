$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$venvPython = Join-Path $root ".venv\Scripts\python.exe"

Set-Location $root

if (-not (Test-Path $venvPython)) {
    Write-Host "Missing .venv. Run scripts\setup-local-dev.ps1 first."
    exit 1
}

$env:APP_ENV = "development"
$env:CORS_ORIGINS = "http://127.0.0.1:5173,http://localhost:5173"
& $venvPython -m uvicorn app.main:app --app-dir backend --reload --host 127.0.0.1 --port 8001
