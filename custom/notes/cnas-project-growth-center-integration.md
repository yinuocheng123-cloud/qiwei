# 版本记录：cnas-project-growth-center-integration

## 1. 本轮目标

本轮目标是在现有《企业微信业务增长中台》里接入“CNAS认可指南”业务项目，而不是单独新开一套 CNAS 系统。

优先级最高的事项有三类：

1. 复用现有线索、任务、业务线、标签和审计链路；
2. 新增公开问卷入口，完成 A / B / C 初步诊断闭环；
3. 让 `zhengmu-platform` 能直接承接 CNAS 线索并分配给顾问继续跟进。

## 2. 背景与上下文

本轮承接的历史上下文主要有：

1. `custom/notes/v1.8-real-customer-import.md`
2. `custom/notes/v1.7.1-role-based-navigation-permissions.md`
3. `custom/notes/v1.7-business-line-product-management.md`

其中最关键的继承点有：

1. V1.7 已经具备 `BusinessLine` 统一管理能力；
2. V1.7.1 已经把租户侧权限和入口收口完成；
3. V1.8 已经把 `zhengmu-platform` 打造成整木网自用租户，适合作为新业务项目的承接租户。

因此本轮不应该重做中台，只需要把 CNAS 当作现有业务项目接进去。

## 3. 问题分析

接入 CNAS 项目时的核心矛盾不是“页面有没有”，而是“如何在不破坏现有中台结构的前提下，把一条公开问卷链路沉淀成可跟进的业务线索”。

主要问题有：

1. 现有公开表单链路能创建 `Lead` 和 `IntakeForm`，但缺少保存复杂项目问卷字段的通用扩展结构；
2. CNAS 需要 A / B / C 初步诊断、结构化标签和 UTM 记录，不能只把内容塞进 `message`；
3. 顾问后续跟进需要看到诊断结果、任务和来源，而不是只得到一条原始线索。

## 4. 候选方案比较

### 方案 A：为 CNAS 单独建模型和独立后台

优点：

1. 结构最“纯粹”；
2. 问卷字段和诊断字段可以完全定制。

缺点：

1. 明显违背“不要重新开发独立中台”的要求；
2. 会把线索、任务、标签、审计和租户权限重复建设一遍；
3. 后续维护成本高，和现有增长中台割裂。

放弃原因：

与本轮边界冲突，且会破坏项目当前持续迭代方向。

### 方案 B：完全复用现有公开表单，只把问卷文本塞进 message

优点：

1. 改动最少；
2. 不需要改 schema。

缺点：

1. 问卷字段不可结构化读取；
2. UTM、诊断类型、风险点和阶段都难以稳定复用；
3. 顾问详情页和后续筛选价值很弱。

放弃原因：

虽然成本低，但无法形成“路径判断问卷 → 诊断 → 标签 → 跟进”的闭环。

### 方案 C：新增通用 `extraData`，复用现有 Lead / IntakeForm / BusinessLine / Task

优点：

1. 只做一层通用扩展，不为 CNAS 造专属底层模型；
2. 问卷字段、UTM、诊断结果都能结构化存储；
3. 可以继续复用现有租户隔离、任务、资料包、审计和客户详情页。

缺点：

1. 需要补一轮 schema 和 migration；
2. 需要手工维护 CNAS 问卷规则和展示逻辑。

最终选择：

采用方案 C。这是本轮“最小可用、可复用、可继续扩展”的平衡点。

## 5. 最终决策

最终实现思路如下：

1. 在 `Lead` 和 `IntakeForm` 增加通用 `extraData` 字段；
2. 在 `FormType` 增加 `cnas_path_check`；
3. 新增公开问卷入口 `/forms/cnas-path-check`；
4. 用独立的 CNAS 规则工具负责：
   - 问卷选项
   - A / B / C 诊断
   - 意向等级判断
   - 来源映射
   - 结构化标签映射
5. 表单提交后继续写入现有：
   - `Lead`
   - `IntakeForm`
   - `LeadTag`
   - `FollowTask`
   - `AuditLog`
6. CNAS 项目先挂在 `zhengmu-platform` 下，作为平台业务线的一部分。

## 6. 具体实现

本轮主要改动如下。

### 数据结构

1. `prisma/schema.prisma`
   - 为 `Lead` 新增 `extraData`
   - 为 `IntakeForm` 新增 `extraData`
   - 为 `FormType` 新增 `cnas_path_check`

2. `prisma/migrations/20260515020000_add_cnas_form_metadata_and_public_flow/migration.sql`
   - 同步落地上述结构变更

### CNAS 规则与动作

1. `src/lib/cnas.ts`
   - 维护问卷字段选项
   - 维护 A / B / C 诊断规则
   - 维护高 / 中 / 低意向映射
   - 维护结构化标签映射
   - 维护 UTM 来源归类
   - 维护结果页展示文案

2. `src/lib/actions.ts`
   - 新增 `submitCnasPathCheckForm`
   - 表单提交后：
     - 创建或更新 `Lead`
     - 创建 `IntakeForm`
     - 写入项目标签、实验室类型标签、阶段标签、风险标签、意向标签、来源标签
     - 生成 CNAS 跟进任务
     - 写入 CNAS 审计记录

### 页面与展示

1. `src/app/forms/cnas-path-check/page.tsx`
   - 新增公开问卷入口

2. `src/app/forms/cnas-path-check/result/page.tsx`
   - 新增公开结果页，展示 A / B / C 初步判断

3. `src/app/app/[tenantSlug]/leads/[id]/page.tsx`
   - 对存在 CNAS 扩展数据的客户显示“CNAS 初步判断”卡片
   - 展示实验室类型、当前阶段、来源页面和 UTM 等关键字段

4. `src/app/app/[tenantSlug]/audit-logs/page.tsx`
5. `src/app/admin/audit-logs/page.tsx`
   - 补充 CNAS 审计动作选项与 `IntakeForm` 对象类型

### Seed 配置

1. `prisma/seed.ts`
   - 为 `zhengmu-platform` 新增 `CNAS认可指南` 业务线
   - 新增 CNAS 资料包
   - 新增 CNAS 企业微信欢迎语模板资料
   - 新增三类 CNAS 跟进任务模板

### 文档与测试

1. `README.md`
   - 补充 CNAS 项目接入说明和公开问卷入口

2. `tests/cnas-project-growth-center-e2e.spec.ts`
   - 覆盖公开问卷、A / B / C 诊断、后台承接、UTM 可见性和审计链路

3. `AGENTS.md`
   - 最新一期路径更新到本记录

## 7. 本轮优点

1. 没有新开系统，完全符合“CNAS 只是现有增长中台中的一个业务项目”这一定位；
2. `extraData` 是通用扩展能力，后续别的项目问卷也可以复用；
3. 问卷、诊断、标签、任务和审计形成了闭环；
4. 租户隔离、角色权限和现有工作台能力都得到了继承；
5. `zhengmu-platform` 可以直接把 CNAS 作为真实业务方向继续使用。

## 8. 本轮缺点与代价

1. 目前公开问卷默认接入 `zhengmu-platform`，还没有做更通用的项目路由配置；
2. 当前项目筛选仍主要依赖业务线标签和扩展数据，尚未增加专门的 CNAS 列表筛选器；
3. CNAS 欢迎语模板先作为资料项存在，还不是完整的消息模版中心；
4. 任务生成先按固定诊断规则执行，还没有更复杂的协作流转；
5. 本轮 E2E 最后的不稳定点不在业务规则，而在本地临时 PostgreSQL 常驻方式和 Playwright `webServer` 自动拉起链路叠加后，偶发造成登录跳转阶段数据库连接中断。

## 9. 验证与结果

计划验证项包括：

1. `npm run prisma:generate`
2. `npx tsc --noEmit`
3. `npm run lint`
4. `npm run build`
5. `powershell.exe -ExecutionPolicy Bypass -File custom\experiments\run-v11-postgres-check.ps1`
6. `npx.cmd playwright test tests/cnas-project-growth-center-e2e.spec.ts --workers=1 --reporter=list`

本轮实际验证结果分两段：

1. CNAS 功能实现完成后，以下命令已通过：
   - `npm run prisma:generate`
   - `npx tsc --noEmit`
   - `npm run lint`
   - `npm run build`
   - `powershell.exe -ExecutionPolicy Bypass -File custom\experiments\run-v11-postgres-check.ps1`

2. CNAS E2E 稳定化收口时，额外完成：
   - 先检查并清理残留 dev server / PostgreSQL / Playwright 进程占用；
   - 采用独立 PostgreSQL 启动、手工 migrate、手工 seed、单独启动 dev server、health check `/login` 后再执行 Playwright；
   - 通过 `PLAYWRIGHT_SKIP_WEBSERVER=1` 避免 Playwright 重复拉起服务；
   - 重跑 `npx.cmd tsc --noEmit`、`npm.cmd run lint`、`npm.cmd run build`，均通过；
   - 重跑 `npx.cmd playwright test tests/cnas-project-growth-center-e2e.spec.ts --workers=1 --reporter=list`，最终 `3 passed`。

本轮测试收口中没有发现新的真实业务规则缺陷，主要修复点是测试环境启动顺序和登录跳转链路的稳定性。

## 10. 本轮结论

本轮最重要的结论是：

在现有中台已经具备 `BusinessLine + Lead + Tag + Task + AuditLog` 这些基础能力后，新增专业服务项目并不需要另起炉灶，只要补一层通用扩展数据和一条公开表单入口，就可以快速接入新的业务闭环。

对后续迭代最值得继承的经验有：

1. 项目级问卷优先走 `extraData`，不要轻易做专属底层模型；
2. 诊断类业务优先复用现有任务和审计链路；
3. 项目隔离优先靠业务线、标签和来源字段，而不是新建子系统；
4. CNAS E2E 若继续依赖本地临时数据库，必须把数据库和 dev server 生命周期从 Playwright `webServer` 中解耦，否则登录重定向阶段容易放大偶发连接中断；
5. 本轮属于“测试环境稳定化 + 少量测试链路修正”，不是新增业务功能，也没有改动 A / B / C 诊断规则本身。

## 11. 下一轮建议

1. 给客户列表和仪表盘补充按业务线或项目标签的快捷筛选，这是收益最高的一步；
2. 如果 CNAS 后续线索增多，可以把问卷结果卡片进一步扩展为“项目画像”面板；
3. 如果后续继续补 CNAS 自动化验证，建议把“稳定数据库启动 + `/login` health check + `PLAYWRIGHT_SKIP_WEBSERVER=1`”沉淀为可复用测试脚本；
4. 待真实使用验证后，再考虑是否需要接企业微信 API 做更深的承接和提醒。
