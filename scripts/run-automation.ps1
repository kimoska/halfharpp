$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot

$logDirectory = Join-Path $projectRoot 'logs'
if (-not (Test-Path -LiteralPath $logDirectory)) {
    New-Item -ItemType Directory -Path $logDirectory | Out-Null
}

$stamp = Get-Date -Format 'yyyy-MM-dd'
$logFile = Join-Path $logDirectory "scheduler-$stamp.log"
& npm run research:cycle *>> $logFile
$researchExit = $LASTEXITCODE
if ($researchExit -ne 0) { exit $researchExit }
& npm run toss:sync *>> $logFile
$tossExit = $LASTEXITCODE
if ($tossExit -ne 0) { exit $tossExit }
& npm run start -- sync-products *>> $logFile
$syncExit = $LASTEXITCODE
if ($syncExit -ne 0) { exit $syncExit }
& npm run start -- run *>> $logFile
$publishExit = $LASTEXITCODE
& npm run start -- insights *>> $logFile
if ($publishExit -ne 0) { exit $publishExit }
exit $LASTEXITCODE
