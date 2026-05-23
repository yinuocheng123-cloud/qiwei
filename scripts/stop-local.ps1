# 文件说明：该脚本用于停止本地开发服务并清理测试缓存。
# 功能说明：停止 node / Next dev 进程，清理 .next 与 test-results，并检查 3000 端口状态。
#
# 结构概览：
#   第一部分：项目根目录检查
#   第二部分：停止本地 Node 服务
#   第三部分：清理缓存与测试产物
#   第四部分：检查 3000 端口状态

$ErrorActionPreference = "Stop"

function Write-Step {
  param([string]$Message)

  Write-Host ""
  Write-Host "===== $Message ====="
}

Write-Step "检查项目根目录"
if (-not (Test-Path "package.json")) {
  throw "请先执行：Set-Location D:\ceshi\qiwei，然后再运行 scripts\stop-local.ps1。"
}
Write-Host "当前目录：$(Get-Location)"

Write-Step "停止 node / Next dev 进程"
$nodeProcesses = Get-Process node -ErrorAction SilentlyContinue
if ($nodeProcesses) {
  $nodeProcesses | Stop-Process -Force
  Write-Host "已停止 node 进程数量：$($nodeProcesses.Count)"
} else {
  Write-Host "未发现 node 进程。"
}

Write-Step "清理 .next"
Remove-Item -Recurse -Force ".next" -ErrorAction SilentlyContinue
Write-Host "已清理 .next。"

Write-Step "清理 test-results"
Remove-Item -Recurse -Force "test-results" -ErrorAction SilentlyContinue
Write-Host "已清理 test-results。"

Write-Step "检查 3000 端口"
$portRows = netstat -ano | findstr ":3000"
if ($portRows -and ($portRows | Select-String "LISTENING")) {
  Write-Host "3000 端口仍有 LISTENING 占用："
  Write-Host $portRows
  Write-Host "如需继续清理，请根据 PID 手动确认后停止。"
} elseif ($portRows) {
  Write-Host "3000 端口没有 LISTENING，占用记录仅为 TIME_WAIT 等连接收尾状态："
  Write-Host $portRows
} else {
  Write-Host "3000 端口未发现监听。"
}

Write-Host ""
Write-Host "本地开发服务停止与缓存清理完成。"
