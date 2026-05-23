# 本地开发环境与 E2E 测试准备

## 当前前提

本仓库本地开发现在以两窗口工作流为准：

1. 窗口一运行 `scripts/start-local.ps1`，并保持打开。
2. 窗口二运行 `scripts/check-local.ps1` 或 `scripts/test-smoke.ps1`。
3. 结束时运行 `scripts/stop-local.ps1`。

当前 `.env` 的数据库地址仍然指向本机 55432：

```text
DATABASE_URL="postgresql://postgres@127.0.0.1:55432/wecom_growth_hub_demo?schema=public"
```

如果本机 PostgreSQL 没有启动，`start-local.ps1` 会自动检查这些本地数据目录，优先顺序为：

1. `.local/postgres-data`
2. `tmp/postgres-data`
3. `custom/experiments/postgres-data`

如果这些目录都还没有初始化，脚本会自动执行 `initdb` 创建默认的 `.local/postgres-data`。

## 推荐启动方式

### 窗口一：启动本地开发环境

```powershell
Set-Location D:\ceshi\qiwei
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\start-local.ps1
```

`start-local.ps1` 会在当前 PowerShell 前台完成这些事情：

1. 停掉旧的 node / Next dev 进程。
2. 清理 `.next`。
3. 检查 `DATABASE_URL`。
4. 启动并验证本地 PostgreSQL fallback 的 `55432 LISTENING`。
5. 执行 `db:generate`、`db:push`、`db:seed`、`typecheck`、`lint`、`build`。
6. 再次清理 build 产物，避免 Next dev 与生产构建缓存混用。
7. 最后直接运行 `npm.cmd run dev`。

这个窗口必须保持打开，不要关闭。

### 窗口二：检查本地可打开状态

```powershell
Set-Location D:\ceshi\qiwei
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\check-local.ps1
```

`check-local.ps1` 会检查：

1. `55432` 是否 `LISTENING`
2. `3000` 是否 `LISTENING`
3. `node` / `postgres` 进程
4. `/login` 页面是否可访问

脚本会输出 `Result: OPENABLE` 或 `Result: NOT OPENABLE`。

### 窗口二：执行 smoke 测试

```powershell
Set-Location D:\ceshi\qiwei
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\test-smoke.ps1
```

`test-smoke.ps1` 只负责测试，不会尝试自动拉起 dev server。  
如果 3000 不可用，先回到窗口一重新运行 `start-local.ps1`。

### 结束与清理

```powershell
Set-Location D:\ceshi\qiwei
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\stop-local.ps1
```

`stop-local.ps1` 会：

1. 停止 node / Next dev 进程。
2. 停止能识别到的本地 PostgreSQL fallback。
3. 清理 `.next` 和 `test-results`。
4. 输出 `3000` 和 `55432` 的端口状态。

## 手动 PostgreSQL fallback

如果需要单独排查本机 PostgreSQL，也可以手动执行：

```powershell
Set-Location D:\ceshi\qiwei
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\run-postgres-fallback.ps1
```

这只是手动排障入口，正常日常流程仍以 `start-local.ps1` + `check-local.ps1` / `test-smoke.ps1` 为准。

## 判断标准

当以下条件同时满足时，本地环境才算可打开：

1. `55432 LISTENING`
2. `3000 LISTENING`
3. `/login` 可访问
4. `check-local.ps1` 输出 `Result: OPENABLE`

如果任一条件不满足，不要直接继续 smoke 测试，先回到窗口一重新启动。
