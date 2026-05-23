# File: local environment checker.
# Purpose: check port 55432, port 3000, node/postgres processes, and the /login page.

$ErrorActionPreference = "Stop"

$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
Set-Location $repoRoot

function Write-Step {
  param([string]$Message)

  Write-Host ""
  Write-Host "===== $Message ====="
}

function Test-TcpPort {
  param(
    [string]$HostName,
    [int]$Port
  )

  $client = New-Object System.Net.Sockets.TcpClient
  try {
    $async = $client.BeginConnect($HostName, $Port, $null, $null)
    $connected = $async.AsyncWaitHandle.WaitOne(2000, $false)
    if (-not $connected) {
      return $false
    }
    $client.EndConnect($async)
    return $true
  } catch {
    return $false
  } finally {
    $client.Close()
  }
}

function Test-PortListening {
  param([int]$Port)

  $rows = netstat -ano | findstr ":$Port"
  if (-not $rows) {
    return $false
  }

  return [bool]($rows | Select-String "LISTENING")
}

function Show-PortRows {
  param([int]$Port)

  $rows = netstat -ano | findstr ":$Port"
  if ($rows) {
    Write-Host $rows
  } else {
    Write-Host "No records found for port $Port."
  }
}

function Test-LoginPageReady {
  try {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:3000/login" -UseBasicParsing -TimeoutSec 5
    if ($response.StatusCode -ne 200) {
      return $false
    }

    return ($response.Content -match 'name="email"' -and $response.Content -match 'name="password"')
  } catch {
    return $false
  }
}

Write-Step "Check project root"
if (-not (Test-Path -LiteralPath "package.json")) {
  throw "Run from D:\ceshi\qiwei first, then rerun scripts\check-local.ps1."
}
Write-Host "Current directory: $(Get-Location)"

Write-Step "Check node processes"
$nodeProcesses = Get-Process node -ErrorAction SilentlyContinue
if ($nodeProcesses) {
  $nodeProcesses | Select-Object Id, ProcessName, StartTime -ErrorAction SilentlyContinue | Format-Table -AutoSize
} else {
  Write-Host "No node processes found."
}

Write-Step "Check postgres processes"
$postgresProcesses = Get-Process postgres -ErrorAction SilentlyContinue
if ($postgresProcesses) {
  $postgresProcesses | Select-Object Id, ProcessName, StartTime -ErrorAction SilentlyContinue | Format-Table -AutoSize
} else {
  Write-Host "No postgres processes found."
}

Write-Step "Check database port 55432"
$dbListening = Test-PortListening -Port 55432
Show-PortRows -Port 55432
if ($dbListening) {
  Write-Host "55432: LISTENING"
} else {
  Write-Host "55432: NOT LISTENING"
}

Write-Step "Check web port 3000"
$webListening = Test-PortListening -Port 3000
Show-PortRows -Port 3000
if ($webListening) {
  Write-Host "3000: LISTENING"
} else {
  Write-Host "3000: NOT LISTENING"
}

Write-Step "Check /login page"
$loginReady = $false
if (Test-TcpPort -HostName "127.0.0.1" -Port 3000) {
  $loginReady = Test-LoginPageReady
}

if ($loginReady) {
  Write-Host "/login: reachable and login form is ready."
} else {
  Write-Host "/login: not reachable or login form is not ready."
}

Write-Step "Local environment result"
if ($dbListening -and $webListening -and $loginReady) {
  Write-Host "Result: OPENABLE"
  Write-Host "URL: http://127.0.0.1:3000/login"
} else {
  Write-Host "Result: NOT OPENABLE"
  if (-not $webListening) {
    Write-Host "Keep the start-local.ps1 window open until Next dev is ready."
  }
  if (-not $dbListening) {
    Write-Host "55432 is not listening. Run scripts\start-local.ps1 first."
  }
  Write-Host "Suggestion: run scripts\stop-local.ps1, then scripts\start-local.ps1. Test only after both 55432 and 3000 are LISTENING."
}
