param(
    [string]$TaskName = 'MoharpThreadsAutomation'
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot

& npm run start -- doctor
if ($LASTEXITCODE -ne 0) {
    throw 'Go-live checks failed. The scheduled task remains disabled.'
}

Enable-ScheduledTask -TaskName $TaskName | Out-Null
Write-Host "Scheduled task enabled: $TaskName"
