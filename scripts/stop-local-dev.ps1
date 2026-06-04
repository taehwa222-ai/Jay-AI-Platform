$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$pidPath = Join-Path $root ".dev-local-pids.json"

if (Test-Path $pidPath) {
    $resolvedPidPath = (Resolve-Path -LiteralPath $pidPath).Path
    if (-not $resolvedPidPath.StartsWith($root)) {
        throw "Refusing to modify a process file outside the project: $resolvedPidPath"
    }

    $pids = Get-Content $resolvedPidPath | ConvertFrom-Json
    foreach ($name in @("backend", "frontend")) {
        $processId = [int] $pids.$name
        $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
        if ($null -eq $process) {
            Write-Host "$name already stopped."
            continue
        }
        Stop-Process -Id $processId -Force
        Write-Host "Stopped $name pid=$processId."
    }
}
else {
    Write-Host "No local development process file found. Checking project ports anyway."
}

foreach ($port in @(8001, 8000, 5173)) {
    for ($attempt = 1; $attempt -le 5; $attempt++) {
        $connections = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
        if (-not $connections) {
            break
        }

        $ownerIds = $connections | Select-Object -ExpandProperty OwningProcess -Unique
        foreach ($ownerId in $ownerIds) {
            $processId = [int] $ownerId
            $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
            if ($null -eq $process) {
                continue
            }
            Stop-Process -Id $processId -Force
            Write-Host "Stopped process on port $port pid=$processId."
        }

        Start-Sleep -Milliseconds 500
    }
}

if (Test-Path $pidPath) {
    $resolvedPidPath = (Resolve-Path -LiteralPath $pidPath).Path
    Remove-Item -LiteralPath $resolvedPidPath -Force
}
Write-Host "Local development servers stopped."
