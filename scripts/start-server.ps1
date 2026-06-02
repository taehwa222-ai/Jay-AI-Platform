$ErrorActionPreference = "Stop"

Set-Location (Join-Path $PSScriptRoot "..")

docker compose up -d --build

Write-Host ""
Write-Host "Server is starting."
Write-Host "App:  http://localhost"
Write-Host "Docs: http://localhost/docs"
