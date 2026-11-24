#Requires -RunAsAdministrator

param(
    [string]$ServerUrl,
    [string]$InstallDir = "C:\Program Files\SDOC Worker",
    [string]$ServiceName = "SDOCWorker"
)

$ErrorActionPreference = "Stop"

do {
    $machineId = (Read-Host "Machine ID (the #number shown next to this computer on the Dashboard)").Trim()
} until ($machineId -match '^[1-9]\d*$')

do {
    $secureKey = Read-Host "Worker API key" -AsSecureString
} until ($secureKey.Length -gt 0)

$allow = Read-Host "Allow remote control (commands, files, screen) on this machine? [y/N]"

$existing = @(Get-Service -Name $ServiceName, "SDOCAgent" -ErrorAction SilentlyContinue)
foreach ($service in $existing) {
    Write-Host "Removing the existing $($service.Name) service..."
    if ($service.Status -ne "Stopped") { Stop-Service -Name $service.Name -Force -NoWait -ErrorAction SilentlyContinue }
}
Get-Process -Name SDOC -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
foreach ($service in $existing) { sc.exe delete $service.Name | Out-Null }
if ($existing) { Start-Sleep -Seconds 2 }
Remove-Item "C:\Program Files\SDOC Agent" -Recurse -Force -ErrorAction SilentlyContinue

if ((Resolve-Path $PSScriptRoot).Path -ne $InstallDir) {
    Write-Host "Copying files to $InstallDir (antivirus scanning can make this take a minute) ..."
    robocopy $PSScriptRoot $InstallDir /E /R:3 /W:2 /NFL /NDL /NJH /NJS /NP | Out-Null
    if ($LASTEXITCODE -ge 8) { throw "Copying files failed (robocopy exit code $LASTEXITCODE). Close anything using $InstallDir and run the installer again." }
    Write-Host "Files copied."
}
Get-ChildItem -Path $InstallDir -Recurse -File | Unblock-File
Write-Host "Configuring the service..."

$settingsPath = Join-Path $InstallDir "appsettings.json"
$settings = Get-Content $settingsPath -Raw | ConvertFrom-Json
$settings.Worker.MachineId = [int]$machineId
if ($ServerUrl) { $settings.Worker.ServerUrl = $ServerUrl }
$settings.Worker | Add-Member -Force -NotePropertyName AllowRemoteControl -NotePropertyValue ($allow -match '^(y|yes)$')
$settings | ConvertTo-Json -Depth 10 | Set-Content $settingsPath -Encoding UTF8

New-Service -Name $ServiceName `
            -DisplayName "SDOC Worker" `
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

Write-Host "Starting the service..."
Start-Service -Name $ServiceName
Get-Service -Name $ServiceName | Format-Table Name, DisplayName, Status, StartType -AutoSize
Write-Host "Done. Machine $machineId will appear online on the Dashboard within a few seconds."
Write-Host "Problems (warnings/errors) are logged in Event Viewer -> Windows Logs -> Application."
