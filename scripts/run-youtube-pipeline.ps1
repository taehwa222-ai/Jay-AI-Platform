param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectDir,
    [switch]$Upload,
    [switch]$RegenerateVoice,
    [switch]$RegenerateImages,
    [switch]$DryRun
)

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$python = Join-Path $projectRoot ".venv\Scripts\python.exe"
if (-not (Test-Path -LiteralPath $python)) {
    throw "가상환경이 없습니다: $python"
}

$env:PYTHONPATH = Join-Path $projectRoot "backend"
$arguments = @(
    (Join-Path $projectRoot "scripts\youtube-auto-pipeline.py"),
    "--project-dir",
    $ProjectDir
)
if ($Upload) { $arguments += "--upload" }
if ($RegenerateVoice) { $arguments += "--regenerate-voice" }
if ($RegenerateImages) { $arguments += "--regenerate-images" }
if ($DryRun) { $arguments += "--dry-run" }

& $python @arguments
exit $LASTEXITCODE
