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
Write-Host "Recommendation defaults"
try {
    Invoke-RestMethod http://localhost/api/v1/recommendations/defaults
}
catch {
    Write-Host "Defaults check failed: $($_.Exception.Message)"
}
