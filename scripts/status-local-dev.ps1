$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$pidPath = Join-Path $root ".dev-local-pids.json"

Set-Location $root

Write-Host "Local process status"
if (Test-Path $pidPath) {
    $pids = Get-Content $pidPath | ConvertFrom-Json
    foreach ($name in @("backend", "frontend")) {
        $processId = [int] $pids.$name
        $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
        if ($null -eq $process) {
            Write-Host "${name}: stopped"
        }
        else {
            Write-Host "${name}: running pid=$processId"
        }
    }
}
else {
    Write-Host "No .dev-local-pids.json file found."
}

Write-Host ""
Write-Host "Backend health"
try {
    Invoke-RestMethod http://127.0.0.1:8001/api/v1/health
}
catch {
    Write-Host "Backend health failed: $($_.Exception.Message)"
}

Write-Host ""
Write-Host "Frontend"
try {
    $response = Invoke-WebRequest http://127.0.0.1:5173 -UseBasicParsing
    Write-Host "Frontend status: $($response.StatusCode)"
}
catch {
    Write-Host "Frontend check failed: $($_.Exception.Message)"
}
