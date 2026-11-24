# Installs (or reinstalls) the SDOC Agent as a Windows service.
# Run from the published folder, in PowerShell started "as Administrator":
#   powershell -ExecutionPolicy Bypass -File .\install-service.ps1
#Requires -RunAsAdministrator

param(
    [string]$InstallDir = "C:\Program Files\SDOC Agent",
    [string]$ServiceName = "SDOCAgent"
)

$ErrorActionPreference = "Stop"

# 1. Stop and remove the old version, if it exists
$existing = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "Removing the existing $ServiceName service..."
    if ($existing.Status -ne "Stopped") { Stop-Service -Name $ServiceName -Force }
    sc.exe delete $ServiceName | Out-Null
    Start-Sleep -Seconds 2
}

# 2. Copy the program files to the install folder
if ((Resolve-Path $PSScriptRoot).Path -ne $InstallDir) {
    Write-Host "Copying files to $InstallDir ..."
    New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
    Copy-Item -Path (Join-Path $PSScriptRoot "*") -Destination $InstallDir -Recurse -Force
}

# 3. MachineId of this computer -> appsettings.json
$settingsPath = Join-Path $InstallDir "appsettings.json"
$settings = Get-Content $settingsPath -Raw | ConvertFrom-Json
$machineId = Read-Host "MachineId for this computer (number, Enter = keep $($settings.Agent.MachineId))"
while ($machineId -and $machineId -notmatch '^\d+$') {
    $machineId = Read-Host "MachineId must be a number"
}
if ($machineId) {
    $settings.Agent.MachineId = [int]$machineId
}

# Local consent: without it the agent refuses commands, file transfer and screen control,
# even if an administrator enables remote control on the server
$allow = Read-Host "Allow remote control (commands, files, screen) on this computer? [y/N]"
$settings.Agent | Add-Member -Force -NotePropertyName AllowRemoteControl -NotePropertyValue ($allow -match '^(y|yes)$')
$settings | ConvertTo-Json -Depth 10 | Set-Content $settingsPath -Encoding UTF8

# 4. Create the service: starts with Windows, restarts itself after a crash
New-Service -Name $ServiceName `
            -DisplayName "SDOC Agent" `
            -Description "Service Desk Operations Center - sends CPU/RAM/latency of this computer to the server." `
            -BinaryPathName "`"$InstallDir\sdoc.exe`"" `
            -StartupType Automatic | Out-Null
sc.exe failure $ServiceName reset= 86400 actions= restart/60000/restart/60000/restart/60000 | Out-Null

# 5. API key: an environment variable visible only to this service (typed in, never shown)
$secureKey = Read-Host "WORKER_API_KEY" -AsSecureString
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

# 6. Start
Start-Service -Name $ServiceName
Get-Service -Name $ServiceName | Format-Table Name, DisplayName, Status, StartType -AutoSize
Write-Host "Done. Problems (warnings/errors) are logged in Event Viewer -> Windows Logs -> Application."
