# File: smoke test runner for an existing local dev server.
# Purpose: check port 3000 and then run the four smoke test suites.

$ErrorActionPreference = "Stop"

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

Run-Step "Check project root" {
  if (-not (Test-Path -LiteralPath "package.json")) {
    throw "Run from D:\ceshi\qiwei first, then rerun scripts\test-smoke.ps1."
  }
  Write-Host "Current directory: $(Get-Location)"
}

Run-Step "Check dev server" {
  if (-not (Test-TcpPort -HostName "127.0.0.1" -Port 3000)) {
    Write-Host "127.0.0.1:3000 was not detected."
    Write-Host "First run: powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\start-local.ps1"
    throw "dev server is not running."
  }
  Write-Host "127.0.0.1:3000 is available."

  Write-Host "Waiting for /login to become ready..."
  $ready = $false
  for ($i = 1; $i -le 120; $i++) {
    if (Test-LoginPageReady) {
      $ready = $true
      break
    }
    Start-Sleep -Seconds 2
  }

  if (-not $ready) {
    throw "127.0.0.1:3000 is listening, but /login is still not ready. Keep the start-local.ps1 window open, or rerun scripts\start-local.ps1."
  }

  Write-Host "/login is ready."
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
  Run-Step "Smoke: $spec" {
    npx.cmd playwright test $spec --workers=1 --reporter=list
  }
}

Run-Step "Current git status" {
  git status --short --branch
}

Write-Host ""
Write-Host "Four smoke suites completed."
