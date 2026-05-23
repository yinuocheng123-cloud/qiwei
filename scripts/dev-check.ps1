# File note: local development and smoke-test environment checker.
# Purpose: check Node, npm, DATABASE_URL, Docker/PostgreSQL, then run Prisma, seed, typecheck, lint, build, and V2.2 smoke tests.
#
# Sections:
#   1. Helpers
#   2. Project and runtime checks
#   3. Docker/PostgreSQL startup
#   4. Prisma, quality checks, and smoke tests

$ErrorActionPreference = "Stop"

function Run-Step {
  param(
    [string]$Title,
    [scriptblock]$Command
  )

  Write-Host ""
  Write-Host "===== $Title ====="
  $global:LASTEXITCODE = 0
  & $Command
  if ($null -ne $global:LASTEXITCODE -and $global:LASTEXITCODE -ne 0) {
    throw "$Title failed with exit code $global:LASTEXITCODE"
  }
}

function Read-EnvValue {
  param([string]$Name)

  if (-not (Test-Path ".env")) {
    return $null
  }

  $line = Get-Content ".env" | Where-Object { $_ -match "^$Name=" } | Select-Object -First 1
  if (-not $line) {
    return $null
  }

  return (($line -replace "^$Name=", "").Trim('"'))
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

function Start-LocalPostgresFallback {
  param(
    [int]$Port,
    [string]$DatabaseName
  )

  $postgresExe = "D:\tools\pgsql17\pgsql\bin\postgres.exe"
  $pgCtlExe = "D:\tools\pgsql17\pgsql\bin\pg_ctl.exe"
  $psqlExe = "D:\tools\pgsql17\pgsql\bin\psql.exe"
  $dataDir = "D:\ceshi\qiwei\custom\experiments\postgres-data"
  $logPath = "D:\ceshi\qiwei\custom\experiments\postgres-v222.log"

  if (-not (Test-Path $postgresExe) -or -not (Test-Path $pgCtlExe) -or -not (Test-Path $psqlExe)) {
    Write-Host "Local PostgreSQL tools were not found. Fallback is unavailable."
    return $false
  }

  if (-not (Test-Path (Join-Path $dataDir "PG_VERSION"))) {
    Write-Host "Local PostgreSQL data directory was not found: $dataDir"
    return $false
  }

  Write-Host "Trying local PostgreSQL fallback on 127.0.0.1:$Port."
  & $pgCtlExe -D $dataDir -l $logPath -o "-p $Port" start | Out-Host

  for ($i = 1; $i -le 30; $i++) {
    if (Test-TcpPort -HostName "127.0.0.1" -Port $Port) {
      $exists = & $psqlExe -h 127.0.0.1 -p $Port -U postgres -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '$DatabaseName';"
      if (($exists | Out-String).Trim() -ne "1") {
        & $psqlExe -h 127.0.0.1 -p $Port -U postgres -d postgres -c "CREATE DATABASE `"$DatabaseName`";"
        if ($LASTEXITCODE -ne 0) {
          throw "Failed to create local database $DatabaseName."
        }
      }
      return $true
    }
    Start-Sleep -Seconds 1
  }

  Write-Host "Local PostgreSQL fallback did not become reachable."
  return $false
}

Run-Step "Project Root" {
  if (-not (Test-Path "package.json")) {
    throw "Please run: Set-Location D:\ceshi\qiwei"
  }
  Get-Location
}

Run-Step "Node / npm" {
  node --version
  npm --version
}

$databaseUrl = Read-EnvValue "DATABASE_URL"
Run-Step "DATABASE_URL" {
  if (-not $databaseUrl) {
    throw "DATABASE_URL was not found in .env."
  }
  Write-Host "DATABASE_URL=$databaseUrl"
}

$dockerAvailable = $false
Run-Step "Docker Check" {
  $dockerCommand = Get-Command docker -ErrorAction SilentlyContinue
  if (-not $dockerCommand) {
    Write-Host "Docker CLI is unavailable. Install Docker Desktop or start local PostgreSQL manually."
    return
  }

  docker --version
  docker compose version
  $script:dockerAvailable = $true
}

if ($dockerAvailable) {
  Write-Host ""
  Write-Host "===== Docker Compose Up ====="
  docker compose up -d
  if ($LASTEXITCODE -ne 0) {
    Write-Host "docker compose up -d failed. The script will try local PostgreSQL fallback if needed."
  }
} else {
  Write-Host ""
  Write-Host "Skipping docker compose up -d."
}

$dbReachable = Test-TcpPort -HostName "127.0.0.1" -Port 55432
if (-not $dbReachable) {
  $dbReachable = Start-LocalPostgresFallback -Port 55432 -DatabaseName "wecom_growth_hub_demo"
}

if (-not $dbReachable) {
  Write-Host ""
  Write-Host "PostgreSQL is not reachable at 127.0.0.1:55432."
  Write-Host "Fix Docker Desktop / WSL2, or start local PostgreSQL manually."
  Write-Host "Skipping Prisma and E2E so this is not misreported as a code failure."
  exit 1
}

Run-Step "Prisma Generate" {
  npm run db:generate
}

Run-Step "Prisma DB Push" {
  npm run db:push
}

Run-Step "Prisma Seed" {
  npm run db:seed
}

Run-Step "TypeScript Check" {
  npm run typecheck
}

Run-Step "Lint" {
  npm run lint
}

Run-Step "Build" {
  npm run build
}

Run-Step "V2.2 Smoke" {
  npm run test:e2e:v22
}

Run-Step "V2.2.1 Smoke" {
  npm run test:e2e:v221
}

Run-Step "Final Git Status" {
  git status --short --branch
}
