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

Write-Host "Configure production .env"
Write-Host "Press Enter to keep the default or leave optional values empty."
Write-Host ""

$appName = Prompt-WithDefault "APP_NAME" "Jay Stock AI Server"
$corsOrigins = Prompt-WithDefault "CORS_ORIGINS" "http://localhost"
$defaultTickers = Prompt-WithDefault "DEFAULT_TICKERS" "AAPL,MSFT,NVDA,TSLA,AMD,META,GOOGL,AMZN"
$volumeMultiplier = Prompt-WithDefault "DEFAULT_VOLUME_MULTIPLIER" "2.0"
$openaiBaseUrl = Prompt-WithDefault "OPENAI_BASE_URL" "https://api.openai.com/v1"
$openaiModel = Read-Host "OPENAI_MODEL"
$openaiApiKey = Read-Host "OPENAI_API_KEY"

@(
    "APP_NAME=$appName"
    "APP_ENV=production"
    "API_HOST=0.0.0.0"
    "API_PORT=8000"
    "CORS_ORIGINS=$corsOrigins"
    "DEFAULT_TICKERS=$defaultTickers"
    "DEFAULT_VOLUME_MULTIPLIER=$volumeMultiplier"
    ""
    "OPENAI_API_KEY=$openaiApiKey"
    "OPENAI_BASE_URL=$openaiBaseUrl"
    "OPENAI_MODEL=$openaiModel"
) | Set-Content -Path $envPath -Encoding UTF8

Write-Host ""
Write-Host ".env updated."
Write-Host "Run this to apply changes:"
Write-Host "  .\scripts\start-server.ps1"
