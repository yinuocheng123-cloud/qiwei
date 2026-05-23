# 本地开发环境与 E2E 测试准备

## 当前机器状态

本机曾出现过两类 Docker 状态：

```powershell
docker --version
docker compose version
```

第一类是 CLI 未识别：

```text
docker : The term 'docker' is not recognized as the name of a cmdlet
```

第二类是 CLI 可用但 Engine 启动失败：

```text
Docker Desktop is unable to start
```

这说明当前不能只看 Docker CLI 是否存在。要运行 Playwright E2E，最终条件是 PostgreSQL 在 `127.0.0.1:55432` 可连接。

## 两种可选方案

### 方案一：安装 Docker Desktop

1. 安装 Docker Desktop。
2. 启动 Docker Desktop，等待 Docker Engine ready。
3. 重新打开 PowerShell。
4. 执行：

```powershell
docker --version
docker compose version
```

确认两个命令都有版本输出后，再回到项目目录。

### 方案二：使用本地 PostgreSQL

如果不安装 Docker，也可以手动启动本地 PostgreSQL，并确保它监听：

- Host：`127.0.0.1`
- Port：`55432`
- User：`postgres`
- Database：`wecom_growth_hub_demo`
- Schema：`public`

连接串以 `.env` 为准：

```text
postgresql://postgres@127.0.0.1:55432/wecom_growth_hub_demo?schema=public
```

当前机器已发现本地 PostgreSQL 17：

```text
D:\tools\pgsql17\pgsql\bin\postgres.exe
D:\tools\pgsql17\pgsql\bin\pg_ctl.exe
D:\tools\pgsql17\pgsql\bin\psql.exe
```

如果 Docker Desktop Engine 起不来，可以使用本机 PostgreSQL fallback：

```powershell
Set-Location D:\ceshi\qiwei
D:\tools\pgsql17\pgsql\bin\pg_ctl.exe -D D:\ceshi\qiwei\custom\experiments\postgres-data -l D:\ceshi\qiwei\custom\experiments\postgres-v222.log -o "-p 55432" start
```

然后确认：

```powershell
D:\tools\pgsql17\pgsql\bin\pg_isready.exe -h 127.0.0.1 -p 55432 -U postgres
```

如果返回 `accepting connections`，再执行 Prisma 和 Playwright。

## 当前本地 PGDATA 约定

V2.3.1 起，`scripts/start-local.ps1` 会自动检查本地 PostgreSQL 数据目录，优先顺序为：

1. `.local/postgres-data`
2. `tmp/postgres-data`
3. `custom/experiments/postgres-data`

如果这些目录里已经有 `PG_VERSION`，脚本会直接复用对应 PGDATA；如果都没有初始化完成的数据目录，脚本会自动在 `.local/postgres-data` 执行 `initdb`，再用 `pg_ctl -D <PGDATA> -o "-p 55432" -l <log> start` 启动。

如果 `pg_ctl` / `initdb` 不在 PATH，脚本会输出清晰提示，说明需要安装 PostgreSQL 或把 PostgreSQL `bin` 目录加入 PATH。

如果 `pg_ctl` 启动后仍因为 Windows restricted token 等原因没有监听，`scripts/start-local.ps1` 会再打开一个独立 PowerShell 窗口，直接以前台方式运行 `postgres.exe` 作为最后兜底。

## 推荐 PowerShell 入口

所有本地检查都从项目根目录开始：

```powershell
Set-Location D:\ceshi\qiwei
```

不要使用 `cd /d D:\ceshi\qiwei`，这是 `cmd.exe` 写法，在 PowerShell 中会失败。

## Docker 启动数据库

如果 Docker 可用，执行：

```powershell
Set-Location D:\ceshi\qiwei
docker compose up -d
```

本项目的 `docker-compose.yml` 只启动 PostgreSQL：

- 服务名：`postgres`
- 镜像：`postgres:16`
- 本地端口：`55432`
- 容器端口：`5432`
- 数据库：`wecom_growth_hub_demo`
- 用户：`postgres`

## 初始化数据库

```powershell
Set-Location D:\ceshi\qiwei
npm run db:generate
npm run db:push
npm run db:seed
```

`db:seed` 复用已有 `prisma/seed.ts`，会生成本地演示账号和演示数据。该 seed 只用于本地开发、演示和测试，不用于生产。

## 运行 V2.2 / V2.2.1 Smoke

```powershell
Set-Location D:\ceshi\qiwei
npm run test:e2e:v22
npm run test:e2e:v221
```

Playwright 配置会自动启动 Next dev server。如果数据库未启动，登录阶段会失败，并出现：

```text
Can't reach database server at 127.0.0.1:55432
```

这是本地数据库环境问题，不是业务代码问题。

## 一键检查脚本

```powershell
Set-Location D:\ceshi\qiwei
powershell.exe -ExecutionPolicy Bypass -File scripts\dev-check.ps1
```

脚本会依次检查 Node、npm、DATABASE_URL、Docker、PostgreSQL，然后执行 Prisma、typecheck、lint、build 和 smoke 测试。

如果 Docker 不可用或 Docker Engine 起不来，脚本会尝试使用本机 PostgreSQL fallback。fallback 也不可用时，会提示：

```text
请修复 Docker Desktop / WSL2，或手动启动本地 PostgreSQL，并确保 127.0.0.1:55432 可连接。
```
