# 企业微信业务增长中台

客户从网上来，企业微信接得住，销售跟得上，老板看得清。

## 项目定位

本项目是 SaaS 化、多租户的企业微信业务增长中台，用于统一承接抖音、小红书、视频号、公众号、官网、朋友圈、线下活动、转介绍等渠道线索，并围绕客户类型策略库完成标签、跟进、资料推荐、私域运营提醒和老板数据看板。

V1.1 聚焦真实登录、httpOnly session、RBAC 权限、多租户隔离和 PostgreSQL 端到端验证，不做企业微信 API 真实接入、不做 OA、财务、人事、审批、投流或 AI 自动成交。

## 技术栈

- Next.js App Router
- TypeScript
- Tailwind CSS
- Prisma
- PostgreSQL
- bcryptjs
- httpOnly Cookie Session

## 本地 PostgreSQL 配置

本项目不硬编码数据库地址。请先准备一个本地 PostgreSQL 数据库，然后复制 `.env.example` 为 `.env`：

```bash
cp .env.example .env
```

Windows PowerShell 可以手动复制：

```powershell
Copy-Item .env.example .env
```

`.env` 示例：

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/wecom_growth_hub?schema=public"
SESSION_SECRET="please-change-this-local-secret"
APP_URL="http://localhost:3000"
```

如果本机 PostgreSQL 没有密码，可按实际情况调整 `DATABASE_URL`。不要把生产密钥写入仓库。

## 安装依赖

```bash
npm install
```

## Prisma 迁移与 seed

```bash
npm run prisma:generate
npm run prisma:migrate -- --name init
npm run prisma:seed
```

已有迁移文件时，也可以在空库上执行：

```bash
npx prisma migrate deploy
npm run prisma:seed
```

## 启动项目

```bash
npm run dev
```

默认访问：

- 首页：`http://localhost:3000`
- 登录页：`http://localhost:3000/login`
- 平台总后台：`http://localhost:3000/admin`
- 企业看板：`http://localhost:3000/app/zhengmu-demo/dashboard`
- 客户列表：`http://localhost:3000/app/zhengmu-demo/leads`
- 客户类型策略库：`http://localhost:3000/app/zhengmu-demo/strategies`
- 资料包管理：`http://localhost:3000/app/zhengmu-demo/materials`
- 企业微信配置预留：`http://localhost:3000/app/zhengmu-demo/wecom`
- 客户导出：`http://localhost:3000/app/zhengmu-demo/export`
- 诊断表单：`http://localhost:3000/t/zhengmu-demo/diagnosis?source=douyin`
- 资料领取表单：`http://localhost:3000/t/zhengmu-demo/material?source=xiaohongshu`

## 登录账号

seed 后可使用以下账号，密码均为 `123456`：

- 平台管理员：`admin@growthhub.local`
- 企业管理员：`boss@zhengmu.local`
- 运营人员：`operator@zhengmu.local`
- 销售顾问：`sales@zhengmu.local`
- 第二租户管理员：`boss@isolation.local`
- 第二租户运营：`operator@isolation.local`
- 第二租户销售：`sales@isolation.local`

## 权限说明

- `PLATFORM_ADMIN`：只能访问 `/admin`，可创建、查看、停用所有企业租户。
- `TENANT_ADMIN`：只能访问自己企业的 `/app/[tenantSlug]` 后台，可看本企业全部线索、看板、策略、资料和导出客户基础数据。
- `OPERATOR`：只能访问自己企业后台，可维护策略库、资料包、线索和运营内容，不可访问平台后台。
- `SALES`：只能访问自己企业后台，并且客户列表和客户详情只显示 `ownerId` 等于当前用户的线索；可新增跟进、更新阶段、设置下次跟进时间。
- 未登录用户访问 `/admin` 或 `/app/[tenantSlug]` 会跳转 `/login`。
- 非平台管理员访问 `/admin` 会进入无权限页。
- 公开表单 `/t/[tenantSlug]/diagnosis` 和 `/t/[tenantSlug]/material` 可匿名访问。

## 端到端验证流程

1. 启动 PostgreSQL。
2. 复制 `.env.example` 为 `.env`。
3. 配置 `DATABASE_URL`、`SESSION_SECRET`、`APP_URL`。
4. 执行 `npm run prisma:generate`。
5. 执行 `npx prisma migrate deploy` 或 `npm run prisma:migrate -- --name init`。
6. 执行 `npm run prisma:seed`。
7. 启动 `npm run dev`。
8. 访问 `/login`，使用 `admin@growthhub.local / 123456` 登录。
9. 访问 `/admin`，确认能看到 `zhengmu-demo` 和 `isolation-demo`。
10. 退出后使用 `boss@zhengmu.local / 123456` 登录。
11. 访问 `/app/zhengmu-demo/dashboard` 和 `/app/zhengmu-demo/leads`。
12. 匿名访问 `/t/zhengmu-demo/diagnosis?source=douyin`，提交一个业主客户线索。
13. 回到客户列表确认新线索出现。
14. 进入客户详情，确认展示客户类型策略、推荐资料和跟进记录。
15. 新增一条跟进记录，更新阶段和下次跟进时间。
16. 返回看板，确认统计变化。
17. 访问 `/app/zhengmu-demo/export` 下载 CSV。
18. 使用 `sales@zhengmu.local / 123456` 登录，确认只能看到分配给自己的客户。

## 数据隔离验证

seed 会创建第二个租户 `isolation-demo`。验证方式：

- `boss@zhengmu.local` 不能访问 `/app/isolation-demo/dashboard`。
- `sales@zhengmu.local` 不能看到 `isolation-demo` 的线索。
- `boss@isolation.local` 不能访问 `/app/zhengmu-demo/dashboard`。
- 非平台管理员访问 `/admin` 会被拒绝。
- 未登录访问任意 `/app/[tenantSlug]` 后台会跳转 `/login`。

本轮还提供实验验证脚本：

```powershell
powershell.exe -ExecutionPolicy Bypass -File custom\experiments\run-v11-postgres-check.ps1
```

该脚本会临时启动本地实验 PostgreSQL、执行迁移、seed，并运行 `custom/experiments/verify-v11-e2e.ts` 检查账号、双租户、策略、线索、销售可见范围和表单入库模拟。

## V1.1 功能清单

- 真实登录页 `/login`
- bcrypt 密码 hash 校验
- 数据库 `Session` + httpOnly cookie 会话
- `/logout` 退出登录
- 平台、租户、销售级 RBAC
- 企业后台 tenantId 强制隔离
- 销售线索 ownerId 强制隔离
- 公开表单匿名提交并创建 Lead/IntakeForm
- 客户详情展示客户类型策略
- 新增跟进、更新阶段、设置下次跟进时间
- 基础看板读取真实数据库统计
- 客户基础数据 CSV 导出
- PostgreSQL 迁移、seed 和验证脚本

## 后续开发计划

1. 增加 middleware 级别的更早拦截和审计日志。
2. 增加自动化测试，覆盖登录、权限、表单和导出。
3. 企业微信 API 适配层从客户联系、外部联系人、客户标签同步开始。
4. 完善策略库版本管理和运营提醒队列。
