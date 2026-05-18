<#
文件说明：该脚本用于一键启动《企业微信业务增长中台》的本地演示环境。
功能说明：自动检查项目目录、本地 PostgreSQL、数据目录和端口状态，准备 Prisma 所需环境，执行迁移与 seed，并最终启动 Next.js dev server。

结构概览：
  第一部分：参数与基础路径
  第二部分：通用输出与检查函数
  第三部分：PostgreSQL 初始化与启动
  第四部分：Prisma 与种子数据准备
  第五部分：输出演示信息并启动前端
#>

param(
  [string]$ProjectRoot = "D:\ceshi\qiwei",
  [string]$PostgresExe = "D:\tools\pgsql17\pgsql\bin\postgres.exe",
  [string]$InitDbExe = "D:\tools\pgsql17\pgsql\bin\initdb.exe",
  [string]$DataDir = "D:\ceshi\qiwei\custom\experiments\postgres-data",
  [int]$Port = 55432,
  [string]$DatabaseName = "wecom_growth_hub_v11"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ========== 第一部分：参数与基础路径 ==========

$DatabaseUrl = "postgresql://postgres@127.0.0.1:{0}/{1}?schema=public" -f $Port, $DatabaseName
$PostgresBinDir = Split-Path -Parent $PostgresExe
$PgIsReadyExe = Join-Path $PostgresBinDir "pg_isready.exe"
$PsqlExe = Join-Path $PostgresBinDir "psql.exe"
$PostgresStdoutLog = Join-Path $ProjectRoot "custom\experiments\dev-postgres-stdout.log"
$PostgresStderrLog = Join-Path $ProjectRoot "custom\experiments\dev-postgres-stderr.log"
$PostmasterPidPath = Join-Path $DataDir "postmaster.pid"

# ========== 第二部分：通用输出与检查函数 ==========

function Write-Step {
  param([string]$Message)

  Write-Host ""
  Write-Host "== $Message ==" -ForegroundColor Cyan
}

function Write-Info {
  param([string]$Message)

  Write-Host $Message -ForegroundColor Gray
}

function Fail {
  param([string]$Message)

  throw $Message
}

function Invoke-Checked {
  param(
    [Parameter(Mandatory = $true)]
    [scriptblock]$Command,
    [Parameter(Mandatory = $true)]
    [string]$Description
  )

  Write-Info "执行：$Description"
  & $Command
  if ($LASTEXITCODE -ne 0) {
    Fail "$Description 执行失败，退出码：$LASTEXITCODE"
  }
}

function Get-PortOwnerProcessInfo {
  param([int]$TargetPort)

  $listeners = Get-NetTCPConnection -State Listen -LocalPort $TargetPort -ErrorAction SilentlyContinue
  if (-not $listeners) {
    return $null
  }

  $owningProcessId = ($listeners | Select-Object -ExpandProperty OwningProcess -First 1)
  $process = Get-Process -Id $owningProcessId -ErrorAction SilentlyContinue
  $cimProcess = Get-CimInstance Win32_Process -Filter "ProcessId = $owningProcessId" -ErrorAction SilentlyContinue

  [pscustomobject]@{
    Port = $TargetPort
    ProcessId = $owningProcessId
    ProcessName = if ($process) { $process.ProcessName } else { $null }
    ExecutablePath = if ($cimProcess) { $cimProcess.ExecutablePath } else { $null }
    CommandLine = if ($cimProcess) { $cimProcess.CommandLine } else { $null }
  }
}

function Test-IsPostgresDataDirectory {
  param([string]$TargetDir)

  if (-not (Test-Path -LiteralPath $TargetDir)) {
    return $false
  }

  $requiredFiles = @(
    "PG_VERSION",
    "postgresql.conf",
    "pg_hba.conf"
  )

  foreach ($fileName in $requiredFiles) {
    if (-not (Test-Path -LiteralPath (Join-Path $TargetDir $fileName))) {
      return $false
    }
  }

  return $true
}

function Wait-ForPostgres {
  param(
    [int]$TargetPort,
    [int]$TimeoutSeconds
  )

  for ($index = 0; $index -lt $TimeoutSeconds; $index++) {
    if (Test-Path -LiteralPath $PgIsReadyExe) {
      & $PgIsReadyExe -h 127.0.0.1 -p $TargetPort -U postgres | Out-Null
      if ($LASTEXITCODE -eq 0) {
        return $true
      }
    } else {
      $listener = Get-NetTCPConnection -State Listen -LocalPort $TargetPort -ErrorAction SilentlyContinue
      if ($listener) {
        return $true
      }
    }

    Start-Sleep -Seconds 1
  }

  return $false
}

function Initialize-PostgresDataDirectory {
  Write-Step "初始化 PostgreSQL 数据目录"

  if (-not (Test-Path -LiteralPath $InitDbExe)) {
    Fail "未找到 initdb.exe，无法初始化 PostgreSQL 数据目录。"
  }

  $parentDir = Split-Path -Parent $DataDir
  if (-not (Test-Path -LiteralPath $parentDir)) {
    New-Item -ItemType Directory -Path $parentDir | Out-Null
  }

  if (-not (Test-Path -LiteralPath $DataDir)) {
    New-Item -ItemType Directory -Path $DataDir | Out-Null
  }

  Invoke-Checked -Description "initdb 初始化数据目录" -Command {
    & $InitDbExe -D $DataDir -U postgres -A trust -E UTF8
  }
}

function Ensure-DatabaseExists {
  Write-Step "检查数据库是否存在"

  if (-not (Test-Path -LiteralPath $PsqlExe)) {
    Fail "未找到 psql.exe，无法自动创建数据库。请检查 PostgreSQL 安装目录是否完整。"
  }

  $existsResult = & $PsqlExe -h 127.0.0.1 -p $Port -U postgres -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '$DatabaseName';"
  if ($LASTEXITCODE -ne 0) {
    Fail "检查数据库 $DatabaseName 是否存在时失败。"
  }

  if (($existsResult | Out-String).Trim() -eq "1") {
    Write-Info "数据库 $DatabaseName 已存在，继续后续步骤。"
    return
  }

  Invoke-Checked -Description "创建数据库 $DatabaseName" -Command {
    & $PsqlExe -h 127.0.0.1 -p $Port -U postgres -d postgres -c "CREATE DATABASE `"$DatabaseName`";"
  }
}

function Start-PostgresIfNeeded {
  Write-Step "检查 PostgreSQL 端口状态"

  $portOwner = Get-PortOwnerProcessInfo -TargetPort $Port
  if ($portOwner) {
    if ($portOwner.ProcessName -and $portOwner.ProcessName -like "postgres*") {
      Write-Info "端口 $Port 已有 PostgreSQL 监听，进程 ID：$($portOwner.ProcessId)。"
      return
    }

    $details = @(
      "端口 $Port 已被其他进程占用。",
      "进程 ID：$($portOwner.ProcessId)",
      "进程名：$($portOwner.ProcessName)",
      "可执行文件：$($portOwner.ExecutablePath)",
      "请先停止占用端口的进程，或改用其它端口后重试。"
    ) -join [Environment]::NewLine

    Fail $details
  }

  if (Test-Path -LiteralPath $PostmasterPidPath) {
    # 只有在端口未监听时才移除残留 pid，避免旧异常退出阻塞本地重新启动。
    Remove-Item -LiteralPath $PostmasterPidPath -Force
  }

  if (Test-Path -LiteralPath $PostgresStdoutLog) {
    Remove-Item -LiteralPath $PostgresStdoutLog -Force
  }

  if (Test-Path -LiteralPath $PostgresStderrLog) {
    Remove-Item -LiteralPath $PostgresStderrLog -Force
  }

  Write-Step "启动 PostgreSQL 后台进程"
  $commandHost = if ($env:ComSpec) { $env:ComSpec } else { "cmd.exe" }
  $commandArguments = "/c `"`"$PostgresExe`" -D `"$DataDir`" -p $Port 1>> `"$PostgresStdoutLog`" 2>> `"$PostgresStderrLog`"`""

  $startInfo = New-Object System.Diagnostics.ProcessStartInfo
  $startInfo.FileName = $commandHost
  $startInfo.Arguments = $commandArguments
  $startInfo.WorkingDirectory = $ProjectRoot
  $startInfo.UseShellExecute = $false
  $startInfo.CreateNoWindow = $true

  $process = [System.Diagnostics.Process]::Start($startInfo)

  Write-Info "PostgreSQL 已尝试启动，进程 ID：$($process.Id)"

  if (-not (Wait-ForPostgres -TargetPort $Port -TimeoutSeconds 30)) {
    $stderrTail = if (Test-Path -LiteralPath $PostgresStderrLog) {
      (Get-Content -Path $PostgresStderrLog -Tail 20 -ErrorAction SilentlyContinue) -join [Environment]::NewLine
    } else {
      ""
    }

    $message = "PostgreSQL 启动后 30 秒内仍未监听 127.0.0.1:$Port。"
    if ($stderrTail) {
      $message += [Environment]::NewLine + "最近 stderr 输出：" + [Environment]::NewLine + $stderrTail
    }

    Fail $message
  }
}

# ========== 第三部分：PostgreSQL 初始化与启动 ==========

Write-Step "检查项目目录"

if (-not (Test-Path -LiteralPath $ProjectRoot)) {
  Fail "未找到项目目录：$ProjectRoot"
}

if (-not (Test-Path -LiteralPath (Join-Path $ProjectRoot "package.json"))) {
  Fail "项目目录缺少 package.json，请确认脚本正在企业微信业务增长中台仓库中执行。"
}

Set-Location -LiteralPath $ProjectRoot
Write-Info "当前项目路径：$ProjectRoot"
Write-Info "演示数据库端口：$Port"
Write-Info "本地 PostgreSQL 数据目录：$DataDir"

Write-Step "检查 PostgreSQL 可执行文件"

if (-not (Test-Path -LiteralPath $PostgresExe)) {
  Fail "未找到本地 PostgreSQL，请检查 D:\tools\pgsql17\pgsql\bin\postgres.exe 是否存在。"
}

if (-not (Test-IsPostgresDataDirectory -TargetDir $DataDir)) {
  Initialize-PostgresDataDirectory
} else {
  Write-Step "检测到已初始化的数据目录"
  Write-Info "数据目录：$DataDir"
}

Start-PostgresIfNeeded
Ensure-DatabaseExists

# ========== 第四部分：Prisma 与种子数据准备 ==========

Write-Step "设置当前进程环境变量"

$env:DATABASE_URL = $DatabaseUrl
if (-not $env:SESSION_SECRET) {
  $env:SESSION_SECRET = "local-demo-session-secret"
}
if (-not $env:APP_URL) {
  $env:APP_URL = "http://127.0.0.1:3000"
}

Write-Info "DATABASE_URL：$DatabaseUrl"

Invoke-Checked -Description "npm run prisma:generate" -Command {
  & npm.cmd run prisma:generate
}

Invoke-Checked -Description "npx prisma migrate deploy" -Command {
  & npx.cmd prisma migrate deploy
}

try {
  Invoke-Checked -Description "npm run prisma:seed" -Command {
    & npm.cmd run prisma:seed
  }
} catch {
  Write-Host "npm run prisma:seed 执行失败，尝试改用 npx prisma db seed。" -ForegroundColor Yellow
  Invoke-Checked -Description "npx prisma db seed" -Command {
    & npx.cmd prisma db seed
  }
}

# ========== 第五部分：输出演示信息并启动前端 ==========

Write-Step "本地演示入口"
Write-Host "登录地址：http://127.0.0.1:3000/login" -ForegroundColor Green
Write-Host "测试账号：" -ForegroundColor Green
Write-Host "platform-boss@zhengmu.local / 123456" -ForegroundColor Green
Write-Host "platform-operator@zhengmu.local / 123456" -ForegroundColor Green
Write-Host "platform-sales@zhengmu.local / 123456" -ForegroundColor Green
Write-Host "当前脚本不依赖 Docker，会继续以前台方式启动 Next.js dev server。" -ForegroundColor Green
Write-Host "常见失败排查：" -ForegroundColor Yellow
Write-Host "1. 如果端口 $Port 不可用，请先释放占用进程。" -ForegroundColor Yellow
Write-Host "2. 如果 seed 失败，请优先查看当前控制台输出。" -ForegroundColor Yellow
Write-Host "3. 如果 PostgreSQL 启动失败，可查看：" -ForegroundColor Yellow
Write-Host "   $PostgresStdoutLog" -ForegroundColor Yellow
Write-Host "   $PostgresStderrLog" -ForegroundColor Yellow

Write-Step "启动 Next.js dev server"
& npm.cmd run dev
if ($LASTEXITCODE -ne 0) {
  Fail "npm run dev 启动失败，退出码：$LASTEXITCODE"
}
