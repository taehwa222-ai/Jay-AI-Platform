param(
    [string] $ServerHost = $env:VPS_HOST,
    [string] $ServerUser = $env:VPS_USER,
    [string] $ProjectDir = $env:VPS_PROJECT_DIR,
    [string] $IdentityFile = $env:VPS_SSH_KEY_PATH,
    [string] $Branch = "main",
    [string] $CommitMessage = "",
    [switch] $SkipTests,
    [switch] $SkipPush
)

$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $root

if ([string]::IsNullOrWhiteSpace($ServerUser)) {
    $ServerUser = "ubuntu"
}

if ([string]::IsNullOrWhiteSpace($ProjectDir)) {
    $ProjectDir = "/home/$ServerUser/Jay-AI-Platform"
}

if ([string]::IsNullOrWhiteSpace($ServerHost)) {
    throw "ServerHost is required. Example: scripts\deploy-vps.ps1 -ServerHost 54.116.212.173"
}

if (-not $SkipTests) {
    Write-Host "Running backend tests..."
    .\.venv\Scripts\python.exe -m pytest

    Write-Host "Running backend lint..."
    .\.venv\Scripts\python.exe -m ruff check backend scripts

    Write-Host "Running frontend build verification..."
    Push-Location frontend
    try {
        npm.cmd run verify
    }
    finally {
        Pop-Location
    }
}

$pendingChanges = git status --porcelain
if ($pendingChanges) {
    if ([string]::IsNullOrWhiteSpace($CommitMessage)) {
        throw "There are uncommitted changes. Pass -CommitMessage ""Your message"" or commit first."
    }

    Write-Host "Committing local changes..."
    git add -A
    git commit -m $CommitMessage
}

if (-not $SkipPush) {
    Write-Host "Pushing $Branch to GitHub..."
    git push origin $Branch
}

$remote = "$ServerUser@$ServerHost"
$remoteCommand = "cd '$ProjectDir' && git fetch origin $Branch && git checkout $Branch && git pull --ff-only origin $Branch && bash scripts/deploy-ubuntu.sh"
$sshArgs = @("-o", "StrictHostKeyChecking=accept-new")

if (-not [string]::IsNullOrWhiteSpace($IdentityFile)) {
    $sshArgs += @("-i", $IdentityFile)
}

$sshArgs += @($remote, $remoteCommand)

Write-Host "Deploying on VPS $remote..."
ssh @sshArgs

Write-Host ""
Write-Host "Running public smoke checks..."
.\.venv\Scripts\python.exe scripts\smoke-platform.py `
    --base-url "http://$ServerHost" `
    --frontend-url "http://$ServerHost"

Write-Host ""
Write-Host "VPS deployment complete."
