$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$principal = [Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Run PowerShell as Administrator and try again.'
}

$server = '__SERVER__'
$work = Join-Path $env:TEMP 'sdoc-worker-install'
if (Test-Path $work) { Remove-Item $work -Recurse -Force }
New-Item -ItemType Directory -Path $work | Out-Null

Write-Host "Downloading SDOC Worker from $server (about 50 MB, the first download after a server update can take a minute) ..."
Invoke-WebRequest -Uri "$server/api/v1/worker/download" -OutFile (Join-Path $work 'worker.zip') -UseBasicParsing
Expand-Archive -Path (Join-Path $work 'worker.zip') -DestinationPath (Join-Path $work 'worker')

& (Join-Path $work 'worker\install-service.ps1') -ServerUrl $server
Remove-Item $work -Recurse -Force -ErrorAction SilentlyContinue
