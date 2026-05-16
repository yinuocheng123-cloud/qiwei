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

## 本地演示环境启动手册

完整本地演示启动步骤见：

`custom/notes/v1.4.5-local-demo-runbook.md`

## 直接给链接测试

如果你希望把当前本地环境直接变成“给一个链接就能测”，建议先按本地演示手册准备好 `.env`、PostgreSQL、migrate 和 seed，然后执行：

```bash
npm run demo:link
```

这个脚本会做两件事：

1. 用 `0.0.0.0:3000` 启动开发服务器，方便同一局域网直接访问；
2. 如果机器已经安装 `cloudflared`，会额外给出一个可对外分享的 `trycloudflare.com` 公网测试链接。

如果只想看脚本会做什么、不真正启动服务，可执行：

```powershell
powershell.exe -ExecutionPolicy Bypass -File custom\experiments\start-demo-link.ps1 -DryRun
```

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
- 整木网业务工作台：`http://localhost:3000/app/zhengmu-platform/dashboard`
- 演示说明页：`http://localhost:3000/app/zhengmu-demo/demo-guide`
- 整木网自用说明页：`http://localhost:3000/app/zhengmu-platform/demo-guide`
- 客户列表：`http://localhost:3000/app/zhengmu-demo/leads`
- 整木网客户列表：`http://localhost:3000/app/zhengmu-platform/leads`
- 客户类型策略库：`http://localhost:3000/app/zhengmu-demo/strategies`
- 资料包管理：`http://localhost:3000/app/zhengmu-demo/materials`
- 企业微信配置预留：`http://localhost:3000/app/zhengmu-demo/wecom`
- 客户导出：`http://localhost:3000/app/zhengmu-demo/export`
- 诊断表单：`http://localhost:3000/t/zhengmu-demo/diagnosis?source=douyin`
- 资料领取表单：`http://localhost:3000/t/zhengmu-demo/material?source=xiaohongshu`
- CNAS 路径判断问卷：`http://localhost:3000/forms/cnas-path-check`

## 登录账号

seed 后可使用以下账号，密码均为 `123456`：

- 平台管理员：`admin@growthhub.local`
- 企业管理员：`boss@zhengmu.local`
- 运营人员：`operator@zhengmu.local`
- 销售顾问：`sales@zhengmu.local`
- 整木网平台业务管理员：`platform-boss@zhengmu.local`
- 整木网平台运营：`platform-operator@zhengmu.local`
- 整木网平台销售顾问：`platform-sales@zhengmu.local`
- 第二租户管理员：`boss@isolation.local`
- 第二租户运营：`operator@isolation.local`
- 第二租户销售：`sales@isolation.local`

## 整木行业演示路径

V1.4 开始，`zhengmu-demo` 会在 seed 后自动生成整木行业样板数据，可直接用于对外演示和销售沟通。

V1.4.1 新增系统内演示说明页 `/app/zhengmu-demo/demo-guide`，适合给企业管理员、运营和销售在正式演示前先统一讲解口径、演示顺序和四类客户路径。

推荐演示账号：

- 企业管理员：`boss@zhengmu.local`
- 销售顾问：`sales@zhengmu.local`

推荐演示顺序：

1. 先用 `boss@zhengmu.local` 打开 `/app/zhengmu-demo/demo-guide`，快速讲清系统定位、推荐演示顺序、四类客户路径、老板视角和销售视角。
2. 再进入 `/app/zhengmu-demo/dashboard`，看来源分布、客户类型分布、阶段分布和销售跟进概览。
3. 进入 `/app/zhengmu-demo/leads`，按业主客户、经销商客户、设计师客户、工厂客户各打开一个客户详情。
4. 在客户详情页重点演示客户类型、来源渠道、阶段、推荐资料、推荐话术、推荐下一步动作、已有跟进、当前任务和任务模板。
5. 切换到 `sales@zhengmu.local`，进入 `/app/zhengmu-demo/todos`，演示今日任务、逾期任务、高优先级任务、本周待跟进、已完成任务和不同客户类型任务。
6. 如需展示任务模板管理，可再切回企业管理员进入 `/app/zhengmu-demo/task-templates`。

四类客户演示样本：

- 业主客户：关注效果、环保、价格、交付、售后、设计落地。
- 经销商客户：关注利润、政策、区域保护、总部支持、样板门店、风险。
- 设计师客户：关注审美、落地、工艺、材料、案例、项目配合。
- 工厂客户：关注获客、招商、品牌、成交、企业微信、AI 推广、GEO。

## 中华整木网自用业务工作台

V1.6 新增 `zhengmu-platform` 租户，用于“中华整木网自己先把系统用起来”，不是给外部客户看的企业样板。

- `zhengmu-demo`：整木企业样板演示租户，适合对外讲客户增长中台。
- `zhengmu-platform`：整木网自用业务工作台样板，适合内部管理会员、GEO／AI 推广、乌镇设计周、培训课程、集采供应链、一清一护、品牌增信和联盟合作等机会。

推荐体验账号：

- 平台业务管理员：`platform-boss@zhengmu.local`
- 平台销售顾问：`platform-sales@zhengmu.local`

推荐演示顺序：

1. 先进入 `/app/zhengmu-platform/demo-guide`，看“中华整木网自用说明”。
2. 再进入 `/app/zhengmu-platform/dashboard`，看业务线分布、客户数量和任务概览。
3. 打开 `/app/zhengmu-platform/leads`，重点看整木工厂老板、会员意向、GEO／AI 推广、活动／乌镇资源四类客户详情。
4. 在客户详情页演示推荐资料、当前任务、智能跟进助手和智能标签建议。
5. 切换到 `platform-sales@zhengmu.local`，进入 `/app/zhengmu-platform/todos`，看今日任务、逾期任务和高优先级任务。
6. 如需追动作，可进入 `/app/zhengmu-platform/audit-logs` 查看建议生成和标签确认记录。

V1.5／V1.5.1 的“智能跟进助手”和“智能标签建议”在 `zhengmu-platform` 中同样可直接使用，但仍然只做销售辅助，不自动回复客户，也不自动打标签。

## CNAS认可指南项目接入

CNAS 认可指南不是独立新系统，而是接入现有《企业微信业务增长中台》的一个业务项目。
- 业务承接继续复用 `BusinessLine`、`Lead`、`LeadTag`、公开表单、任务和资料包。
- 当前接入租户为 `zhengmu-platform`，业务线为 `CNAS认可指南`。
- 公开入口为 `/forms/cnas-path-check`，用于收集实验室类型、当前阶段、主要担心问题、启动时间和 UTM 来源参数。
- 表单提交后会生成或更新线索，写入 CNAS 项目标签、实验室类型标签、阶段标签、风险标签和意向标签。
- 系统会按 A / B / C 三类规则生成初步诊断，并为已分配负责人创建对应的顾问跟进任务。
- 企业微信承接当前只提供欢迎语模板和内部表单路径占位，不接企业微信 API，不自动发送消息，不自动回复客户。

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

## V1.1.1 安全与审计补强

V1.1.1 增加了 `middleware.ts` 后台路径拦截：

- 未登录访问 `/admin`、`/app/*` 会跳转 `/login?next=...`。
- 已登录但非 `PLATFORM_ADMIN` 访问 `/admin` 会跳转 `/forbidden`。
- 企业角色访问 `/app/[tenantSlug]` 时，middleware 会校验签名 cookie 中的 `tenantSlug` 是否匹配。
- `/t/[tenantSlug]/diagnosis`、`/t/[tenantSlug]/material`、`/login`、`/logout`、`/forbidden`、首页和静态资源不在后台拦截范围内。
- middleware 只做路径层基础保护，页面和 Server Actions 里的数据库权限校验仍然保留。

为支持 middleware，登录成功后会额外写入一个 httpOnly 的签名权限提示 cookie。该 cookie 只保存 `userId`、`role`、`tenantSlug` 和过期时间，不替代数据库 Session。

## 审计日志

Prisma 新增 `AuditLog` 模型，字段包括：

- `tenantId`
- `userId`
- `action`
- `entityType`
- `entityId`
- `metadata`
- `ip`
- `userAgent`
- `createdAt`

当前已记录：

- 登录成功：`login_succeeded`
- 登录失败：`login_failed`
- 退出登录：`logout`
- 公开表单创建线索：`public_form_lead_created`
- 新增跟进：`followup_created`
- 更新客户阶段：`lead_stage_updated`
- 导出客户 CSV：`lead_csv_exported`
- 创建租户：`tenant_created`
- 更新租户状态：`tenant_status_updated`

V1.1.1 暂不做审计日志查询页面。

## Playwright E2E 测试

安装依赖后可运行：

```bash
npm run test:e2e
```

测试文件：

```text
tests/v11-browser-e2e.spec.ts
```

覆盖流程：

- 平台管理员登录并进入 `/admin`
- 企业管理员登录并进入 `/app/zhengmu-demo/dashboard`
- 匿名提交公开诊断表单
- 企业管理员在客户列表看到新线索
- 客户详情展示客户类型策略
- 新增跟进并更新阶段/下次跟进时间
- 销售只能看到自己负责的客户
- 销售访问非本人客户详情会被拒绝
- 企业管理员可下载 CSV
- 销售不能导出全量客户

运行浏览器端 E2E 前请确保：

1. PostgreSQL 正在运行。
2. `.env` 已配置 `DATABASE_URL`、`SESSION_SECRET`、`APP_URL`。
3. 已执行 `npx prisma migrate deploy` 或 `npm run prisma:migrate -- --name init`。
4. 已执行 `npm run prisma:seed`。
5. 已安装 Playwright 浏览器：`npx playwright install chromium`。
6. 执行 `npm run test:e2e`。

当前开发环境可以通过 `custom\experiments\run-v11-postgres-check.ps1` 临时运行 PostgreSQL 并验证数据库闭环，但该临时服务难以跨多次工具调用长期驻留；因此浏览器 E2E 在真实本地开发时建议使用常驻 PostgreSQL。

Windows 环境如果 Playwright 内置 `webServer` 收尾卡住，可以手动启动 `npm run dev`，再设置 `PLAYWRIGHT_SKIP_WEBSERVER=1` 后执行 `npx playwright test --reporter=list`。

从 V1.2 到 V1.3.1 的浏览器用例会直接修改 seed 数据，请不要把 `tests/v11*`、`tests/v12*`、`tests/v13*`、`tests/v131*` 并行混跑。当前稳定执行方式是：每个 spec 单独重置数据库、重新 seed，并使用 `--workers=1` 按版本顺序依次运行。

建议顺序：

```bash
npx playwright test tests/v131-task-template-reminder-e2e.spec.ts --workers=1 --reporter=list
npx playwright test tests/v11-browser-e2e.spec.ts --workers=1 --reporter=list
npx playwright test tests/v12-business-e2e.spec.ts --workers=1 --reporter=list
npx playwright test tests/v13-task-workbench-e2e.spec.ts --workers=1 --reporter=list
npx playwright test tests/v14-demo-dataset-e2e.spec.ts --workers=1 --reporter=list
```

## V1.5.1 智能标签建议

V1.5.1 在 V1.5 的“智能跟进助手”上补齐“智能标签建议”。
- 系统只推荐标签，不自动打标签。
- 推荐标签来自客户问题、客户类型、当前阶段、需求类型以及现有策略和资料上下文。
- 销售、运营或企业管理员必须人工勾选并确认后，标签才会真正写入客户档案。
- 已存在的同名标签不会重复添加。
- 这项能力适合减少销售判断成本，但不能替代人工判断。

当前入口：
- `/app/[tenantSlug]/leads/[id]`

当前页面会同步展示：
- 三条不同风格的建议回复。
- 本次推荐标签。
- 客户已有标签。
- “确认添加标签”后的审计记录。

## V1.5 智能跟进助手

V1.5 在客户详情页新增“智能跟进助手”，定位是销售辅助，不是 AI 客服。

- 不自动回复客户。
- 不接企业微信消息接口。
- 不读取企业微信真实聊天记录。
- 只根据当前客户类型、跟进阶段、策略库和资料包生成建议回复。
- 销售需要自己查看、复制、修改后再发送给客户。

当前入口：

- `/app/[tenantSlug]/leads/[id]`

每次生成会给出三条不同风格的建议回复：

- 直接型
- 温和型
- 专业型

每条建议都会包含：

- 回复话术
- 推荐资料
- 下一步动作
- 注意事项

每次运行上面任一 spec 前，都要先执行一轮数据库 reset + migrate + seed，避免上一个版本的测试结果污染当前版本断言。

## 后续开发计划

1. 增加审计日志查询页面和筛选。
2. 补充 CI 中的 Playwright 数据库准备流程。
3. 企业微信 API 适配层从客户联系、外部联系人、客户标签同步开始。
4. 完善策略库版本管理和运营提醒队列。

## V1.2 业务可用增强

V1.2 在 V1.1.1 的登录、RBAC、多租户隔离、middleware 和 AuditLog 基础上，补齐销售、运营、企业管理员日常使用的基础闭环。

- 客户分配：`TENANT_ADMIN` 和 `OPERATOR` 可在客户详情页把线索分配给本租户下的 `SALES` 或 `OPERATOR`，销售不能转派客户。
- 销售待办：新增 `/app/[tenantSlug]/todos`，展示今日待跟进、超时未跟进、高意向待处理、待激活客户、最近新增客户；未分配客户仅企业管理员和运营可见。
- 客户详情增强：继续按 `customerType` 匹配 `CustomerTypeStrategy`，展示关心点、首发资料、欢迎语、3/7/15 天话术、人工介入条件、推荐下一步动作和绑定资料包。
- 资料包绑定：资料包可绑定客户类型，客户详情页会按客户类型推荐；运营和企业管理员可维护，销售只读。
- 策略库权限：企业管理员和运营可编辑策略库，销售只读查看。
- 看板增强：dashboard 增加今日待跟进、超时未跟进、未分配、待激活和销售跟进概览表。
- 审计日志查询：新增 `/app/[tenantSlug]/audit-logs`，企业管理员和运营可查看本租户日志，销售只能查看自己的操作日志。

### V1.2 权限边界

- `TENANT_ADMIN`：可查看本租户全部客户、待办、销售概览、审计日志，可分配客户、维护策略库和资料包。
- `OPERATOR`：可查看本租户全部客户与待办，可分配客户、维护策略库和资料包、查看审计日志。
- `SALES`：只能查看和跟进 `ownerId` 等于自己的客户；不能导出全部客户，不能编辑策略库或资料包，不能查看未分配客户。
- 所有业务查询继续基于 `tenantId` 过滤，客户详情和 Server Actions 继续使用服务端权限校验。

### V1.2 E2E 测试

新增浏览器端测试文件：

```text
tests/v12-business-e2e.spec.ts
```

覆盖企业管理员分配客户、销售待办与隔离、销售新增跟进、销售禁止编辑资料包、运营编辑资料包、客户详情推荐资料和话术、审计日志动作查询。

运行方式：

```bash
npx playwright test tests/v12-business-e2e.spec.ts --workers=1 --reporter=list
```

执行前请先单独 reset 数据库并重新 seed，不要和其他版本 spec 混跑。

## V1.3 任务驱动型业务工作台

V1.3 在 V1.2 的客户分配、销售待办、资料包绑定和审计日志基础上，新增真实任务模型 `FollowTask`，把待办从查询型规则升级为任务驱动。

- 任务模型：新增 `FollowTask`，包含任务类型、状态、优先级、负责人、创建人、关联客户、到期时间、完成/取消时间。
- 自动生成规则：公开表单创建线索、客户分配、设置下次跟进、阶段更新为 `QUOTED` 或 `TO_REACTIVATE` 时，会生成对应跟进任务。
- 销售工作台：`/app/[tenantSlug]/todos` 展示今日任务、逾期任务、高优先级任务、本周待跟进、已完成任务，以及我的高意向、报价、待激活客户。
- 任务操作：销售可完成、延期、取消自己的任务；企业管理员和运营可处理本租户任务。
- 批量操作：客户列表支持批量分配负责人、批量更新阶段、批量设置下次跟进、批量添加标签、批量转入待激活。
- 团队管理视图：dashboard 的销售概览增加今日任务、逾期任务、已完成任务、报价客户等指标。
- 平台级审计日志：新增 `/admin/audit-logs`，仅 `PLATFORM_ADMIN` 可访问，可跨租户按 tenant、action、user、entityType 和时间筛选。

### V1.3 权限边界

- `PLATFORM_ADMIN`：可访问 `/admin` 和 `/admin/audit-logs`，企业角色访问平台审计页会被拒绝。
- `TENANT_ADMIN`：可管理本租户全部客户和任务，可执行批量操作，可查看团队任务概览。
- `OPERATOR`：可管理本租户客户、任务、策略和资料，可执行批量操作。
- `SALES`：只能查看和处理 `ownerId` 等于自己的客户和任务；不能批量分配、不能编辑策略库/资料包、不能导出全部客户。
- 所有任务和批量操作继续基于 `tenantId` 过滤，不能跨租户。

### V1.3 E2E 测试

新增测试文件：

```text
tests/v13-task-workbench-e2e.spec.ts
```

覆盖企业管理员批量分配、批量更新阶段、销售任务可见范围、销售完成任务、团队任务概览、批量操作 AuditLog、平台审计日志访问，以及企业管理员访问平台审计页被拒绝。

建议使用以下命令单独执行，并在执行前重置数据库与 seed：

```bash
npx playwright test tests/v13-task-workbench-e2e.spec.ts --workers=1 --reporter=list
```
## V1.3.1 任务去重、模板与提醒队列

V1.3.1 在 V1.3 的 `FollowTask` 基础上补强任务生产质量和后续消息提醒边界，不做企业微信 API 真实发送。

- 任务去重规则：`src/lib/tasks.ts` 统一处理任务创建。同一 `tenantId`、`leadId`、`ownerId`、`type`，且状态为 `PENDING` 或 `DELAYED`、`dueAt` 位于同一天时，不再新建重复任务，而是更新原任务的标题、说明、优先级和到期时间，并写入 `task_deduped_updated` 审计日志。
- 手动任务创建：客户详情页新增“创建任务”表单。`TENANT_ADMIN` 和 `OPERATOR` 可给本租户销售或运营创建任务；`SALES` 只能给自己负责的客户创建任务，且负责人必须是自己。
- 任务模板：新增 `TaskTemplate` 模型和 `/app/[tenantSlug]/task-templates` 页面。企业管理员和运营可新增、编辑、停用模板；销售不可访问模板管理页。客户详情页创建任务时可选择模板，空白字段会使用模板标题、说明、类型、优先级和默认到期天数。
- 提醒队列：新增 `ReminderQueue` 模型，当前仅生成 `IN_APP` 提醒记录，不真实发送消息。创建有 `dueAt` 的任务会生成待发送提醒；任务完成或取消会取消未发送提醒，为后续企业微信内部应用消息提醒预留队列结构。
- 工作台增强：`/app/[tenantSlug]/todos` 支持按任务状态、任务类型、优先级和负责人筛选；销售仍只能看到自己的任务。
- 审计日志增强：新增 `task_manual_created`、`task_template_created`、`task_template_updated`、`task_template_deactivated`、`task_template_used`、`task_deduped_updated`、`reminder_created`、`reminder_updated`、`reminder_cancelled` 等动作。

### V1.3.1 权限边界

- `TENANT_ADMIN`：可管理本租户全部任务、任务模板和提醒相关动作。
- `OPERATOR`：可管理本租户任务和任务模板，可给销售创建任务。
- `SALES`：只能查看和处理自己的任务，只能给自己负责的客户创建任务，不能访问任务模板管理页。
- 所有任务、模板、提醒队列查询和写入继续基于 `tenantId` 过滤；middleware、页面权限和 Server Actions 权限校验均保留。

### V1.3.1 E2E 测试

新增测试文件：

```text
tests/v131-task-template-reminder-e2e.spec.ts
```

覆盖企业管理员创建模板、运营创建模板、销售禁止访问模板管理页、客户详情使用模板创建任务、重复创建同类同日任务去重、销售创建自己客户任务、销售跨租户访问被拒绝、取消任务后取消提醒队列，以及关键动作进入 AuditLog。

建议使用以下命令单独执行，并在执行前重置数据库与 seed：

```bash
npx playwright test tests/v131-task-template-reminder-e2e.spec.ts --workers=1 --reporter=list
```

## V1.4 整木行业演示样板数据

V1.4 不新增复杂技术功能，重点把 `zhengmu-demo` 打造成一套可直接演示的整木行业样板企业数据包。

- seed 后默认生成 16 条以上整木行业样板线索，覆盖业主客户、经销商客户、设计师客户、工厂客户。
- 四类客户各自拥有对应的转化策略、资料包、任务模板、跟进记录和任务。
- dashboard、客户列表、客户详情、销售工作台都可以直接看到可演示的数据分布。
- 客户详情页增加“当前任务”展示，便于演示任务闭环。

### V1.4 演示数据验证

脚本验证会在 `custom\experiments\verify-v11-e2e.ts` 中检查：

- `zhengmu-demo` 存在；
- 四类客户策略、资料包、任务模板存在；
- 样板线索至少 16 条；
- 四类客户都有 FollowUp 和 FollowTask；
- sales 账号存在待办任务；
- 看板统计和客户详情演示关键数据存在。

如需执行浏览器端演示专项验证，可单独运行：

```bash
npx playwright test tests/v14-demo-dataset-e2e.spec.ts --workers=1 --reporter=list
```

## V1.7 业务线／产品管理

V1.7 新增租户级“业务线／产品管理”，入口为：

- `/app/[tenantSlug]/business-lines`

定位说明：

- 它用于管理企业当前对外推广、销售和服务的业务线、产品或项目。
- 它不等于计费产品，不是电商商品，也不是公开 SaaS 套餐。
- 它更像企业内部的业务机会和产品方向管理入口。

权限边界：

- `TENANT_ADMIN`：可新增、编辑、启用、暂停、归档本租户业务线。
- `OPERATOR`：可新增、编辑、启用、暂停本租户业务线，不提供归档入口。
- `SALES`：只能查看启用中的业务线，不可编辑。
- `PLATFORM_ADMIN`：本轮不直接管理租户业务线。

和现有模块的关系：

- 业务线可关联资料包，用于在客户详情页和智能跟进助手里优先推荐相关资料。
- 业务线可关联任务模板，用于统一沉淀后续销售动作。
- 业务线可配置推荐标签，这些标签会进入“智能标签建议”的优先来源之一。
- 当客户问题命中某条启用业务线时，系统会优先读取该业务线的推荐标签、绑定资料包和默认下一步动作。
- 如果没有命中启用业务线，仍保留原有规则型智能跟进助手和智能标签建议作为兜底。

## V1.7.1 角色化导航与权限收口

V1.7.1 不是新增复杂业务功能，而是在 V1.7 基础上继续收口后台菜单和高风险入口，让不同角色进入系统后只看到自己该用的页面。

角色菜单说明：

- `PLATFORM_ADMIN`：看到平台级入口，例如租户管理、平台审计日志，以及按需进入租户 `demo-guide` 的演示说明入口。
- `TENANT_ADMIN`：看到 `Dashboard`、客户列表、业务线／产品、销售工作台、资料包、策略库、任务模板、审计日志、演示说明、客户导出、企业微信配置。
- `OPERATOR`：看到 `Dashboard`、客户列表、业务线／产品、销售工作台、资料包、策略库、任务模板、演示说明。
- `SALES`：只看到 `Dashboard`、我的客户、销售工作台、客户详情和演示说明，不显示全局业务资产入口。

高风险入口收口：

- 销售不显示也不能直接访问租户审计日志、客户导出、企业微信配置、资料包编辑、策略库编辑、任务模板编辑。
- 运营默认不显示审计日志、客户导出和企业微信敏感配置入口。
- 租户审计日志只开放给 `TENANT_ADMIN`。
- 平台审计日志只开放给 `PLATFORM_ADMIN`。
- 企业微信配置页只开放给 `TENANT_ADMIN`，且不回显 secret、token、EncodingAESKey 的历史明文。

业务线权限补充：

- `TENANT_ADMIN`：可新增、编辑、启用、暂停、归档。
- `OPERATOR`：可新增、编辑、启用、暂停，但不能归档。
- `SALES`：只读查看 `ACTIVE` 业务线，不显示新增、编辑、暂停、归档入口。
- 业务线不提供物理删除，只做 `ACTIVE`、`PAUSED`、`ARCHIVED` 状态流转。

## V1.8 客户导入

V1.8 的目标不是接企业微信，也不是做自动消息，而是让 `zhengmu-platform` 和其它租户开始把真实客户逐步导入系统，进入真实自用准备阶段。

入口：

- `/app/[tenantSlug]/imports`

定位说明：

- 客户导入用于把已有客户、活动名单、表单线索或历史客户批量导入系统。
- 导入后客户会进入现有的客户列表、标签、业务线、任务和审计闭环。
- 导入不接企业微信 API。
- 导入不会自动发送消息。
- 导入不会自动回复客户。

权限边界：

- `TENANT_ADMIN`：可上传、预览、确认导入、设置默认负责人/标签/业务线、查看导入记录。
- `OPERATOR`：与企业管理员相同，可执行导入。
- `SALES`：不显示客户导入入口，直接访问会被拒绝。
- `PLATFORM_ADMIN`：本轮不扩大租户导入权限。

当前支持字段：

- 客户姓名
- 手机号
- 微信号
- 公司名称
- 客户类型
- 来源渠道
- 需求说明
- 意向等级
- 当前阶段
- 备注
- 业务线
- 标签
- 负责人邮箱
- 下次跟进时间

重复客户识别规则：

1. 同租户内优先按手机号判断重复。
2. 手机号不命中时按微信号判断重复。
3. 当手机号和微信号都为空时，再按“客户姓名 + 公司名称”判断。
4. 当前版本默认跳过重复客户，不覆盖已有客户。

导入处理说明：

- 字段支持预览后再调整映射。
- 可设置默认负责人。
- 可设置默认标签。
- 可设置默认业务线。
- 导入业务线时会校验该业务线是否属于当前租户且为 `ACTIVE`。
- 导入成功后，通用标签写入 `LeadTag`，分组为 `IMPORTED`。
- 业务线写入 `LeadTag`，分组为 `BUSINESS_LINE`。
- 同名同组标签不会重复添加。

首次跟进任务：

- 可选“导入后自动生成首次跟进任务”。
- 仅对已分配负责人的客户生成任务。
- 高意向和强意向客户会提升任务优先级。

导入记录与审计：

- 每次导入会生成 `ImportBatch` 和 `ImportRow` 记录。
- 审计日志会记录：
  - `import_batch_created`
  - `import_batch_completed`
  - `import_batch_failed`

这套能力优先服务 `zhengmu-platform` 从样板数据走向真实客户导入和自用准备，但实现方式对所有租户通用。

## V1.8.1 权限矩阵说明页

V1.8.1 不新增复杂角色体系，而是把现有角色、权限、管理边界和使用边界页面化、文档化，方便整木网自用，也方便后续对客户交付时解释为什么不同角色看到不同菜单、能做不同操作。

页面入口：
- `/app/[tenantSlug]/permissions`

访问权限：
- `TENANT_ADMIN`：可访问
- `OPERATOR`：可只读访问
- `SALES`：不显示导航入口，直接访问会被拒绝
- `PLATFORM_ADMIN`：本轮不扩大租户业务权限

页面用途：
- 说明当前系统里不同角色能看什么、能做什么、不能做什么
- 解释为什么销售看不到某些菜单
- 解释为什么企业微信配置不对普通角色开放
- 解释为什么业务线／产品不提供物理删除

当前系统角色边界：
- `PLATFORM_ADMIN`：负责租户、系统配置、安全、平台级审计和运维
- `TENANT_ADMIN`：负责看全局、定方向、管结果
- `OPERATOR`：负责维护业务资产、内容承接和活动承接
- `SALES`：负责日常客户跟进、任务推进、建议回复和标签确认
- `VIEWER`：当前只作为未来扩展规划说明，不在本轮落库实现

关键边界说明：
- 业务线不做物理删除，只做启用、暂停、归档，避免客户、标签、资料包、任务模板、跟进记录和审计历史断层
- 企业微信配置属于高风险入口，原则是可配置但不明文展示密钥，可看状态但不泄露 secret、token 和 EncodingAESKey
- 审计日志是管理和风控工具，不是销售工具
- 客户导出是敏感动作，建议仅开放给企业管理员，并继续写入审计日志

## V1.9.1 沟通素材合规采集配置中心

V1.9.1 新增租户后台入口：

- `/app/[tenantSlug]/communication-compliance`

该页面不是去接真实企业微信会话存档、电话录音或 ASR，而是先把“是否允许未来自动采集沟通素材”这件事变成企业管理员可配置、可审计、可解释的合规中心。

核心边界：

- 自动采集是企业可选项，不是系统默认项。
- 系统不会默认自动采集。
- 系统不会偷偷读取企业微信聊天。
- 系统不会偷偷读取电话录音。
- 系统不会自动发送客户消息。
- 企业微信会话存档、电话录音、ASR 都先作为未来 provider 占位，不接真实接口。

收费与开通说明：

- 该能力是单独收费功能。
- 企业必须先提交开通申请，才能把通道状态设置为“申请中”或“已启用”。
- 即使申请通过，也必须先完成企业确认、员工告知、客户提示和采集范围设置，才允许真正启用。

当前支持三类通道配置：

- 企业微信会话存档采集
- 电话录音采集
- 语音转文字服务

访问权限：

- `TENANT_ADMIN`：可访问并配置
- `OPERATOR`：可访问但只读查看
- `SALES`：不显示入口，直接访问会被拒绝
- `PLATFORM_ADMIN`：本轮不扩大租户业务权限

AI 使用边界：

- 可配置是否允许 AI 生成摘要、标签建议、任务建议、回复建议。
- 当前版本不支持自动发送客户消息，相关开关始终关闭，只作为未来字段占位。

审计动作：

- `communication_compliance_config_created`
- `communication_compliance_config_updated`
- `communication_compliance_config_enabled`
- `communication_compliance_config_paused`

## V1.9.2 客户来源归因细化

V1.9.2 在现有线索体系上补齐“客户到底从哪里来”的细粒度记录能力，不再只停留在“抖音、小红书、会议、公众号”这类大渠道。

当前归因结构支持记录：

- 来源渠道
- 来源项目
- 来源活动
- 来源场景
- 来源触点
- 来源二维码
- 来源人员
- 来源页面
- 来源内容
- `utm_source`
- `utm_medium`
- `utm_campaign`
- `utm_content`
- `utm_term`

当前落地范围：

- CNAS 公开问卷 `/forms/cnas-path-check` 会从 URL query 和隐藏字段读取来源归因参数。
- 客户导入模板新增来源项目、活动、场景、触点、二维码、人员、页面、内容和 UTM 字段。
- 客户详情页新增“来源归因”卡片，方便顾问和管理层回看客户首来源。
- 客户列表支持按来源项目、来源活动、来源场景做基础筛选。
- 审计日志新增 `lead_source_attribution_created` 和 `lead_source_attribution_updated`。

设计边界：

- 当前只做归因记录、展示和基础筛选，不做完整 BI 报表。
- 当前只保留单条首来源记录，不做多触点归因模型。
- 不接企业微信 API。
- 不生成真实企业微信二维码。
- 不接投放平台 API。
