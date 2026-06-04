$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$pidPath = Join-Path $root ".dev-local-pids.json"
$venvPython = Join-Path $root ".venv\Scripts\python.exe"
$localEnvPath = Join-Path $root ".env.local"

Set-Location $root

if (-not (Test-Path $venvPython)) {
    Write-Host "Missing .venv. Running setup-local-dev.ps1 first..."
    & (Join-Path $PSScriptRoot "setup-local-dev.ps1")
}

if (-not (Test-Path "frontend\node_modules")) {
    Write-Host "Missing frontend node_modules. Running setup-local-dev.ps1 first..."
    & (Join-Path $PSScriptRoot "setup-local-dev.ps1")
}

$localEnvLines = @(
    "APP_ENV=development"
    "CORS_ORIGINS=http://127.0.0.1:5173,http://localhost:5173"
)
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllLines($localEnvPath, $localEnvLines, $utf8NoBom)

$backendArgs = "-NoExit -ExecutionPolicy Bypass -Command `"`$env:APP_ENV='development'; `$env:CORS_ORIGINS='http://127.0.0.1:5173,http://localhost:5173'; Set-Location '$root'; & '$venvPython' -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8001`""
$frontendArgs = "-NoExit -ExecutionPolicy Bypass -Command `"`$env:VITE_API_BASE_URL='http://127.0.0.1:8001'; Set-Location '$root\frontend'; npm run dev -- --host 127.0.0.1 --port 5173`""

$backend = Start-Process powershell.exe -ArgumentList $backendArgs -WindowStyle Hidden -PassThru
$frontend = Start-Process powershell.exe -ArgumentList $frontendArgs -WindowStyle Hidden -PassThru

@{
    backend = $backend.Id
    frontend = $frontend.Id
    started_at = (Get-Date).ToString("o")
} | ConvertTo-Json | Set-Content -Path $pidPath -Encoding UTF8

Write-Host ""
Write-Host "Local development servers are starting."
Write-Host "Frontend: http://127.0.0.1:5173"
Write-Host "Backend:  http://127.0.0.1:8001"
Write-Host "Docs:     http://127.0.0.1:8001/docs"
Write-Host ""
Write-Host "Check status: powershell.exe -ExecutionPolicy Bypass -File scripts\status-local-dev.ps1"
Write-Host "Stop:         powershell.exe -ExecutionPolicy Bypass -File scripts\stop-local-dev.ps1"
