$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot

$logDirectory = Join-Path $projectRoot 'logs'
if (-not (Test-Path -LiteralPath $logDirectory)) {
    New-Item -ItemType Directory -Path $logDirectory | Out-Null
}

$stamp = Get-Date -Format 'yyyy-MM-dd-HHmmss'
$logFile = Join-Path $logDirectory "scheduler-$stamp.log"
& npm run toss:sync 2>&1 | Out-File -LiteralPath $logFile -Append -Encoding utf8
$tossExit = $LASTEXITCODE
if ($tossExit -ne 0) {
    "[경고] 토스 상품 동기화 실패(exit $tossExit). 제휴 기획은 보류하고 일반 콘텐츠 흐름을 계속합니다." | Out-File -LiteralPath $logFile -Append -Encoding utf8
}
& npm run research:collect 2>&1 | Out-File -LiteralPath $logFile -Append -Encoding utf8
$researchExit = $LASTEXITCODE
if ($researchExit -ne 0) { exit $researchExit }
& npm run research:validate 2>&1 | Out-File -LiteralPath $logFile -Append -Encoding utf8
$researchValidationExit = $LASTEXITCODE
if ($researchValidationExit -ne 0) { exit $researchValidationExit }
& npm run start -- sync-products 2>&1 | Out-File -LiteralPath $logFile -Append -Encoding utf8
$syncExit = $LASTEXITCODE
if ($syncExit -ne 0) { exit $syncExit }
& npm run start -- run 2>&1 | Out-File -LiteralPath $logFile -Append -Encoding utf8
$publishExit = $LASTEXITCODE
& npm run start -- insights 2>&1 | Out-File -LiteralPath $logFile -Append -Encoding utf8
if ($publishExit -ne 0) { exit $publishExit }
exit $LASTEXITCODE
