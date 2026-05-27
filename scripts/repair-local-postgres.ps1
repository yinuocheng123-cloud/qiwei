# 文件说明：本脚本用于修复本地 PostgreSQL fallback 数据目录。
# 功能说明：仅处理 D:\ceshi\qiwei\.local\postgres-data，本地开发库会被备份后重新 initdb。
#
# 结构概览：
#   第一部分：路径、工具和安全检查
#   第二部分：停止本地服务并备份旧 PGDATA
#   第三部分：重新初始化本地 PostgreSQL 数据目录

param(
  [switch]$Force
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
Set-Location $repoRoot

function Resolve-PgTool {
  param([string]$Name)

  $command = Get-Command $Name -ErrorAction SilentlyContinue
  if ($command -and $command.Source) {
    return $command.Source
  }

  $fallback = "D:\tools\pgsql17\pgsql\bin\$Name.exe"
  if (Test-Path -LiteralPath $fallback) {
    return $fallback
  }

  return $null
}

function Assert-LocalDataDir {
  param([string]$DataDir)

  $resolvedRoot = [System.IO.Path]::GetFullPath($repoRoot)
  $resolvedDataDir = [System.IO.Path]::GetFullPath($DataDir)
  if (-not $resolvedDataDir.StartsWith($resolvedRoot)) {
    throw "Refusing to repair PGDATA outside this workspace: $resolvedDataDir"
  }
}

if (-not (Test-Path -LiteralPath "package.json")) {
  throw "Run from D:\ceshi\qiwei first, then rerun scripts\repair-local-postgres.ps1."
}

$dataDir = [System.IO.Path]::GetFullPath((Join-Path $repoRoot ".local\postgres-data"))
Assert-LocalDataDir -DataDir $dataDir

$initDbExe = Resolve-PgTool "initdb"
if (-not $initDbExe) {
  throw "initdb.exe was not found. Install PostgreSQL or add its bin directory to PATH."
}

if (-not $Force) {
  Write-Host "This repairs only the local development database:"
  Write-Host $dataDir
  Write-Host "The old directory will be moved to a timestamped backup under .local."
  Write-Host "Rerun with -Force to proceed."
  exit 0
}

Write-Host "Stopping local services before repairing PGDATA..."
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\stop-local.ps1 | Out-Host

if (Test-Path -LiteralPath $dataDir) {
  $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
  $backupDir = Join-Path (Split-Path -Parent $dataDir) "postgres-data.backup-$stamp"
  Move-Item -LiteralPath $dataDir -Destination $backupDir
  Write-Host "Backed up old PGDATA to: $backupDir"
}

New-Item -ItemType Directory -Path $dataDir -Force | Out-Null
Write-Host "Reinitializing local PGDATA: $dataDir"
& $initDbExe -D $dataDir -U postgres -A trust -E UTF8 | Out-Host
if ($LASTEXITCODE -ne 0) {
  throw "initdb failed for local PGDATA: $dataDir"
}

Write-Host "Local PostgreSQL data directory repaired."
Write-Host "Next step:"
Write-Host "powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\start-local.ps1"
