#Requires -RunAsAdministrator

param(
    [string]$ServerUrl,
    [string]$InstallDir = "C:\Program Files\SDOC Agent",
    [string]$ServiceName = "SDOCAgent"
)

$ErrorActionPreference = "Stop"

do {
    $machineId = (Read-Host "Machine ID (the #number shown next to this computer on the Dashboard)").Trim()
} until ($machineId -match '^[1-9]\d*$')

do {
    $secureKey = Read-Host "Worker API key" -AsSecureString
} until ($secureKey.Length -gt 0)

$allow = Read-Host "Allow remote control (commands, files, screen) on this computer? [y/N]"

$existing = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "Removing the existing $ServiceName service..."
    if ($existing.Status -ne "Stopped") { Stop-Service -Name $ServiceName -Force }
    sc.exe delete $ServiceName | Out-Null
    Start-Sleep -Seconds 2
}

if ((Resolve-Path $PSScriptRoot).Path -ne $InstallDir) {
    Write-Host "Copying files to $InstallDir ..."
    New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
    Copy-Item -Path (Join-Path $PSScriptRoot "*") -Destination $InstallDir -Recurse -Force
}
Get-ChildItem -Path $InstallDir -Recurse -File | Unblock-File

$settingsPath = Join-Path $InstallDir "appsettings.json"
$settings = Get-Content $settingsPath -Raw | ConvertFrom-Json
$settings.Agent.MachineId = [int]$machineId
if ($ServerUrl) { $settings.Agent.ServerUrl = $ServerUrl }
$settings.Agent | Add-Member -Force -NotePropertyName AllowRemoteControl -NotePropertyValue ($allow -match '^(y|yes)$')
$settings | ConvertTo-Json -Depth 10 | Set-Content $settingsPath -Encoding UTF8

New-Service -Name $ServiceName `
            -DisplayName "SDOC Agent" `
            -Description "Service Desk Operations Center - sends CPU/RAM/latency of this computer to the server." `
            -BinaryPathName "`"$InstallDir\sdoc.exe`"" `
            -StartupType Automatic | Out-Null
sc.exe failure $ServiceName reset= 86400 actions= restart/60000/restart/60000/restart/60000 | Out-Null

$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
try {
    $plainKey = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    Set-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Services\$ServiceName" `
                     -Name "Environment" -Type MultiString -Value @("WORKER_API_KEY=$plainKey")
}
finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    Remove-Variable plainKey -ErrorAction SilentlyContinue
}

Start-Service -Name $ServiceName
Get-Service -Name $ServiceName | Format-Table Name, DisplayName, Status, StartType -AutoSize
Write-Host "Done. Machine $machineId will appear online on the Dashboard within a few seconds."
Write-Host "Problems (warnings/errors) are logged in Event Viewer -> Windows Logs -> Application."
