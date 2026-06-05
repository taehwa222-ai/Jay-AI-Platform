$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$envPath = Join-Path $root ".env"

function Prompt-WithDefault {
    param(
        [string] $Name,
        [string] $DefaultValue
    )

    $value = Read-Host "$Name [$DefaultValue]"
    if ([string]::IsNullOrWhiteSpace($value)) {
        return $DefaultValue
    }
    return $value.Trim()
}

function New-Secret {
    $bytes = New-Object byte[] 32
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    return -join ($bytes | ForEach-Object { $_.ToString("x2") })
}

Write-Host "Configure production .env"
Write-Host "Press Enter to keep the default or leave optional values empty."
Write-Host ""

$appName = Prompt-WithDefault "APP_NAME" "Jay AI Platform"
$corsOrigins = Prompt-WithDefault "CORS_ORIGINS" "http://localhost"
$authSecretKey = Prompt-WithDefault "AUTH_SECRET_KEY" (New-Secret)

@(
    "APP_NAME=$appName"
    "APP_ENV=production"
    "API_HOST=0.0.0.0"
    "API_PORT=8000"
    "CORS_ORIGINS=$corsOrigins"
    "DATA_DIR=/app/data"
    "AUTH_SECRET_KEY=$authSecretKey"
    "ACCESS_TOKEN_MINUTES=720"
) | Set-Content -Path $envPath -Encoding UTF8

Write-Host ""
Write-Host ".env updated."
Write-Host "Run this to apply changes:"
Write-Host "  .\scripts\start-server.ps1"
