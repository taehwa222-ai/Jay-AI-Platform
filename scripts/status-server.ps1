$ErrorActionPreference = "Stop"

Set-Location (Join-Path $PSScriptRoot "..")

Write-Host "Docker services"
docker compose ps

Write-Host ""
Write-Host "Health"
try {
    Invoke-RestMethod http://localhost/api/v1/health
}
catch {
    Write-Host "Health check failed: $($_.Exception.Message)"
}

Write-Host ""
Write-Host "Platform overview"
try {
    Invoke-RestMethod http://localhost/api/v1/platform/overview
}
catch {
    Write-Host "Overview check failed: $($_.Exception.Message)"
}
