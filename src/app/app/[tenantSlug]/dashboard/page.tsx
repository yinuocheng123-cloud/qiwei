/*
 * 文件说明：该页面实现企业工作台首页。
 * 功能说明：按老板、运营、销售三类角色展示不同入口，降低后台感并突出每日动作。
 *
 * 结构概览：
 *   第一部分：导入依赖与轻量展示组件
 *   第二部分：工作台数据读取
 *   第三部分：按角色渲染客户增长助手首页
 */
import Link from "next/link";
import type { Prisma, UserRole } from "@prisma/client";
import { PageShell } from "@/components/Shell";
import { Card, StatCard } from "@/components/Ui";
import { requireTenantAccess } from "@/lib/auth";
import { todoWhere } from "@/lib/dashboard";
import { formatDate, labelOf, stageOptions } from "@/lib/options";
import { prisma } from "@/lib/prisma";
import { appendScopeToHref, resolveBusinessLineScope } from "@/lib/scope";
import { taskWhere } from "@/lib/tasks";

export const dynamic = "force-dynamic";

type LeadItem = Prisma.LeadGetPayload<{ include: { owner: true } }>;
type TaskItem = Prisma.FollowTaskGetPayload<{ include: { lead: true; owner: true } }>;
type DraftItem = Prisma.MarketClawReplyDraftGetPayload<{ include: { lead: true } }>;
type FollowUpItem = Prisma.FollowUpGetPayload<{ include: { lead: true; user: true } }>;

function WorkSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <h2 className="text-base font-semibold text-slate-950">{title}</h2>
      <div className="mt-4 space-y-3">{children}</div>
    </Card>
  );
}

function EmptyLine({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-slate-500">{children}</p>;
}

async function safeDashboardRead<T>(read: () => Promise<T>, fallback: T): Promise<{ data: T; unavailable: boolean }> {
  try {
    return { data: await read(), unavailable: false };
  } catch {
    return { data: fallback, unavailable: true };
  }
}

function dashboardCopy(role: UserRole) {
  if (role === "SALES") {
    return {
      title: "今日跟进",
      description: "先看今天要跟谁、怎么跟、发什么资料、下一步做什么。",
      heroTitle: "今天先把客户跟起来",
      heroText: "按客户卡片处理：看客户状态，参考话术和资料，保存沟通记录，再确认下一步动作。"
    };
  }

  if (role === "TENANT_ADMIN") {
    return {
      title: "客户经营驾驶舱",
      description: "一眼看清客户有没有人跟、谁在认真跟、哪些客户快成交或快流失。",
      heroTitle: "老板只看经营进度",
      heroText: "这里不铺复杂配置，优先呈现新增客户、跟进动作、重点客户和超时风险。"
    };
  }

  return {
    title: "销售弹药库",
    description: "维护资料、案例、话术和常见问题，让销售知道该发什么、该怎么说。",
    heroTitle: "运营把销售弹药准备好",
    heroText: "优先补齐客户最常问的问题、成交案例、资料包和可复用话术。"
  };
}

function LeadRow({ lead, href }: { lead: LeadItem; href: string }) {
  return (
    <Link className="block rounded-md border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50" href={href}>
      <div className="flex items-center justify-between gap-3">
        <span className="font-medium text-slate-950">{lead.name}</span>
        <span className="text-xs text-slate-500">{formatDate(lead.nextFollowAt)}</span>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        {labelOf(stageOptions, lead.stage)} / 负责人：{lead.owner?.name ?? "未分配"}
      </p>
    </Link>
  );
}

function TaskRow({ task, href }: { task: TaskItem; href: string }) {
  return (
    <Link className="block rounded-md border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50" href={href}>
      <div className="flex items-center justify-between gap-3">
        <span className="font-medium text-slate-950">{task.lead?.name ?? task.title}</span>
        <span className="text-xs text-slate-500">{formatDate(task.dueAt)}</span>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        {task.title} / 负责人：{task.owner?.name ?? "未分配"}
      </p>
    </Link>
  );
}

function salesNextAction(task: TaskItem) {
  if (task.description) return task.description;
  return task.title || "先确认客户当前需求，再约定下一次沟通时间。";
}

function salesRecommendedScript(task: TaskItem) {
  if (task.lead?.stage === "NEW") return "您好，我先把您关心的资料整理给您，再确认一下当前最想解决的问题。";
  if (task.lead?.stage === "CONTACTED") return "上次沟通后我补充了一份案例，您可以先看关键页，我们再约时间细聊。";
  if (task.lead?.stage === "QUOTED") return "报价里的范围和交付步骤我再帮您拆一下，方便您内部判断。";
  return "我先按您的需求补一份资料，今天和您确认下一步安排。";
}

function salesRecommendedMaterial(task: TaskItem) {
  if (task.lead?.stage === "QUOTED") return "报价说明";
  if (task.lead?.stage === "CONTACTED") return "成功案例";
  if (task.lead?.stage === "NEW") return "公司介绍";
  return "产品资料";
}

function SalesFollowupCard({ task, href, urgent = false }: { task: TaskItem; href: string; urgent?: boolean }) {
  return (
    <Card className={urgent ? "border-red-200 bg-red-50" : "h-full"}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-slate-500">{urgent ? "超时未跟进" : "今日要跟进"}</p>
          <h2 className="mt-1 text-base font-semibold text-slate-950">{task.lead?.name ?? task.title}</h2>
        </div>
        <span className={urgent ? "text-xs font-medium text-red-700" : "text-xs text-slate-500"}>{formatDate(task.dueAt)}</span>
      </div>
      <div className="mt-4 grid gap-3 text-sm text-slate-600">
        <p>
          <span className="font-medium text-slate-900">客户阶段：</span>
          {task.lead ? labelOf(stageOptions, task.lead.stage) : "未绑定客户"}
        </p>
        <p>
          <span className="font-medium text-slate-900">上次跟进：</span>
          {formatDate(task.lead?.lastFollowAt)}
        </p>
        <p>
          <span className="font-medium text-slate-900">下一步动作：</span>
          {salesNextAction(task)}
        </p>
        <p>
          <span className="font-medium text-slate-900">推荐话术：</span>
          {salesRecommendedScript(task)}
        </p>
        <p>
          <span className="font-medium text-slate-900">推荐资料：</span>
          {salesRecommendedMaterial(task)}
        </p>
      </div>
      <Link className="mt-4 inline-flex rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white" href={href}>
        去跟进
      </Link>
    </Card>
  );
}

function DraftRow({ draft, href }: { draft: DraftItem; href: string }) {
  return (
    <Link className="block rounded-md border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50" href={href}>
      <div className="flex items-center justify-between gap-3">
        <span className="font-medium text-slate-950">{draft.lead.name}</span>
        <span className="text-xs text-slate-500">{draft.replyRiskLevel}</span>
      </div>
      <p className="mt-1 line-clamp-2 text-xs text-slate-500">建议动作：参考话术后人工确认再发送。</p>
    </Link>
  );
}

function FollowUpRow({ item, href }: { item: FollowUpItem; href: string }) {
  return (
    <Link className="block rounded-md border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50" href={href}>
      <div className="flex items-center justify-between gap-3">
        <span className="font-medium text-slate-950">{item.lead.name}</span>
        <span className="text-xs text-slate-500">{formatDate(item.createdAt)}</span>
      </div>
      <p className="mt-1 line-clamp-2 text-xs text-slate-500">{item.user.name}：{item.content}</p>
    </Link>
  );
}

export default async function DashboardPage({
  params,
  searchParams
}: {
  params: { tenantSlug: string };
  searchParams?: Record<string, string | undefined>;
}) {
  const { user, tenant } = await requireTenantAccess(params.tenantSlug, ["TENANT_ADMIN", "OPERATOR", "SALES"]);
  const scope = await resolveBusinessLineScope(tenant.id, searchParams);
  const base = `/app/${tenant.slug}`;
  const withScope = (href: string) => appendScopeToHref(href, scope);
  const leadHref = (leadId: string) => withScope(`${base}/leads/${leadId}`);
  const ownerId = user.role === "SALES" ? user.id : undefined;
  const leadRules = todoWhere(tenant.id, ownerId, scope.businessLineId ?? undefined);
  const taskRules = taskWhere(tenant.id, ownerId, scope.businessLineId ?? undefined);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);

  const [
    todayTasksResult,
    newLeadsResult,
    overdueTasksResult,
    highRiskDraftsResult,
    todayDraftsResult,
    doneFollowUpsResult,
    todayFollowCountResult,
    newLeadCountResult,
    overdueTaskCountResult,
    doneFollowUpCountResult,
    todayCopilotAdoptionsResult,
    todayCopilotTasksResult,
    recentCopilotLeadCountResult
  ] = await Promise.all([
    safeDashboardRead<TaskItem[]>(() => prisma.followTask.findMany({ where: taskRules.today, include: { lead: true, owner: true }, orderBy: { dueAt: "asc" }, take: 6 }), []),
    safeDashboardRead<LeadItem[]>(() => prisma.lead.findMany({ where: { ...leadRules.recent, createdAt: { gte: todayStart } }, include: { owner: true }, orderBy: { createdAt: "desc" }, take: 6 }), []),
    safeDashboardRead<TaskItem[]>(() => prisma.followTask.findMany({ where: taskRules.overdue, include: { lead: true, owner: true }, orderBy: { dueAt: "asc" }, take: 6 }), []),
    safeDashboardRead<DraftItem[]>(
      () =>
        prisma.marketClawReplyDraft.findMany({
          where: {
            tenantId: tenant.id,
            ...(scope.businessLineId ? { businessLineId: scope.businessLineId } : {}),
            ...(ownerId ? { createdById: ownerId } : {}),
            replyRiskLevel: { in: ["HIGH", "BLOCKED"] }
          },
          include: { lead: true },
          orderBy: { createdAt: "desc" },
          take: 6
        }),
      []
    ),
    safeDashboardRead<DraftItem[]>(
      () =>
        prisma.marketClawReplyDraft.findMany({
          where: {
            tenantId: tenant.id,
            ...(scope.businessLineId ? { businessLineId: scope.businessLineId } : {}),
            ...(ownerId ? { createdById: ownerId } : {}),
            createdAt: { gte: todayStart, lt: tomorrowStart }
          },
          include: { lead: true },
          orderBy: { createdAt: "desc" },
          take: 6
        }),
      []
    ),
    safeDashboardRead<FollowUpItem[]>(
      () =>
        prisma.followUp.findMany({
          where: {
            tenantId: tenant.id,
            ...(scope.businessLineId ? { businessLineId: scope.businessLineId } : {}),
            ...(ownerId ? { userId: ownerId } : {}),
            createdAt: { gte: todayStart, lt: tomorrowStart }
          },
          include: { lead: true, user: true },
          orderBy: { createdAt: "desc" },
          take: 6
        }),
      []
    ),
    safeDashboardRead<number>(() => prisma.followTask.count({ where: taskRules.today }), 0),
    safeDashboardRead<number>(() => prisma.lead.count({ where: { ...leadRules.recent, createdAt: { gte: todayStart } } }), 0),
    safeDashboardRead<number>(() => prisma.followTask.count({ where: taskRules.overdue }), 0),
    safeDashboardRead<number>(
      () =>
        prisma.followUp.count({
          where: {
            tenantId: tenant.id,
            ...(scope.businessLineId ? { businessLineId: scope.businessLineId } : {}),
            ...(ownerId ? { userId: ownerId } : {}),
            createdAt: { gte: todayStart, lt: tomorrowStart }
          }
        }),
      0
    ),
    safeDashboardRead<number>(
      () =>
        prisma.auditLog.count({
          where: {
            tenantId: tenant.id,
            action: { in: ["reply_suggestion_saved_as_followup", "reply_suggestion_adopted_with_task"] },
            createdAt: { gte: todayStart, lt: tomorrowStart },
            AND: [
              { metadata: { path: ["source"], equals: "copilot" } },
              ...(scope.businessLineId ? [{ metadata: { path: ["businessLineId"], equals: scope.businessLineId } }] : [])
            ]
          }
        }),
      0
    ),
    safeDashboardRead<number>(
      () =>
        prisma.auditLog.count({
          where: {
            tenantId: tenant.id,
            action: "copilot_task_created",
            createdAt: { gte: todayStart, lt: tomorrowStart },
            AND: [
              { metadata: { path: ["source"], equals: "copilot" } },
              ...(scope.businessLineId ? [{ metadata: { path: ["businessLineId"], equals: scope.businessLineId } }] : [])
            ]
          }
        }),
      0
    ),
    safeDashboardRead<number>(
      async () => {
        const rows = await prisma.auditLog.findMany({
          where: {
            tenantId: tenant.id,
            action: { in: ["reply_suggestion_saved_as_followup", "reply_suggestion_adopted_with_task", "copilot_task_created"] },
            createdAt: { gte: todayStart },
            AND: [
              { metadata: { path: ["source"], equals: "copilot" } },
              ...(scope.businessLineId ? [{ metadata: { path: ["businessLineId"], equals: scope.businessLineId } }] : [])
            ]
          },
          select: { metadata: true }
        });
        return new Set(
          rows
            .map((row) => (row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata) ? (row.metadata as Record<string, unknown>).leadId : null))
            .filter((leadId): leadId is string => typeof leadId === "string")
        ).size;
      },
      0
    )
  ]);

  const copy = dashboardCopy(user.role);
  const todayTasks = todayTasksResult.data;
  const newLeads = newLeadsResult.data;
  const overdueTasks = overdueTasksResult.data;
  const highRiskDrafts = highRiskDraftsResult.data;
  const todayDrafts = todayDraftsResult.data;
  const doneFollowUps = doneFollowUpsResult.data;
  const todayFollowCount = todayFollowCountResult.data;
  const newLeadCount = newLeadCountResult.data;
  const overdueTaskCount = overdueTaskCountResult.data;
  const doneFollowUpCount = doneFollowUpCountResult.data;
  const todayCopilotAdoptions = todayCopilotAdoptionsResult.data;
  const todayCopilotTasks = todayCopilotTasksResult.data;
  const recentCopilotLeadCount = recentCopilotLeadCountResult.data;
  const dashboardDataUnavailable = [
    todayTasksResult,
    newLeadsResult,
    overdueTasksResult,
    highRiskDraftsResult,
    todayDraftsResult,
    doneFollowUpsResult,
    todayFollowCountResult,
    newLeadCountResult,
    overdueTaskCountResult,
    doneFollowUpCountResult,
    todayCopilotAdoptionsResult,
    todayCopilotTasksResult,
    recentCopilotLeadCountResult
  ].some((result) => result.unavailable);
  const wecomConfigResult = await safeDashboardRead(() => prisma.weComConfig.findUnique({ where: { tenantId: tenant.id } }), null);
  const shouldShowWecomWorkbenchHint =
    user.role !== "SALES" && (!wecomConfigResult.data?.corpId || !wecomConfigResult.data?.agentId);
  const metricLabels =
    scope.businessLineKey === "cnas"
      ? {
          today: "今日新增咨询",
          newLead: "待初步判断",
          overdue: "逾期未跟进",
          priority: "高意向认可客户",
          material: "待出诊断建议"
        }
      : scope.businessLineKey === "youxi"
        ? {
            today: "今日新增咨询",
            newLead: "已发资料",
            overdue: "超过7天沉默客户",
            priority: "待进群客户",
            material: "设计协同客户"
          }
        : {
            today: "今日新增客户",
            newLead: "高意向客户",
            overdue: "逾期未跟进",
            priority: "无下一步客户",
            material: "深度沟通客户"
          };

  return (
    <PageShell
      tenant={tenant}
      title={`${copy.title} · ${scope.enterpriseDefinition.name} / ${scope.businessLineDefinition.name}`}
      description={`${copy.description} 当前范围：${scope.enterpriseDefinition.name} / ${scope.businessLineDefinition.name}。`}
      enterpriseKey={scope.enterpriseKey}
      businessLineKey={scope.businessLineKey}
    >
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard label={metricLabels.today} value={user.role === "TENANT_ADMIN" ? newLeadCount : todayFollowCount} />
        <StatCard label={metricLabels.newLead} value={user.role === "TENANT_ADMIN" ? todayFollowCount : newLeadCount} />
        <StatCard label={metricLabels.overdue} value={overdueTaskCount} />
        <StatCard label={metricLabels.priority} value={highRiskDrafts.length} />
        <StatCard label={metricLabels.material} value={todayDrafts.length} />
      </section>

      {user.role === "TENANT_ADMIN" ? (
        <section className="mt-4 grid gap-4 md:grid-cols-3">
          <StatCard label="今日智能建议采纳" value={todayCopilotAdoptions} />
          <StatCard label="今日建议生成任务" value={todayCopilotTasks} />
          <StatCard label="近期助手推进 Lead" value={recentCopilotLeadCount} />
        </section>
      ) : null}

      {dashboardDataUnavailable ? (
        <section className="mt-4">
          <Card className="border-amber-200 bg-amber-50 text-sm text-amber-800">当前统计暂不可用，不影响客户跟进主流程。</Card>
        </section>
      ) : null}

      {shouldShowWecomWorkbenchHint ? (
        <section className="mt-4">
          <Card className="border-emerald-200 bg-emerald-50">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <p className="text-sm leading-6 text-emerald-950">
                还没有把麻虾放进企业微信工作台，配置后员工可以从企业微信直接进入客户跟进。
              </p>
              <Link className="rounded-md bg-emerald-700 px-3 py-2 text-sm font-medium text-white" href={withScope(`${base}/wecom`)}>
                去配置企业微信
              </Link>
            </div>
          </Card>
        </section>
      ) : null}

      <section className="mt-6">
        <Card className="border-emerald-200 bg-emerald-50">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">{copy.heroTitle}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-700">{copy.heroText}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link className="rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white" href={withScope(`${base}/todos?view=today#today-tasks`)}>
                今日任务
              </Link>
              <Link className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700" href={withScope(user.role === "OPERATOR" ? `${base}/materials` : `${base}/leads`)}>
                {user.role === "OPERATOR" ? "维护资料包" : "查看客户"}
              </Link>
            </div>
          </div>
        </Card>
      </section>

      {user.role === "SALES" ? (
        <section className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">今日跟进清单</h2>
              <p className="mt-1 text-sm text-slate-600">先处理今天要跟和已经超时的客户，每张卡都给出动作、话术和资料。</p>
            </div>
            <Link className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700" href={withScope(`${base}/todos`)}>
              查看全部任务
            </Link>
          </div>
          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            {todayTasks.length ? todayTasks.map((task) => <SalesFollowupCard key={task.id} task={task} href={task.lead ? leadHref(task.lead.id) : withScope(`${base}/todos`)} />) : null}
            {overdueTasks.length ? overdueTasks.map((task) => <SalesFollowupCard key={task.id} task={task} href={task.lead ? leadHref(task.lead.id) : withScope(`${base}/todos`)} urgent />) : null}
            {!todayTasks.length && !overdueTasks.length ? (
              <Card>
                <p className="text-sm text-slate-500">今天暂时没有必须跟进的客户。可以先查看新客户，补充客户信息或准备下一轮资料。</p>
                <Link className="mt-4 inline-flex rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white" href={withScope(`${base}/leads`)}>
                  查看客户跟进清单
                </Link>
              </Card>
            ) : null}
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <WorkSection title="新客户">
              {newLeads.length ? newLeads.map((lead) => <LeadRow key={lead.id} href={leadHref(lead.id)} lead={lead} />) : <EmptyLine>今天还没有新客户。</EmptyLine>}
            </WorkSection>
            <WorkSection title="推荐话术和资料">
              {todayDrafts.length ? todayDrafts.map((draft) => <DraftRow key={draft.id} href={leadHref(draft.leadId)} draft={draft} />) : <EmptyLine>进入客户详情页即可查看推荐话术和可发送资料。</EmptyLine>}
            </WorkSection>
            <WorkSection title="今日沟通记录">
              {doneFollowUps.length ? doneFollowUps.map((item) => <FollowUpRow key={item.id} href={leadHref(item.leadId)} item={item} />) : <EmptyLine>今天还没有保存沟通记录。</EmptyLine>}
            </WorkSection>
          </div>
        </section>
      ) : (
      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <WorkSection title="今日跟进动作">
          {todayTasks.length ? todayTasks.map((task) => <TaskRow key={task.id} href={task.lead ? leadHref(task.lead.id) : withScope(`${base}/todos`)} task={task} />) : <EmptyLine>今天没有待办任务。</EmptyLine>}
        </WorkSection>

        <WorkSection title="新加客户">
          {newLeads.length ? newLeads.map((lead) => <LeadRow key={lead.id} href={leadHref(lead.id)} lead={lead} />) : <EmptyLine>今天还没有新加客户。</EmptyLine>}
        </WorkSection>

        <WorkSection title={user.role === "TENANT_ADMIN" ? "超时未跟进客户" : "重点客户提醒"}>
          {overdueTasks.length ? overdueTasks.map((task) => <TaskRow key={task.id} href={task.lead ? leadHref(task.lead.id) : withScope(`${base}/todos`)} task={task} />) : null}
          {highRiskDrafts.length ? highRiskDrafts.map((draft) => <DraftRow key={draft.id} href={leadHref(draft.leadId)} draft={draft} />) : null}
          {!overdueTasks.length && !highRiskDrafts.length ? <EmptyLine>当前没有超时任务或重点提醒。</EmptyLine> : null}
        </WorkSection>

        <WorkSection title={user.role === "OPERATOR" ? "客户打开最多的资料" : "推荐话术和资料"}>
          {todayDrafts.length ? todayDrafts.map((draft) => <DraftRow key={draft.id} href={leadHref(draft.leadId)} draft={draft} />) : <EmptyLine>暂无新的智能建议。销售仍可在客户详情里查看资料和话术。</EmptyLine>}
        </WorkSection>

        <WorkSection title={user.role === "TENANT_ADMIN" ? "销售跟进记录" : "今日沟通记录"}>
          {doneFollowUps.length ? doneFollowUps.map((item) => <FollowUpRow key={item.id} href={leadHref(item.leadId)} item={item} />) : <EmptyLine>今天还没有保存沟通记录。</EmptyLine>}
        </WorkSection>

        <WorkSection title={user.role === "OPERATOR" ? "需要补充的问题" : "下一步入口"}>
          {user.role === "OPERATOR" ? (
            <>
              <EmptyLine>优先补齐客户高频问题、成交案例和朋友圈素材。</EmptyLine>
              <Link className="inline-flex rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white" href={withScope(`${base}/market-claw/knowledge`)}>
                维护常见问题
              </Link>
            </>
          ) : (
            <>
              <EmptyLine>进入客户进度，查看阶段分布和负责人。</EmptyLine>
              <Link className="inline-flex rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white" href={withScope(`${base}/leads`)}>
                进入客户池
              </Link>
            </>
          )}
        </WorkSection>
      </section>
      )}

      {user.role === "TENANT_ADMIN" ? (
        <section className="mt-6">
          <Card className="border-slate-200 bg-slate-50">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm leading-6 text-slate-600">
                低频入口：如需调整企业微信工作台入口、角色说明或沟通边界，可进入高级设置。销售端不会看到这些配置。
              </p>
              <Link className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700" href={withScope(`${base}/settings`)}>
                高级设置
              </Link>
            </div>
          </Card>
        </section>
      ) : null}
    </PageShell>
  );
}
