$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$principal = [Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Run PowerShell as Administrator and try again.'
}

$server = '__SERVER__'
$work = Join-Path $env:TEMP 'sdoc-agent-install'
if (Test-Path $work) { Remove-Item $work -Recurse -Force }
New-Item -ItemType Directory -Path $work | Out-Null

Write-Host "Downloading SDOC Agent from $server ..."
Invoke-WebRequest -Uri "$server/api/v1/agent/download" -OutFile (Join-Path $work 'agent.zip') -UseBasicParsing
Expand-Archive -Path (Join-Path $work 'agent.zip') -DestinationPath (Join-Path $work 'agent')

& (Join-Path $work 'agent\install-service.ps1') -ServerUrl $server
Remove-Item $work -Recurse -Force -ErrorAction SilentlyContinue
