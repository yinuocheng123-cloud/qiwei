/*
 * 文件说明：该页面实现 V2.2 的试点销售工作台首页。
 * 功能说明：只围绕客户跟进主线展示今日待跟进、新线索、超期客户、AI 推荐回复、完成记录和快速新增客户。
 *
 * 结构概览：
 *   第一部分：导入依赖与轻量展示组件
 *   第二部分：工作台数据查询
 *   第三部分：销售试点工作台渲染
 */
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { PageShell } from "@/components/Shell";
import { Card, StatCard } from "@/components/Ui";
import { requireTenantAccess } from "@/lib/auth";
import { todoWhere } from "@/lib/dashboard";
import { formatDate, labelOf, stageOptions } from "@/lib/options";
import { prisma } from "@/lib/prisma";
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

function LeadRow({ tenantSlug, lead }: { tenantSlug: string; lead: LeadItem }) {
  return (
    <Link className="block rounded-md border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50" href={`/app/${tenantSlug}/leads/${lead.id}`}>
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

function TaskRow({ tenantSlug, task }: { tenantSlug: string; task: TaskItem }) {
  return (
    <Link className="block rounded-md border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50" href={task.lead ? `/app/${tenantSlug}/leads/${task.lead.id}` : `/app/${tenantSlug}/todos`}>
      <div className="flex items-center justify-between gap-3">
        <span className="font-medium text-slate-950">{task.title}</span>
        <span className="text-xs text-slate-500">{formatDate(task.dueAt)}</span>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        {task.lead?.name ?? "未绑定客户"} / 负责人：{task.owner?.name ?? "未分配"}
      </p>
    </Link>
  );
}

function DraftRow({ tenantSlug, draft }: { tenantSlug: string; draft: DraftItem }) {
  return (
    <Link className="block rounded-md border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50" href={`/app/${tenantSlug}/leads/${draft.leadId}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="font-medium text-slate-950">{draft.lead.name}</span>
        <span className="text-xs text-slate-500">{draft.replyRiskLevel}</span>
      </div>
      <p className="mt-1 line-clamp-2 text-xs text-slate-500">{draft.customerQuestion}</p>
    </Link>
  );
}

function FollowUpRow({ tenantSlug, item }: { tenantSlug: string; item: FollowUpItem }) {
  return (
    <Link className="block rounded-md border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50" href={`/app/${tenantSlug}/leads/${item.leadId}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="font-medium text-slate-950">{item.lead.name}</span>
        <span className="text-xs text-slate-500">{formatDate(item.createdAt)}</span>
      </div>
      <p className="mt-1 line-clamp-2 text-xs text-slate-500">{item.content}</p>
    </Link>
  );
}

export default async function DashboardPage({ params }: { params: { tenantSlug: string } }) {
  const { user, tenant } = await requireTenantAccess(params.tenantSlug, ["TENANT_ADMIN", "OPERATOR", "SALES"]);
  const base = `/app/${tenant.slug}`;
  const ownerId = user.role === "SALES" ? user.id : undefined;
  const leadRules = todoWhere(tenant.id, ownerId);
  const taskRules = taskWhere(tenant.id, ownerId);
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
    doneFollowUpCountResult
  ] = await Promise.all([
    safeDashboardRead<TaskItem[]>(() => prisma.followTask.findMany({ where: taskRules.today, include: { lead: true, owner: true }, orderBy: { dueAt: "asc" }, take: 6 }), []),
    safeDashboardRead<LeadItem[]>(() => prisma.lead.findMany({ where: { ...leadRules.recent, createdAt: { gte: todayStart } }, include: { owner: true }, orderBy: { createdAt: "desc" }, take: 6 }), []),
    safeDashboardRead<TaskItem[]>(() => prisma.followTask.findMany({ where: taskRules.overdue, include: { lead: true, owner: true }, orderBy: { dueAt: "asc" }, take: 6 }), []),
    safeDashboardRead<DraftItem[]>(
      () =>
        prisma.marketClawReplyDraft.findMany({
          where: {
            tenantId: tenant.id,
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
            ...(ownerId ? { userId: ownerId } : {}),
            createdAt: { gte: todayStart, lt: tomorrowStart }
          }
        }),
      0
    )
  ]);
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
    doneFollowUpCountResult
  ].some((result) => result.unavailable);

  return (
    <PageShell
      tenant={tenant}
      title="试点销售工作台"
      description="今天该跟谁、客户说了什么、建议怎么回复、下一步做什么，都从这里开始。"
    >
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard label="今日待跟进客户" value={todayFollowCount} />
        <StatCard label="新线索" value={newLeadCount} />
        <StatCard label="高风险/超期客户" value={highRiskDrafts.length + overdueTaskCount} />
        <StatCard label="今日 AI 推荐回复" value={todayDrafts.length} />
        <StatCard label="今日完成记录" value={doneFollowUpCount} />
      </section>

      {dashboardDataUnavailable ? (
        <section className="mt-4">
          <Card className="border-amber-200 bg-amber-50 text-sm text-amber-800">当前统计暂不可用，不影响客户跟进。</Card>
        </section>
      ) : null}

      <section className="mt-6">
        <Card className="border-emerald-200 bg-emerald-50">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">先完成今天的客户跟进</h2>
              <p className="mt-2 text-sm leading-6 text-slate-700">销售只需要按顺序处理：待办客户、客户详情、AI 推荐回复、保存沟通记录、确认下一步。</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link className="rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white" href={`${base}/todos?view=today#today-tasks`}>
                查看今日待办
              </Link>
              <Link className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700" href={user.role === "SALES" ? `${base}/leads` : `${base}/imports`}>
                {user.role === "SALES" ? "进入客户列表" : "快速新增客户"}
              </Link>
            </div>
          </div>
        </Card>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <WorkSection title="今日待跟进客户">
          {todayTasks.length ? todayTasks.map((task) => <TaskRow key={task.id} tenantSlug={tenant.slug} task={task} />) : <EmptyLine>今天没有待办任务。</EmptyLine>}
        </WorkSection>

        <WorkSection title="新线索">
          {newLeads.length ? newLeads.map((lead) => <LeadRow key={lead.id} tenantSlug={tenant.slug} lead={lead} />) : <EmptyLine>今天还没有新线索。</EmptyLine>}
        </WorkSection>

        <WorkSection title="高风险/超期客户">
          {overdueTasks.length ? overdueTasks.map((task) => <TaskRow key={task.id} tenantSlug={tenant.slug} task={task} />) : null}
          {highRiskDrafts.length ? highRiskDrafts.map((draft) => <DraftRow key={draft.id} tenantSlug={tenant.slug} draft={draft} />) : null}
          {!overdueTasks.length && !highRiskDrafts.length ? <EmptyLine>当前没有高风险回复或超期任务。</EmptyLine> : null}
        </WorkSection>

        <WorkSection title="今日 AI 推荐回复">
          {todayDrafts.length ? todayDrafts.map((draft) => <DraftRow key={draft.id} tenantSlug={tenant.slug} draft={draft} />) : <EmptyLine>今天还没有生成 AI 推荐回复，进入客户详情即可使用。</EmptyLine>}
        </WorkSection>

        <WorkSection title="今日完成记录">
          {doneFollowUps.length ? doneFollowUps.map((item) => <FollowUpRow key={item.id} tenantSlug={tenant.slug} item={item} />) : <EmptyLine>今天还没有保存沟通记录。</EmptyLine>}
        </WorkSection>

        <WorkSection title="快速新增客户">
          {user.role === "SALES" ? (
            <>
              <EmptyLine>销售侧不做批量导入，先从已分配客户开始跟进。</EmptyLine>
              <Link className="inline-flex rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white" href={`${base}/leads`}>
                进入客户列表
              </Link>
            </>
          ) : (
            <>
              <EmptyLine>运营或管理员可把第一批试点客户导入系统，再分配负责人。</EmptyLine>
              <Link className="inline-flex rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white" href={`${base}/imports`}>
                导入客户
              </Link>
            </>
          )}
        </WorkSection>
      </section>
    </PageShell>
  );
}
