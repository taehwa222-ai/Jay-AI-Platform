$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $root

function Resolve-Python {
    $localPython = Join-Path $root ".venv\Scripts\python.exe"
    if (Test-Path $localPython) {
        return $localPython
    }

    $parentPython = Join-Path (Split-Path $root -Parent) ".venv\Scripts\python.exe"
    if (Test-Path $parentPython) {
        return $parentPython
    }

    $candidates = @(
        @{ Command = "py"; Args = @("-3.12") },
        @{ Command = "py"; Args = @("-3") },
        @{ Command = "python"; Args = @() }
    )

    foreach ($candidate in $candidates) {
        $command = Get-Command $candidate.Command -ErrorAction SilentlyContinue
        if ($null -eq $command) {
            continue
        }
        try {
            & $candidate.Command @($candidate.Args + @("-c", "import sys")) | Out-Null
            if ($LASTEXITCODE -eq 0) {
                return $candidate.Command
            }
        }
        catch {
            continue
        }
    }

    throw "Python 3 is required. Install Python 3.12, then run this script again."
}

if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    Write-Host "Created .env from .env.example."
}

if (-not (Test-Path ".venv\Scripts\python.exe")) {
    $pythonCommand = Resolve-Python
    Write-Host "Creating backend virtual environment..."
    & $pythonCommand -m venv .venv
}

$venvPython = Join-Path $root ".venv\Scripts\python.exe"
Write-Host "Installing backend dependencies..."
& $venvPython -m pip install --upgrade pip
& $venvPython -m pip install -r backend\requirements-dev.txt

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    throw "Node.js/npm is required. Install Node.js LTS, then run this script again."
}

if (-not (Test-Path "frontend\node_modules")) {
    Write-Host "Installing frontend dependencies..."
    Push-Location frontend
    try {
        npm install
    }
    finally {
        Pop-Location
    }
}
else {
    Write-Host "Frontend dependencies already installed."
}

Write-Host ""
Write-Host "Local development setup complete."
Write-Host "Run: powershell.exe -ExecutionPolicy Bypass -File scripts\start-local-dev.ps1"
