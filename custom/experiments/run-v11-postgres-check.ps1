# 文件说明：该脚本用于 V1.1 本地 PostgreSQL 验证。
# 功能说明：临时启动仓库内实验数据库目录，执行 Prisma 迁移、seed 和端到端验证脚本。
#
# 结构概览：
#   第一部分：路径与环境变量
#   第二部分：启动 PostgreSQL
#   第三部分：执行迁移、seed 和验证
#   第四部分：清理临时后台任务

$ErrorActionPreference = "Stop"

function Invoke-Checked {
  param(
    [Parameter(Mandatory = $true)]
    [scriptblock] $Command
  )

  & $Command
  if ($LASTEXITCODE -ne 0) {
    throw "Command failed with exit code $LASTEXITCODE"
  }
}

$RepoRoot = Resolve-Path "$PSScriptRoot\..\.."
$DataDir = Join-Path $RepoRoot "custom\experiments\postgres-data"
$DatabaseUrl = "postgresql://postgres@127.0.0.1:55432/wecom_growth_hub_v11?schema=public"
$env:DATABASE_URL = $DatabaseUrl
$env:SESSION_SECRET = "local-v11-session-secret-for-verification"
$env:APP_URL = "http://localhost:3000"

if (!(Test-Path $DataDir)) {
  Invoke-Checked { & initdb.exe -D $DataDir -U postgres -A trust }
}

$PidFile = Join-Path $DataDir "postmaster.pid"
if (Test-Path $PidFile) {
  Remove-Item -LiteralPath $PidFile
}

$PostgresJob = Start-Job -ScriptBlock {
  & postgres.exe -D $using:DataDir -p 55432
}

try {
  $Ready = $false
  for ($i = 0; $i -lt 40; $i++) {
    & pg_isready.exe -h 127.0.0.1 -p 55432 -U postgres | Out-Null
    if ($LASTEXITCODE -eq 0) {
      $Ready = $true
      break
    }
    Start-Sleep -Seconds 1
  }
  if (!$Ready) {
    throw "PostgreSQL did not become ready."
  }

  Invoke-Checked { & psql.exe -h 127.0.0.1 -p 55432 -U postgres -d postgres -c "DROP DATABASE IF EXISTS wecom_growth_hub_v11;" }
  Invoke-Checked { & psql.exe -h 127.0.0.1 -p 55432 -U postgres -d postgres -c "CREATE DATABASE wecom_growth_hub_v11;" }
  Invoke-Checked { & npx.cmd prisma migrate deploy }
  Invoke-Checked { & npm.cmd run prisma:seed }
  Invoke-Checked { & npx.cmd tsx custom/experiments/verify-v11-e2e.ts }
}
finally {
  Stop-Job $PostgresJob -ErrorAction SilentlyContinue
  Remove-Job $PostgresJob -Force -ErrorAction SilentlyContinue
}
