<#
文件说明：该脚本用于把本地开发环境调整成可直接分享链接的测试入口。
功能说明：检查本地 .env 与数据库配置，启动可局域网访问的 Next dev server，并在已安装 cloudflared 时补充公网测试链接。

结构概览：
  第一部分：参数与基础路径
  第二部分：通用输出与检查函数
  第三部分：本地环境检查
  第四部分：启动局域网可访问的 dev server
  第五部分：可选启动 cloudflared 公网链接
#>

param(
  [switch]$DryRun,
  [switch]$SkipTunnel
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ========== 第一部分：参数与基础路径 ==========

$ProjectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$EnvPath = Join-Path $ProjectRoot ".env"
$StdoutLogPath = Join-Path $PSScriptRoot "dev-stdout.log"
$StderrLogPath = Join-Path $PSScriptRoot "dev-stderr.log"
$TunnelLogPath = Join-Path $PSScriptRoot "cloudflared.log"
$Port = 3000

# ========== 第二部分：通用输出与检查函数 ==========

function Write-Step {
  param([string]$Message)

  Write-Host ""
  Write-Host "== $Message ==" -ForegroundColor Cyan
}

function Fail {
  param([string]$Message)

  throw $Message
}

function Get-ShareableIpv4Addresses {
  $addresses = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue
  $result = @()

  foreach ($item in $addresses) {
    $ip = $item.IPAddress
    if (-not $ip) {
      continue
    }

    if ($ip -eq "127.0.0.1") {
      continue
    }

    if ($ip.StartsWith("169.254.")) {
      continue
    }

    if ($result -notcontains $ip) {
      $result += $ip
    }
  }

  return $result
}

function Wait-ForPort {
  param(
    [int]$TargetPort,
    [int]$TimeoutSeconds
  )

  for ($index = 0; $index -lt $TimeoutSeconds; $index++) {
    Start-Sleep -Seconds 1
    $listener = Get-NetTCPConnection -State Listen -LocalPort $TargetPort -ErrorAction SilentlyContinue
    if ($listener) {
      return $true
    }
  }

  return $false
}

function Wait-ForTunnelUrl {
  param(
    [string]$LogPath,
    [int]$TimeoutSeconds
  )

  $pattern = "https://[A-Za-z0-9.-]+\.trycloudflare\.com"

  for ($index = 0; $index -lt $TimeoutSeconds; $index++) {
    Start-Sleep -Seconds 1

    if (-not (Test-Path $LogPath)) {
      continue
    }

    $content = Get-Content -Path $LogPath -Raw -ErrorAction SilentlyContinue
    if (-not $content) {
      continue
    }

    $match = [regex]::Match($content, $pattern)
    if ($match.Success) {
      return $match.Value
    }
  }

  return $null
}

# ========== 第三部分：本地环境检查 ==========

Write-Step "检查本地运行前置条件"

if (-not (Test-Path $EnvPath)) {
  if ($DryRun) {
    Write-Host "未检测到 .env。DryRun 模式下先跳过硬校验；真正启动前仍需要复制 .env.example 为 .env，并配置 DATABASE_URL、SESSION_SECRET、APP_URL。" -ForegroundColor Yellow
  } else {
    Fail "未检测到 .env。请先复制 .env.example 为 .env，并配置 DATABASE_URL、SESSION_SECRET、APP_URL。"
  }
} else {
  $envContent = Get-Content -Path $EnvPath -Raw

  if ($envContent -match 'DATABASE_URL\s*=\s*""') {
    if ($DryRun) {
      Write-Host ".env 中的 DATABASE_URL 仍为空。DryRun 模式下仅提示；真正启动前必须指向可连接的 PostgreSQL 数据库。" -ForegroundColor Yellow
    } else {
      Fail ".env 中的 DATABASE_URL 仍为空。请先指向可连接的 PostgreSQL 数据库。"
    }
  }

  if ($envContent -match 'SESSION_SECRET\s*=\s*""') {
    if ($DryRun) {
      Write-Host ".env 中的 SESSION_SECRET 仍为空。DryRun 模式下仅提示；真正启动前必须补一个本地 secret。" -ForegroundColor Yellow
    } else {
      Fail ".env 中的 SESSION_SECRET 仍为空。请先补一个本地 secret。"
    }
  }
}

$portInUse = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue
if ($portInUse) {
  $owners = @($portInUse | Select-Object -ExpandProperty OwningProcess -Unique)
  Fail "端口 $Port 已被占用，当前进程 ID：$($owners -join ', ')。请先清理旧 dev server，再重新执行。"
}

$shareableIps = @(Get-ShareableIpv4Addresses)
if (-not $shareableIps.Count) {
  Write-Host "未检测到可分享的局域网 IPv4 地址，后续仍会保留 127.0.0.1 本地访问地址。" -ForegroundColor Yellow
}

Write-Host "本地登录页：" -ForegroundColor Green
Write-Host "  http://127.0.0.1:${Port}/login"
foreach ($ip in $shareableIps) {
  Write-Host "局域网测试链接：" -ForegroundColor Green
  Write-Host "  http://${ip}:$Port/login"
}

if ($DryRun) {
  Write-Step "DryRun 模式结束"
  Write-Host "未真正启动 dev server，也未启动 cloudflared。"
  exit 0
}

# ========== 第四部分：启动局域网可访问的 dev server ==========

Write-Step "启动可分享的 Next dev server"

if (Test-Path $StdoutLogPath) {
  Remove-Item -LiteralPath $StdoutLogPath -Force
}

if (Test-Path $StderrLogPath) {
  Remove-Item -LiteralPath $StderrLogPath -Force
}

$devProcessOptions = @{
  FilePath = "npm.cmd"
  ArgumentList = @("run", "dev:lan")
  WorkingDirectory = $ProjectRoot
  RedirectStandardOutput = $StdoutLogPath
  RedirectStandardError = $StderrLogPath
  PassThru = $true
}

$devProcess = Start-Process @devProcessOptions

if (-not (Wait-ForPort -TargetPort $Port -TimeoutSeconds 60)) {
  Fail "dev server 在 60 秒内没有成功监听 3000 端口。请检查 custom/experiments/dev-stdout.log 和 dev-stderr.log。"
}

Write-Host "dev server 已启动，进程 ID：$($devProcess.Id)" -ForegroundColor Green
Write-Host "本地可用链接：" -ForegroundColor Green
Write-Host "  http://127.0.0.1:${Port}/login"
foreach ($ip in $shareableIps) {
  Write-Host "可直接发给同局域网测试同事的链接：" -ForegroundColor Green
  Write-Host "  http://${ip}:$Port/login"
}

# ========== 第五部分：可选启动 cloudflared 公网链接 ==========

if ($SkipTunnel) {
  Write-Step "已按参数跳过公网 tunnel"
  Write-Host "当前只保留本地和局域网访问方式。"
  exit 0
}

$cloudflaredCommand = Get-Command "cloudflared.exe" -ErrorAction SilentlyContinue
if (-not $cloudflaredCommand) {
  Write-Step "未检测到 cloudflared"
  Write-Host "当前已经可以把局域网链接发给同一网络下的测试人员。" -ForegroundColor Yellow
  Write-Host "如果你还需要公网可访问链接，请先安装 cloudflared，然后重新执行 npm run demo:link。" -ForegroundColor Yellow
  exit 0
}

Write-Step "启动 cloudflared 公网测试链接"

if (Test-Path $TunnelLogPath) {
  Remove-Item -LiteralPath $TunnelLogPath -Force
}

$tunnelProcessOptions = @{
  FilePath = $cloudflaredCommand.Source
  ArgumentList = @("tunnel", "--url", "http://127.0.0.1:$Port", "--no-autoupdate")
  WorkingDirectory = $ProjectRoot
  RedirectStandardOutput = $TunnelLogPath
  RedirectStandardError = $TunnelLogPath
  PassThru = $true
}

$tunnelProcess = Start-Process @tunnelProcessOptions

$publicUrl = Wait-ForTunnelUrl -LogPath $TunnelLogPath -TimeoutSeconds 30
if ($publicUrl) {
  Write-Host "公网测试链接：" -ForegroundColor Green
  Write-Host "  ${publicUrl}/login"
  Write-Host "cloudflared 进程 ID：$($tunnelProcess.Id)" -ForegroundColor Green
} else {
  Write-Host "cloudflared 已启动，但 30 秒内未解析出 trycloudflare 链接。" -ForegroundColor Yellow
  Write-Host "请查看日志：$TunnelLogPath" -ForegroundColor Yellow
  Write-Host "cloudflared 进程 ID：$($tunnelProcess.Id)" -ForegroundColor Yellow
}

