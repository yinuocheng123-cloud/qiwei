# 文件说明：该脚本用于在已有本地 dev server 上运行 smoke 测试。
# 功能说明：检查 3000 端口，设置 Playwright 跳过自启动 webServer，然后依次执行四组 smoke 测试并输出 git status。
#
# 结构概览：
#   第一部分：通用工具函数
#   第二部分：项目与 dev server 检查
#   第三部分：执行 smoke 测试
#   第四部分：输出 git 状态

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

Run-Step "检查项目根目录" {
  if (-not (Test-Path "package.json")) {
    throw "请先执行：Set-Location D:\ceshi\qiwei，然后再运行 scripts\test-smoke.ps1。"
  }
  Get-Location
}

Run-Step "检查 dev server" {
  if (-not (Test-TcpPort -HostName "127.0.0.1" -Port 3000)) {
    Write-Host "未检测到 127.0.0.1:3000。"
    Write-Host "请先在另一个 PowerShell 窗口运行：powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\start-local.ps1"
    throw "dev server 未启动。"
  }
  Write-Host "127.0.0.1:3000 已可用。"

  Write-Host "等待 /login 页面真正可用..."
  $ready = $false
  for ($i = 1; $i -le 120; $i++) {
    if (Test-LoginPageReady) {
      $ready = $true
      break
    }
    Start-Sleep -Seconds 2
  }

  if (-not $ready) {
    throw "127.0.0.1:3000 已监听，但 /login 页面仍未准备好。请先重新运行 scripts\start-local.ps1。"
  }

  Write-Host "/login 页面已就绪。"
}

$env:PLAYWRIGHT_SKIP_WEBSERVER = "1"
$env:APP_URL = "http://127.0.0.1:3000"

$smokeSpecs = @(
  "tests/v22-pilot-workbench-smoke-e2e.spec.ts",
  "tests/v221-hide-ai-complexity-smoke-e2e.spec.ts",
  "tests/v224-stability-smoke-e2e.spec.ts",
  "tests/v227-materials-checklist-smoke-e2e.spec.ts"
)

foreach ($spec in $smokeSpecs) {
  Run-Step "Smoke：$spec" {
    npx.cmd playwright test $spec --workers=1 --reporter=list
  }
}

Run-Step "当前 git status" {
  git status --short --branch
}

Write-Host ""
Write-Host "四组 smoke 测试执行完成。"
