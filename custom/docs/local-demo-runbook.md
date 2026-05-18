# 本地演示启动手册

## 1. 文档用途

这份手册用于把《企业微信业务增长中台》稳定拉起到“可本地演示、可人工试用、可内部验收”的状态。

本轮默认目标不是生产部署，而是：

- 本地可稳定启动
- 演示账号可直接登录
- 演示路径清晰
- 常见故障可快速排查

## 2. 启动前准备

请先确认以下条件：

1. 本地已具备 Node.js 与 npm。
2. 本地已安装 PostgreSQL 工具，且脚本中配置的 `postgres.exe / initdb.exe / pg_isready.exe / psql.exe` 路径可用。
3. 仓库位于：`D:\ceshi\qiwei`
4. 当前机器允许执行 PowerShell 脚本。
5. 不要把本地 `.env`、日志、数据库目录、Playwright 临时产物提交进 Git。

## 3. 推荐启动命令

可直接复制以下命令：

```powershell
D:
cd D:\ceshi\qiwei
powershell.exe -ExecutionPolicy Bypass -File custom\experiments\start-local-demo.ps1
```

## 4. 启动脚本会做什么

`custom/experiments/start-local-demo.ps1` 会自动执行以下步骤：

1. 检查当前项目目录。
2. 检查 PostgreSQL 可执行文件。
3. 检查或初始化 `custom/experiments/postgres-data`。
4. 检查数据库端口 `55432` 是否可用。
5. 启动本地 PostgreSQL。
6. 自动创建演示数据库。
7. 设置当前进程的 `DATABASE_URL / SESSION_SECRET / APP_URL`。
8. 执行：
   - `npm.cmd run prisma:generate`
   - `npx.cmd prisma migrate deploy`
   - `npm.cmd run prisma:seed`
9. 以前台方式启动 `npm.cmd run dev`。

## 5. 登录地址

- 登录页：`http://127.0.0.1:3000/login`
- 平台后台：`http://127.0.0.1:3000/admin`
- 平台自用租户首页：`http://127.0.0.1:3000/app/zhengmu-platform/dashboard`
- 样板租户首页：`http://127.0.0.1:3000/app/zhengmu-demo/dashboard`

## 6. 演示账号

### 企业管理员

- 账号：`platform-boss@zhengmu.local`
- 密码：`123456`
- 适合演示内容：
  - 初始化向导
  - 首页总览
  - 业务配置
  - Market Claw 知识库 / 资料投喂 / 训练审核 / 训练复盘
  - 审计日志
- 注意事项：
  - 这是本轮推荐的主演示账号。

### 运营角色

- 账号：`platform-operator@zhengmu.local`
- 密码：`123456`
- 适合演示内容：
  - 客户导入
  - 资料投喂
  - 候选知识审核
  - 知识库维护
  - 回复记录与训练复盘
- 注意事项：
  - 适合展示“运营如何协助落地”。

### 销售角色

- 账号：`platform-sales@zhengmu.local`
- 密码：`123456`
- 适合演示内容：
  - 跟进工作台
  - 客户列表
  - 客户详情页 Market Claw
  - 我的训练
  - 个人话术保存与提交审核
- 注意事项：
  - 该角色不应看到高权限入口。

### 平台管理员

- 账号：`admin@growthhub.local`
- 密码：`123456`
- 适合演示内容：
  - 平台租户管理
  - 平台级审计日志
- 注意事项：
  - 不作为本轮客户试点演示重点。

## 7. 三类角色体验路径

详细脚本见：

- `custom/docs/demo-script-role-paths.md`
- `custom/docs/demo-script-market-claw.md`

## 8. 常见问题

### 登录页打不开怎么办

1. 先确认 `npm.cmd run dev` 是否仍在当前 PowerShell 前台运行。
2. 确认浏览器访问的是：`http://127.0.0.1:3000/login`
3. 若端口被占用，请先处理端口冲突再重启脚本。

### 如果数据库端口不可用怎么办

1. 检查 `55432` 是否被其它进程占用。
2. 优先关闭占用端口的进程。
3. 再重新执行启动脚本。

### 如果 seed 失败怎么办

1. 先看当前控制台输出。
2. 确认 `npx.cmd prisma migrate deploy` 是否已成功。
3. 确认 `prisma/seed.ts` 中依赖的数据结构未缺失。
4. 必要时重跑：
   - `npm.cmd run prisma:generate`
   - `npx.cmd prisma migrate deploy`
   - `npm.cmd run prisma:seed`

### 如果 Prisma 引擎文件被占用怎么办

1. 关闭占用当前仓库 `node_modules/.prisma` 的终端或 Node 进程。
2. 重新执行：`npm.cmd run prisma:generate`
3. 如仍失败，关闭相关 dev server 后再重试。

## 9. 如果页面打不开怎么办

1. 看当前 PowerShell 是否停在 `npm.cmd run dev` 前台。
2. 看控制台是否有 Next.js 编译报错。
3. 看是否出现数据库不可连接报错。
4. 如有需要，重新运行启动脚本，不要只单独执行 `npm run dev`。

## 10. 如何停止演示环境

1. 在运行 `start-local-demo.ps1` 的 PowerShell 中按 `Ctrl + C` 停止 Next.js。
2. 如需进一步停止本地 PostgreSQL，请结束对应 `postgres.exe` 进程。
3. 不要删除仓库内代码文件来“清环境”。

## 11. 哪些文件不要提交

以下内容不要提交进 Git：

- `.env`
- `.env.local`
- `custom/experiments/postgres-data/`
- `custom/experiments/dev-stdout.log`
- `custom/experiments/dev-stderr.log`
- `custom/experiments/dev-postgres-stdout.log`
- `custom/experiments/dev-postgres-stderr.log`
- Playwright trace、截图、视频
- `.next`
- `node_modules`

## 12. 配套文档位置

- 演示角色路径：`custom/docs/demo-script-role-paths.md`
- Market Claw 专项演示：`custom/docs/demo-script-market-claw.md`
- 客户试点开通清单：`custom/docs/customer-pilot-onboarding-checklist.md`
- 企业资料准备清单：`custom/docs/knowledge-materials-preparation-checklist.md`
- 人工验收表：`custom/docs/manual-acceptance-checklist.md`
- 常见问题排查：`custom/docs/troubleshooting.md`
