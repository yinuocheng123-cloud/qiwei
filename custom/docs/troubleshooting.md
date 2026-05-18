# 常见问题与故障处理说明

## 1. 登录页打不开

排查步骤：

1. 确认 `npm.cmd run dev` 是否仍在运行。
2. 确认访问地址是：`http://127.0.0.1:3000/login`
3. 确认没有其它进程占用 `3000` 端口。

## 2. 页面显示数据库不可用

排查步骤：

1. 确认本地 PostgreSQL 已启动。
2. 确认当前进程中的 `DATABASE_URL` 指向本地演示库。
3. 优先用 `start-local-demo.ps1` 重新拉起环境，而不是只单独执行 `npm run dev`。

## 3. 端口被占用

排查步骤：

1. 看脚本提示是 `3000` 还是 `55432` 被占用。
2. 先停止占用端口的进程。
3. 再重新执行启动脚本。

## 4. 本地数据库没有启动

排查步骤：

1. 确认 `postgres.exe` 路径存在。
2. 确认 `custom/experiments/postgres-data/` 是有效数据目录。
3. 查看：
   - `custom/experiments/dev-postgres-stdout.log`
   - `custom/experiments/dev-postgres-stderr.log`

## 5. Prisma generate 失败

排查步骤：

1. 关闭可能占用 Prisma 引擎文件的 Node / Next.js 进程。
2. 重新执行：`npm.cmd run prisma:generate`
3. 如仍失败，重开终端再执行。

## 6. seed 失败

排查步骤：

1. 看当前控制台错误输出。
2. 先确认 `npx.cmd prisma migrate deploy` 成功。
3. 再重试：`npm.cmd run prisma:seed`

## 7. build 失败

排查步骤：

1. 先执行：
   - `npm.cmd run prisma:generate`
   - `npx.cmd tsc --noEmit`
   - `npm.cmd run lint`
2. 再执行：`npm.cmd run build`
3. 如果报的是类型或依赖问题，先修本地环境和编译错误，不要直接跳过。

## 8. Playwright 不稳定

排查步骤：

1. 使用：`--workers=1`
2. 确认测试定位器足够收窄。
3. 先等待明确页面状态，而不是做全页模糊断言。

## 9. 登录账号不可用

排查步骤：

1. 确认 seed 已执行成功。
2. 确认使用的是 README 和本轮文档中记录的账号。
3. 若仍失败，重新执行：`npm.cmd run prisma:seed`

## 10. 页面权限不符合预期

排查步骤：

1. 先确认当前登录的角色。
2. 核对该角色是否本就不应看到该入口。
3. 再检查是否命中了错误租户、错误账号或旧 session。

## 11. Market Claw 没有数据

排查步骤：

1. 确认 seed 已写入演示数据。
2. 确认当前租户是 `zhengmu-platform` 或 `zhengmu-demo`。
3. 确认资料投喂、知识库或训练页不是空白初始化状态。

## 12. 训练复盘没有数据

排查步骤：

1. 确认当前租户已有训练样本、候选知识或回复记录。
2. 确认访问角色是否是销售个人视图。
3. 如果是新环境，先跑一次资料投喂或训练提交流程。

## 13. 初始化向导数据不足

排查步骤：

1. 这是动态判断页，不是强制要求所有数据都已存在。
2. 如果当前客户、业务线、资料、知识都少，页面会自然显示“基础配置”路径。
3. 先补最小数据，再回到初始化向导看变化。
