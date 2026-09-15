param(
    [string]$TaskName = 'MoharpThreadsAutomation',
    [switch]$Disabled
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$runner = Join-Path $PSScriptRoot 'run-automation.ps1'
$resolvedRoot = [System.IO.Path]::GetFullPath($projectRoot)
$resolvedRunner = [System.IO.Path]::GetFullPath($runner)

if (-not $resolvedRunner.StartsWith($resolvedRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw 'Scheduled task runner is outside the project directory.'
}

$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$resolvedRunner`""
$morning = New-ScheduledTaskTrigger -Daily -At '08:10'
$midday = New-ScheduledTaskTrigger -Daily -At '13:10'
$evening = New-ScheduledTaskTrigger -Daily -At '19:40'
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 15)
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger @($morning, $midday, $evening) -Settings $settings -Description 'Moharp research, card rendering, and Threads publishing pipeline' -Force
if ($Disabled) {
    Disable-ScheduledTask -TaskName $TaskName | Out-Null
}
Write-Host "Scheduled task installed: $TaskName"
