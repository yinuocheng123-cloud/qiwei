# File: manual PostgreSQL fallback runner.
# Purpose: run postgres.exe with explicit PGDATA and port for local debugging.
#
# Layout:
#   Part 1: parameters and default paths
#   Part 2: tool and PGDATA checks
#   Part 3: foreground postgres.exe runner

param(
  [string]$DataDir,

  [int]$Port = 55432,

  [string]$PostgresExe
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Resolve-DefaultPostgresExe {
  $command = Get-Command "postgres" -ErrorAction SilentlyContinue
  if ($command -and $command.Source) {
    return $command.Source
  }

  $fallback = "D:\tools\pgsql17\pgsql\bin\postgres.exe"
  if (Test-Path -LiteralPath $fallback) {
    return $fallback
  }

  return $null
}

$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
if (-not $DataDir) {
  $DataDir = Join-Path $repoRoot ".local\postgres-data"
}
$DataDir = [System.IO.Path]::GetFullPath($DataDir)

if (-not $PostgresExe) {
  $PostgresExe = Resolve-DefaultPostgresExe
}

if (-not $PostgresExe -or -not (Test-Path -LiteralPath $PostgresExe)) {
  throw "postgres.exe was not found. Install PostgreSQL or add its bin directory to PATH."
}

if (-not (Test-Path -LiteralPath (Join-Path $DataDir "PG_VERSION"))) {
  throw "PGDATA is not initialized: $DataDir. Run scripts\start-local.ps1 first so it can run initdb."
}

Write-Host "Starting PostgreSQL fallback in the foreground."
Write-Host "Closing this window will stop the database."
Write-Host "PGDATA: $DataDir"
Write-Host "Port: $Port"
Write-Host "postgres.exe: $PostgresExe"
Write-Host "listen_addresses: 127.0.0.1"

& $PostgresExe -D $DataDir -p $Port -c listen_addresses=127.0.0.1 -c log_destination=stderr
