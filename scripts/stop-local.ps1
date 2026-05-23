# File: stop local dev services and clean test artifacts.
# Purpose: stop node / Next dev, stop the local PostgreSQL fallback when it can be identified, clean .next and test-results, and print port status.

$ErrorActionPreference = "Stop"

$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
Set-Location $repoRoot

function Write-Step {
  param([string]$Message)

  Write-Host ""
  Write-Host "===== $Message ====="
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

function Get-ListeningPids {
  param([int]$Port)

  $rows = netstat -ano | findstr ":$Port"
  if (-not $rows) {
    return @()
  }

  $pids = @()
  foreach ($row in $rows) {
    $parts = ($row -split "\s+") | Where-Object { $_ }
    if ($parts.Count -gt 0) {
      $pidText = $parts[-1]
      $pidValue = 0
      if ([int]::TryParse($pidText, [ref]$pidValue)) {
        $pids += $pidValue
      }
    }
  }

  return $pids | Sort-Object -Unique
}

function Get-ProjectPostgresProcesses {
  $listeningPids = @(Get-ListeningPids -Port 55432)

  foreach ($listenPid in $listeningPids) {
    $process = Get-Process -Id $listenPid -ErrorAction SilentlyContinue
    if ($process -and $process.ProcessName -like "postgres*") {
      [pscustomobject]@{
        Id = [int]$process.Id
        Name = $process.ProcessName
        CommandLine = ""
        ExecutablePath = ""
      }
    }
  }
}

Write-Step "Check project root"
if (-not (Test-Path -LiteralPath "package.json")) {
  throw "Run from D:\ceshi\qiwei first, then rerun scripts\stop-local.ps1."
}
Write-Host "Current directory: $(Get-Location)"

Write-Step "Stop node / Next dev processes"
$nodeProcesses = Get-Process node -ErrorAction SilentlyContinue
if ($nodeProcesses) {
  $nodeProcesses | Stop-Process -Force
  Write-Host "Stopped node process count: $($nodeProcesses.Count)"
} else {
  Write-Host "No node processes found."
}

Write-Step "Stop local PostgreSQL fallback"
$projectPostgresProcesses = @(Get-ProjectPostgresProcesses)
if ($projectPostgresProcesses.Count -gt 0) {
  $projectPostgresProcesses | Select-Object Id, Name | Format-Table -AutoSize
  $projectPostgresProcesses | ForEach-Object {
    Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
  }
  Write-Host "Stopped project-related postgres process count: $($projectPostgresProcesses.Count)"
} else {
  Write-Host "No project-related postgres process found."
}

Write-Step "Clean .next"
Remove-Item -Recurse -Force ".next" -ErrorAction SilentlyContinue
Write-Host ".next cleaned."

Write-Step "Clean test-results"
Remove-Item -Recurse -Force "test-results" -ErrorAction SilentlyContinue
Write-Host "test-results cleaned."

Write-Step "Check port 3000"
$webListening = Test-PortListening -Port 3000
Show-PortRows -Port 3000
if ($webListening) {
  Write-Host "3000: LISTENING"
} else {
  Write-Host "3000: NOT LISTENING"
}

Write-Step "Check port 55432"
$dbListening = Test-PortListening -Port 55432
Show-PortRows -Port 55432
if ($dbListening) {
  Write-Host "55432: LISTENING"
} else {
  Write-Host "55432: NOT LISTENING"
}

Write-Host ""
Write-Host "Local dev stop and cache cleanup completed."
