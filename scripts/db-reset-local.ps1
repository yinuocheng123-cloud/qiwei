# 文件说明：该脚本只用于本地开发数据库重置。
# 功能说明：在确认 DATABASE_URL 指向 127.0.0.1:55432 且数据库名为 wecom_growth_hub_demo 后，才允许执行 Prisma reset。
#
# 结构概览：
#   第一部分：读取本地 .env
#   第二部分：安全校验 DATABASE_URL
#   第三部分：执行本地重置

$ErrorActionPreference = "Stop"

if (-not (Test-Path ".env")) {
  Write-Error "未找到 .env，拒绝执行 db:reset。"
}

$envLine = Get-Content ".env" | Where-Object { $_ -match "^DATABASE_URL=" } | Select-Object -First 1
if (-not $envLine) {
  Write-Error "未找到 DATABASE_URL，拒绝执行 db:reset。"
}

$databaseUrl = $envLine -replace '^DATABASE_URL=', ''
$databaseUrl = $databaseUrl.Trim('"')

if ($databaseUrl -notmatch "127\.0\.0\.1:55432/wecom_growth_hub_demo") {
  Write-Error "DATABASE_URL 不是本地演示库 127.0.0.1:55432/wecom_growth_hub_demo，拒绝执行 db:reset。"
}

Write-Host "确认是本地演示库，开始执行 prisma migrate reset。"
npx.cmd prisma migrate reset --force
