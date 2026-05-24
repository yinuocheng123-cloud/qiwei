# File: start local dev environment in the foreground.
# Purpose: ensure PostgreSQL fallback is ready, run db sync and quality checks, then start Next dev in the current shell.

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
Set-Location $repoRoot

function Write-Step {
  param([string]$Message)

  Write-Host ""
  Write-Host "===== $Message ====="
}

function Run-Step {
  param(
    [string]$Title,
    [scriptblock]$Command
  )

  Write-Step $Title
  $global:LASTEXITCODE = 0
  & $Command
  if ($null -ne $global:LASTEXITCODE -and $global:LASTEXITCODE -ne 0) {
    throw "$Title failed, exit code: $global:LASTEXITCODE"
  }
}

function Read-EnvValue {
  param([string]$Name)

  $envFile = Join-Path $repoRoot ".env"
  if (-not (Test-Path -LiteralPath $envFile)) {
    return $null
  }

  $line = Get-Content -LiteralPath $envFile | Where-Object { $_ -match "^$Name=" } | Select-Object -First 1
  if (-not $line) {
    return $null
  }

  return (($line -replace "^$Name=", "").Trim('"'))
}

function Resolve-PgTool {
  param([string]$Name)

  $command = Get-Command $Name -ErrorAction SilentlyContinue
  if ($command -and $command.Source) {
    return $command.Source
  }

  $fallback = "D:\tools\pgsql17\pgsql\bin\$Name.exe"
  if (Test-Path -LiteralPath $fallback) {
    Write-Host "$Name.exe is not in PATH, falling back to fixed path: $fallback"
    return $fallback
  }

  return $null
}

function Resolve-LocalPostgresDataDir {
  $candidates = @(
    (Join-Path $repoRoot ".local\postgres-data"),
    (Join-Path $repoRoot "tmp\postgres-data"),
    (Join-Path $repoRoot "custom\experiments\postgres-data")
  )

  foreach ($candidate in $candidates) {
    $resolved = [System.IO.Path]::GetFullPath($candidate)
    if (Test-Path -LiteralPath (Join-Path $resolved "PG_VERSION")) {
      return $resolved
    }
  }

  return [System.IO.Path]::GetFullPath((Join-Path $repoRoot ".local\postgres-data"))
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

function Get-ListeningPids {
  param([int]$Port)

  $rows = netstat -ano | findstr ":$Port"
  if (-not $rows) {
    return @()
  }

  $pids = @()
  foreach ($row in $rows) {
    if ($row -notmatch "LISTENING") {
      continue
    }

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

function Wait-ForPortListening {
  param(
    [int]$Port,
    [int]$Seconds
  )

  for ($i = 1; $i -le $Seconds; $i++) {
    if (Test-PortListening -Port $Port) {
      return $true
    }
    Start-Sleep -Seconds 1
  }
  return $false
}

function Test-PostgresReady {
  param([int]$Port)

  $pgReadyExe = Resolve-PgTool "pg_isready"
  if (-not $pgReadyExe) {
    return (Test-TcpPort -HostName "127.0.0.1" -Port $Port)
  }

  & $pgReadyExe -h 127.0.0.1 -p $Port -U postgres | Out-Null
  return ($LASTEXITCODE -eq 0)
}

function Wait-ForPostgresReady {
  param(
    [int]$Port,
    [int]$Seconds
  )

  for ($i = 1; $i -le $Seconds; $i++) {
    if (Test-PostgresReady -Port $Port) {
      return $true
    }
    Start-Sleep -Seconds 1
  }
  return $false
}

function Initialize-PostgresDataDir {
  param(
    [string]$DataDir,
    [string]$InitDbExe
  )

  if (-not $InitDbExe) {
    Write-Host "Missing initdb.exe. Install PostgreSQL or add its bin directory to PATH."
    return $false
  }

  $parentDir = Split-Path -Parent $DataDir
  if (-not (Test-Path -LiteralPath $parentDir)) {
    New-Item -ItemType Directory -Path $parentDir -Force | Out-Null
  }

  if (Test-Path -LiteralPath $DataDir) {
    $existingItems = Get-ChildItem -LiteralPath $DataDir -Force -ErrorAction SilentlyContinue
    if ($existingItems -and -not (Test-Path -LiteralPath (Join-Path $DataDir "PG_VERSION"))) {
      throw "Data directory $DataDir exists but is not initialized. Clear it first, or delete it and let the script run initdb."
    }
  } else {
    New-Item -ItemType Directory -Path $DataDir -Force | Out-Null
  }

  if (Test-Path -LiteralPath (Join-Path $DataDir "PG_VERSION")) {
    Write-Host "Found initialized data directory: $DataDir"
    return $true
  }

  Write-Host "No initialized data directory found, running initdb: $DataDir"
  & $InitDbExe -D $DataDir -U postgres -A trust -E UTF8 | Out-Host
  if ($LASTEXITCODE -ne 0) {
    throw "initdb failed for data directory: $DataDir"
  }

  return $true
}

function Clear-StalePostgresPid {
  param(
    [string]$DataDir,
    [int]$Port
  )

  $pidFile = Join-Path $DataDir "postmaster.pid"
  if ((Test-Path -LiteralPath $pidFile) -and -not (Test-PortListening -Port $Port)) {
    Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
    Write-Host "Removed stale postmaster.pid."
  }
}

function Ensure-LocalDatabase {
  param(
    [int]$Port,
    [string]$DatabaseName,
    [string]$PsqlExe
  )

  if (-not $PsqlExe -or -not (Test-Path -LiteralPath $PsqlExe)) {
    Write-Host "Missing psql.exe, skipping database existence check."
    return
  }

  if (-not (Wait-ForPostgresReady -Port $Port -Seconds 60)) {
    throw "PostgreSQL port is open, but it has not reached accepting connections yet."
  }

  $exists = & $PsqlExe -h 127.0.0.1 -p $Port -U postgres -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '$DatabaseName';"
  if (($exists | Out-String).Trim() -eq "1") {
    Write-Host "Database already exists: $DatabaseName"
    return
  }

  Write-Host "Database missing, creating: $DatabaseName"
  & $PsqlExe -h 127.0.0.1 -p $Port -U postgres -d postgres -c "CREATE DATABASE `"$DatabaseName`";"
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to create database: $DatabaseName"
  }
}

function Start-PostgresFallback {
  param([int]$Port)

  $postgresExe = Resolve-PgTool "postgres"
  $initDbExe = Resolve-PgTool "initdb"
  $dataDir = Resolve-LocalPostgresDataDir
  $repoLogs = Join-Path $repoRoot ".local\logs"
  $stdoutLogPath = Join-Path $repoLogs "postgres-start-local.stdout.log"
  $stderrLogPath = Join-Path $repoLogs "postgres-start-local.stderr.log"

  if (-not $postgresExe -or -not $initDbExe) {
    Write-Host "Missing PostgreSQL toolchain (postgres / initdb)."
    Write-Host "Install PostgreSQL or add its bin directory to PATH."
    return $false
  }

  if (-not (Initialize-PostgresDataDir -DataDir $dataDir -InitDbExe $initDbExe)) {
    return $false
  }

  Clear-StalePostgresPid -DataDir $dataDir -Port $Port

  if (-not (Test-Path -LiteralPath $repoLogs)) {
    New-Item -ItemType Directory -Path $repoLogs -Force | Out-Null
  }

  Write-Host "Using local PGDATA: $dataDir"
  Write-Host "stdout log: $stdoutLogPath"
  Write-Host "stderr log: $stderrLogPath"
  Write-Host "Launch command: postgres.exe -D `"$dataDir`" -p $Port"

  try {
    $psi = [System.Diagnostics.ProcessStartInfo]::new()
    $psi.FileName = $postgresExe
    $psi.Arguments = "-D `"$dataDir`" -p $Port"
    $psi.WorkingDirectory = $repoRoot
    $psi.UseShellExecute = $false
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true

    $process = [System.Diagnostics.Process]::Start($psi)
    if (-not $process) {
      throw "Failed to start postgres.exe."
    }

    $null = $process.StandardOutput.BaseStream.CopyToAsync([System.IO.File]::Create($stdoutLogPath))
    $null = $process.StandardError.BaseStream.CopyToAsync([System.IO.File]::Create($stderrLogPath))
    Write-Host "postgres.exe process id: $($process.Id)"
  } catch {
    Write-Host "Failed to launch PostgreSQL fallback with postgres.exe: $($_.Exception.Message)"
    return $false
  }

  if (-not (Wait-ForPortListening -Port $Port -Seconds 30)) {
    Write-Host "Port $Port was still not LISTENING after 30 seconds."
    Write-Host "netstat output:"
    netstat -ano | findstr ":$Port" | Out-Host
    if (Test-Path -LiteralPath $stderrLogPath) {
      Write-Host "Recent PostgreSQL error log:"
      Get-Content -LiteralPath $stderrLogPath -Tail 30 -ErrorAction SilentlyContinue | Out-Host
    }
    return $false
  }

  Write-Host "$Port is LISTENING:"
  netstat -ano | findstr ":$Port" | Out-Host

  if (-not (Wait-ForPostgresReady -Port $Port -Seconds 30)) {
    Write-Host "Port $Port is listening, but pg_isready still did not return accepting connections."
    if (Test-Path -LiteralPath $stderrLogPath) {
      Write-Host "Recent PostgreSQL error log:"
      Get-Content -LiteralPath $stderrLogPath -Tail 30 -ErrorAction SilentlyContinue | Out-Host
    }
    return $false
  }

  return $true
}

Run-Step "Check project root" {
  if (-not (Test-Path -LiteralPath "package.json")) {
    throw "Run from D:\ceshi\qiwei first, then rerun scripts\start-local.ps1."
  }
  Write-Host "Current directory: $(Get-Location)"
}

Run-Step "Stop old Next dev process on port 3000" {
  $listeningPids = @(Get-ListeningPids -Port 3000)
  if ($listeningPids.Count -gt 0) {
    foreach ($pidValue in $listeningPids) {
      $process = Get-Process -Id $pidValue -ErrorAction SilentlyContinue
      if ($process -and $process.ProcessName -eq "node") {
        Stop-Process -Id $pidValue -Force
        Write-Host "Stopped node process listening on 3000: $pidValue"
      } elseif ($process) {
        Write-Host "Port 3000 is used by $($process.ProcessName) ($pidValue), not stopping it automatically."
      }
    }
  } else {
    Write-Host "No old Next dev process found on port 3000."
    $global:LASTEXITCODE = 0
  }
}

Run-Step "Clean .next" {
  Remove-Item -Recurse -Force ".next" -ErrorAction SilentlyContinue
  Write-Host ".next cleaned."
}

$databaseUrl = Read-EnvValue "DATABASE_URL"
Run-Step "Check DATABASE_URL" {
  if (-not $databaseUrl) {
    throw "DATABASE_URL was not found in .env."
  }
  Write-Host "DATABASE_URL=$databaseUrl"
}

Run-Step "Check PostgreSQL port 55432" {
  if (-not (Test-PostgresReady -Port 55432)) {
    Write-Host "127.0.0.1:55432 is not ready, trying to start local PostgreSQL fallback."
    $started = Start-PostgresFallback -Port 55432
    if (-not $started) {
      Write-Host "127.0.0.1:55432 is still unavailable."
      Write-Host "Fix Docker Desktop / WSL2, or start the local PostgreSQL fallback manually."
      throw "Database unavailable, stopping startup to avoid false login failures."
    }
  }

  $resolvedPsql = Resolve-PgTool "psql"
  Ensure-LocalDatabase -Port 55432 -DatabaseName "wecom_growth_hub_demo" -PsqlExe $resolvedPsql
  Write-Host "127.0.0.1:55432 is ready."
}

Run-Step "Prisma Generate" {
  npm.cmd run db:generate
}

Run-Step "Prisma DB Push" {
  npm.cmd run db:push
}

Run-Step "Prisma Seed" {
  npm.cmd run db:seed
}

Run-Step "TypeScript Check" {
  npm.cmd run typecheck
}

Run-Step "Lint" {
  npm.cmd run lint
}

Run-Step "Build" {
  npm.cmd run build
}

Run-Step "Clean .next after build" {
  Remove-Item -Recurse -Force ".next" -ErrorAction SilentlyContinue
  Write-Host "Build output cleaned to avoid cache mixing with Next dev."
}

Write-Host ""
Write-Host "This window will keep running Next dev. Do not close it. Open another PowerShell window to run scripts\check-local.ps1 or scripts\test-smoke.ps1."
Write-Step "Start Next dev in the foreground"
npm.cmd run dev
