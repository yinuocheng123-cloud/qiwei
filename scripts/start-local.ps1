# 文件说明：该脚本用于启动本地开发环境。
# 功能说明：清理旧 Next 进程与缓存，确认 PostgreSQL 可用，执行数据库同步、质量检查和构建，最后启动 Next dev。
#
# 结构概览：
#   第一部分：通用工具函数
#   第二部分：项目、环境变量与端口检查
#   第三部分：本机 PostgreSQL fallback 启动
#   第四部分：数据库与质量检查
#   第五部分：启动 Next dev

$ErrorActionPreference = "Stop"

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
    throw "$Title 失败，退出码：$global:LASTEXITCODE"
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

function Resolve-PgTool {
  param([string]$Name)

  $command = Get-Command $Name -ErrorAction SilentlyContinue
  if ($command -and $command.Source) {
    return $command.Source
  }

  $fallback = "D:\tools\pgsql17\pgsql\bin\$Name.exe"
  if (Test-Path -LiteralPath $fallback) {
    Write-Host "$Name.exe 不在 PATH 中，已回退到固定路径：$fallback"
    return $fallback
  }

  return $null
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

function Resolve-LocalPostgresDataDir {
  $candidates = @(
    (Join-Path $PSScriptRoot "..\.local\postgres-data"),
    (Join-Path $PSScriptRoot "..\tmp\postgres-data"),
    (Join-Path $PSScriptRoot "..\custom\experiments\postgres-data")
  )

  foreach ($candidate in $candidates) {
    $resolved = [System.IO.Path]::GetFullPath($candidate)
    if (Test-Path -LiteralPath (Join-Path $resolved "PG_VERSION")) {
      return $resolved
    }
  }

  return [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\.local\postgres-data"))
}

function Initialize-PostgresDataDir {
  param(
    [string]$DataDir,
    [string]$InitDbExe
  )

  if (-not $InitDbExe) {
    Write-Host "未找到 initdb.exe。请安装 PostgreSQL，或把 PostgreSQL bin 目录加入 PATH。"
    return $false
  }

  $parentDir = Split-Path -Parent $DataDir
  if (-not (Test-Path -LiteralPath $parentDir)) {
    New-Item -ItemType Directory -Path $parentDir -Force | Out-Null
  }

  if (Test-Path -LiteralPath $DataDir) {
    $existingItems = Get-ChildItem -LiteralPath $DataDir -Force -ErrorAction SilentlyContinue
    if ($existingItems -and -not (Test-Path -LiteralPath (Join-Path $DataDir "PG_VERSION"))) {
      throw "数据目录 $DataDir 已存在但未初始化，请清空后重试，或删除后让脚本自动 initdb。"
    }
  } else {
    New-Item -ItemType Directory -Path $DataDir -Force | Out-Null
  }

  if (Test-Path -LiteralPath (Join-Path $DataDir "PG_VERSION")) {
    Write-Host "已发现初始化完成的数据目录：$DataDir"
    return $true
  }

  Write-Host "未发现初始化完成的数据目录，正在执行 initdb：$DataDir"
  & $InitDbExe -D $DataDir -U postgres -A trust -E UTF8 | Out-Host
  if ($LASTEXITCODE -ne 0) {
    throw "initdb 初始化数据目录失败：$DataDir"
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
    Write-Host "已清理残留 postmaster.pid。"
  }
}

function Ensure-LocalDatabase {
  param(
    [int]$Port,
    [string]$DatabaseName,
    [string]$PsqlExe
  )

  if (-not (Test-Path $psqlExe)) {
    Write-Host "未找到 psql.exe，跳过数据库存在性检查。"
    return
  }

  if (-not (Wait-ForPostgresReady -Port $Port -Seconds 60)) {
    throw "PostgreSQL 端口已打开，但还没有进入 accepting connections 状态。"
  }

  $exists = & $psqlExe -h 127.0.0.1 -p $Port -U postgres -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '$DatabaseName';"
  if (($exists | Out-String).Trim() -eq "1") {
    Write-Host "数据库 $DatabaseName 已存在。"
    return
  }

  Write-Host "数据库 $DatabaseName 不存在，正在创建。"
  & $psqlExe -h 127.0.0.1 -p $Port -U postgres -d postgres -c "CREATE DATABASE `"$DatabaseName`";"
  if ($LASTEXITCODE -ne 0) {
    throw "创建数据库 $DatabaseName 失败。"
  }
}

function Start-PostgresFallback {
  param([int]$Port)

  $postgresExe = Resolve-PgTool "postgres"
  $pgCtlExe = Resolve-PgTool "pg_ctl"
  $initDbExe = Resolve-PgTool "initdb"
  $psqlExe = Resolve-PgTool "psql"
  $dataDir = Resolve-LocalPostgresDataDir
  $logPath = Join-Path $dataDir "postgres-start-local.log"

  if (-not $postgresExe -or -not $pgCtlExe -or -not $initDbExe) {
    Write-Host "未找到 PostgreSQL 工具链（pg_ctl / initdb / postgres）。"
    Write-Host "请安装 PostgreSQL，或把 PostgreSQL bin 目录加入 PATH。"
    return $false
  }

  if (-not (Initialize-PostgresDataDir -DataDir $dataDir -InitDbExe $initDbExe)) {
    return $false
  }

  Clear-StalePostgresPid -DataDir $dataDir -Port $Port

  Write-Host "使用本地 PGDATA：$dataDir"
  Write-Host "启动命令：pg_ctl -D `"$dataDir`" -o `"-p $Port`" -l `"$logPath`" start"
  & $pgCtlExe -D $dataDir -o "-p $Port" -l $logPath start -w | Out-Host

  if (-not (Wait-ForPortListening -Port $Port -Seconds 30)) {
    Write-Host "pg_ctl 启动后 30 秒内仍未看到 55432 LISTENING。"
    if (Test-Path -LiteralPath $logPath) {
      Write-Host "最近日志："
      Get-Content -LiteralPath $logPath -Tail 20 -ErrorAction SilentlyContinue | Out-Host
    }
    Write-Host "尝试改用 postgres.exe 直接启动作为兜底。"
    $fallbackScript = Join-Path $PSScriptRoot "run-postgres-fallback.ps1"
    if (-not (Test-Path -LiteralPath $fallbackScript)) {
      Write-Host "未找到兜底脚本：$fallbackScript"
      return $false
    }

    $fallbackArgs = @(
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      $fallbackScript,
      "-DataDir",
      $dataDir,
      "-Port",
      "$Port",
      "-PostgresExe",
      $postgresExe
    )

    $process = Start-Process -FilePath powershell.exe -ArgumentList $fallbackArgs -WorkingDirectory ([System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))) -PassThru
    Write-Host "postgres.exe 兜底进程已启动，进程 ID：$($process.Id)"

    if (-not (Wait-ForPortListening -Port $Port -Seconds 45)) {
      Write-Host "postgres.exe 兜底启动后 45 秒内仍未看到 55432 LISTENING。"
      return $false
    }

    if (-not (Wait-ForPostgresReady -Port $Port -Seconds 45)) {
      Write-Host "55432 已监听，但 pg_isready 仍未返回 accepting connections。"
      return $false
    }

    return $true
  }

  if (-not (Wait-ForPostgresReady -Port $Port -Seconds 30)) {
    Write-Host "55432 已监听，但 pg_isready 仍未返回 accepting connections。"
    return $false
  }

  return $true
}

Run-Step "检查项目根目录" {
  if (-not (Test-Path "package.json")) {
    throw "请先执行：Set-Location D:\ceshi\qiwei，然后再运行 scripts\start-local.ps1。"
  }
  Get-Location
}

Run-Step "停止旧 node / Next dev 进程" {
  $nodeProcesses = Get-Process node -ErrorAction SilentlyContinue
  if ($nodeProcesses) {
    $nodeProcesses | Stop-Process -Force
    Write-Host "已停止 node 进程数量：$($nodeProcesses.Count)"
  } else {
    Write-Host "未发现旧 node 进程。"
  }
}

Run-Step "清理 .next" {
  Remove-Item -Recurse -Force ".next" -ErrorAction SilentlyContinue
  Write-Host "已清理 .next。"
}

$databaseUrl = Read-EnvValue "DATABASE_URL"
Run-Step "检查 DATABASE_URL" {
  if (-not $databaseUrl) {
    throw "未在 .env 中找到 DATABASE_URL。"
  }
  Write-Host "DATABASE_URL=$databaseUrl"
}

Run-Step "检查 55432 数据库端口" {
  if (-not (Test-PostgresReady -Port 55432)) {
    Write-Host "127.0.0.1:55432 当前不可用，尝试启动本机 PostgreSQL fallback。"
    $started = Start-PostgresFallback -Port 55432
    if (-not $started) {
      Write-Host "127.0.0.1:55432 仍不可用。"
      Write-Host "请先修复 Docker Desktop / WSL2，或手动启动本机 PostgreSQL fallback。"
      throw "数据库不可用，停止启动流程，避免后续登录测试误报。"
    }
  }

  $resolvedPsql = Resolve-PgTool "psql"
  Ensure-LocalDatabase -Port 55432 -DatabaseName "wecom_growth_hub_demo" -PsqlExe $resolvedPsql
  Write-Host "127.0.0.1:55432 已可用。"
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

Run-Step "build 后再次清理 .next" {
  Remove-Item -Recurse -Force ".next" -ErrorAction SilentlyContinue
  Write-Host "已清理 build 产物，避免 Next dev 与生产构建缓存混用。"
}

Write-Step "启动 Next dev"
Write-Host "Next dev 将持续运行。另开一个 PowerShell 执行 scripts\test-smoke.ps1。"
npm.cmd run dev
