/*
 * 文件说明：该页面实现 V2.0.3 的跟进工作台。
 * 功能说明：保留原有任务与客户查询逻辑，并在页面顶部按“今日待办、逾期任务、已完成、任务模板”做任务归类入口。
 *
 * 结构概览：
 *   第一部分：工作台入口卡片
 *   第二部分：任务与客户查询
 *   第三部分：任务区块与客户区块
 */
import Link from "next/link";
import { FollowTaskPriority, FollowTaskStatus, FollowTaskType, type Prisma } from "@prisma/client";
import { cancelTask, completeTask, delayTask } from "@/lib/actions";
import { canViewAllTenantLeads, requireTenantAccess } from "@/lib/auth";
import { todoWhere } from "@/lib/dashboard";
import { customerTypeOptions, formatDate, intentionOptions, labelOf, stageOptions, taskPriorityOptions, taskStatusOptions, taskTypeOptions } from "@/lib/options";
import { prisma } from "@/lib/prisma";
import { taskWhere } from "@/lib/tasks";
import { PageShell } from "@/components/Shell";
import { Callout, Card, SectionTabs, StatCard } from "@/components/Ui";

export const dynamic = "force-dynamic";

type TaskItem = Prisma.FollowTaskGetPayload<{
  include: { lead: true; owner: true };
}>;

type LeadItem = Prisma.LeadGetPayload<{
  include: { owner: true };
}>;

function WorkbenchEntryCard({
  title,
  description,
  href
}: {
  title: string;
  description: string;
  href: string;
}) {
  return (
    <Card className="h-full">
      <h2 className="text-base font-semibold text-slate-950">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
      <Link className="mt-4 inline-flex rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700" href={href}>
        进入
      </Link>
    </Card>
  );
}

function dateTimeLocal(value: Date) {
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function tomorrowDefault() {
  const due = new Date();
  due.setDate(due.getDate() + 1);
  due.setHours(10, 0, 0, 0);
  return dateTimeLocal(due);
}

function filterValue<T extends Record<string, string>>(allowed: T, value?: string): T[keyof T] | undefined {
  return value && Object.values(allowed).includes(value) ? (value as T[keyof T]) : undefined;
}

export default async function TodosPage({
  params,
  searchParams
}: {
  params: { tenantSlug: string };
  searchParams?: { status?: string; type?: string; priority?: string; ownerId?: string; view?: string };
}) {
  const { user, tenant } = await requireTenantAccess(params.tenantSlug, ["TENANT_ADMIN", "OPERATOR", "SALES"]);
  const canViewAll = canViewAllTenantLeads(user.role);
  const requestedView = searchParams?.view;
  const currentView =
    requestedView === "overdue" || requestedView === "done" || requestedView === "priority" || requestedView === "filtered" ? requestedView : "today";
  const ownerId = canViewAll ? undefined : user.id;
  const taskRules = taskWhere(tenant.id, ownerId);
  const leadRules = todoWhere(tenant.id, ownerId);

  const statusFilter = filterValue(FollowTaskStatus, searchParams?.status);
  const typeFilter = filterValue(FollowTaskType, searchParams?.type);
  const priorityFilter = filterValue(FollowTaskPriority, searchParams?.priority);
  const ownerFilter = canViewAll && searchParams?.ownerId ? searchParams.ownerId : undefined;
  const hasFilters = Boolean(statusFilter || typeFilter || priorityFilter || ownerFilter);

  const filteredWhere: Prisma.FollowTaskWhereInput = {
    tenantId: tenant.id,
    ...(ownerId ? { ownerId } : {}),
    ...(ownerFilter ? { ownerId: ownerFilter } : {}),
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(typeFilter ? { type: typeFilter } : {}),
    ...(priorityFilter ? { priority: priorityFilter } : {})
  };

  const [todayTasks, overdueTasks, highPriorityTasks, weekTasks, doneTasks, filteredTasks, highIntentLeads, quotedLeads, reactivateLeads, owners] =
    await Promise.all([
      prisma.followTask.findMany({ where: taskRules.today, include: { lead: true, owner: true }, orderBy: { dueAt: "asc" }, take: 50 }),
      prisma.followTask.findMany({ where: taskRules.overdue, include: { lead: true, owner: true }, orderBy: { dueAt: "asc" }, take: 50 }),
      prisma.followTask.findMany({
        where: taskRules.highPriority,
        include: { lead: true, owner: true },
        orderBy: [{ priority: "desc" }, { dueAt: "asc" }],
        take: 50
      }),
      prisma.followTask.findMany({ where: taskRules.thisWeek, include: { lead: true, owner: true }, orderBy: { dueAt: "asc" }, take: 50 }),
      prisma.followTask.findMany({ where: taskRules.done, include: { lead: true, owner: true }, orderBy: { completedAt: "desc" }, take: 30 }),
      hasFilters
        ? prisma.followTask.findMany({
            where: filteredWhere,
            include: { lead: true, owner: true },
            orderBy: [{ dueAt: "asc" }, { updatedAt: "desc" }],
            take: 80
          })
        : Promise.resolve([]),
      prisma.lead.findMany({ where: leadRules.highIntent, include: { owner: true }, orderBy: { updatedAt: "desc" }, take: 30 }),
      prisma.lead.findMany({
        where: { tenantId: tenant.id, ...(ownerId ? { ownerId } : {}), stage: "QUOTED" },
        include: { owner: true },
        orderBy: { updatedAt: "desc" },
        take: 30
      }),
      prisma.lead.findMany({ where: leadRules.reactivate, include: { owner: true }, orderBy: { updatedAt: "desc" }, take: 30 }),
      canViewAll
        ? prisma.user.findMany({
            where: { tenantId: tenant.id, status: "active", role: { in: ["SALES", "OPERATOR"] } },
            orderBy: [{ role: "asc" }, { createdAt: "asc" }]
          })
        : Promise.resolve([])
    ]);

  return (
    <PageShell
      tenant={tenant}
      title="跟进工作台"
      breadcrumbs={[
        { label: "跟进工作台", href: `/app/${tenant.slug}/todos` },
        {
          label:
            currentView === "done"
              ? "已完成"
              : currentView === "priority"
                ? "高优先级任务"
                : currentView === "filtered"
                  ? "筛选结果"
                  : "今日待办"
        }
      ]}
      description={
        canViewAll ? "把今日待办、逾期任务、已完成记录和任务模板入口收口在一个工作台里。" : "销售先看今天该跟谁，再处理逾期未跟进客户，最后回到客户详情页继续回复与推进。"
      }
    >
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <StatCard label="今日待办" value={todayTasks.length} />
        <StatCard label="逾期任务" value={overdueTasks.length} />
        <StatCard label="高优先级任务" value={highPriorityTasks.length} />
        <StatCard label="本周待跟进" value={weekTasks.length} />
        <StatCard label="已完成任务" value={doneTasks.length} />
      </div>

      <SectionTabs
        current={currentView}
        items={[
          { key: "today", label: "今日待办", href: `/app/${tenant.slug}/todos?view=today#today-tasks` },
          { key: "overdue", label: "逾期任务", href: `/app/${tenant.slug}/todos?view=overdue#overdue-tasks` },
          { key: "done", label: "已完成", href: `/app/${tenant.slug}/todos?view=done#done-tasks` },
          ...(canViewAll ? [{ key: "priority", label: "高优先级任务", href: `/app/${tenant.slug}/todos?view=priority#high-priority-tasks` }] : []),
          ...(canViewAll ? [{ key: "templates", label: "任务模板", href: `/app/${tenant.slug}/task-templates` }] : [])
        ]}
        className="mt-4"
      />

      <Callout className="mt-4" title={canViewAll ? "管理视角" : "销售今日路径"} tone={canViewAll ? "slate" : "emerald"}>
        {canViewAll
          ? "先看今天和逾期任务，再用高优先级任务和任务模板校正团队跟进节奏，不把模板入口直接摊给销售。"
          : "先处理今日待办和逾期任务，再进入客户详情页完成回复、记录跟进并确认下一步动作。"}
      </Callout>

      <section className="mt-6">
        <h2 className="text-lg font-semibold text-slate-950">工作入口</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">复杂任务不再拆成多个一级菜单，而是在工作台内部继续分流。</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <WorkbenchEntryCard title="今日待办" description="先处理今天必须完成的跟进动作。" href="#today-tasks" />
          <WorkbenchEntryCard title="逾期任务" description="优先清理已经超时的跟进事项，避免客户失联。" href="#overdue-tasks" />
          <WorkbenchEntryCard title="已完成" description="回看已完成的任务和推进节奏。" href="#done-tasks" />
          {canViewAll ? (
            <WorkbenchEntryCard title="任务模板" description="管理员和运营继续维护标准化任务模板。" href={`/app/${tenant.slug}/task-templates`} />
          ) : null}
        </div>
      </section>

      <details className="mt-6" open={hasFilters}>
        <summary className="cursor-pointer rounded-md border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 shadow-sm">
          任务筛选
        </summary>
        <Card className="mt-3">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-950">任务筛选</h2>
              <p className="mt-1 text-sm text-slate-500">手动创建任务请进入客户详情页，任务会自动进入提醒队列。</p>
            </div>
            <Link className="rounded-md border border-slate-300 px-3 py-2 text-sm" href={`/app/${tenant.slug}/leads`}>
              选择客户创建任务
            </Link>
          </div>
          <form className="grid gap-3 md:grid-cols-4 lg:grid-cols-5">
            <input type="hidden" name="view" value="filtered" />
            <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" name="status" defaultValue={searchParams?.status ?? ""}>
              <option value="">全部状态</option>
              {taskStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" name="type" defaultValue={searchParams?.type ?? ""}>
              <option value="">全部类型</option>
              {taskTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" name="priority" defaultValue={searchParams?.priority ?? ""}>
              <option value="">全部优先级</option>
              {taskPriorityOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {canViewAll ? (
              <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" name="ownerId" defaultValue={searchParams?.ownerId ?? ""}>
                <option value="">全部负责人</option>
                {owners.map((owner) => (
                  <option key={owner.id} value={owner.id}>
                    {owner.name}（{owner.role}）
                  </option>
                ))}
              </select>
            ) : null}
            <button className="rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white">筛选</button>
          </form>
        </Card>
      </details>

      <div className="mt-6 grid gap-5 xl:grid-cols-2">
        {hasFilters ? <TaskSection tenantSlug={tenant.slug} sectionId="filtered-tasks" title="筛选结果" tasks={filteredTasks} /> : null}
        <TaskSection tenantSlug={tenant.slug} sectionId="today-tasks" title="今日待办" tasks={todayTasks} />
        <TaskSection tenantSlug={tenant.slug} sectionId="overdue-tasks" title="逾期任务" tasks={overdueTasks} urgent />
        <TaskSection tenantSlug={tenant.slug} sectionId="high-priority-tasks" title="高优先级任务" tasks={highPriorityTasks} />
        <TaskSection tenantSlug={tenant.slug} sectionId="week-tasks" title="本周待跟进" tasks={weekTasks} />
        <TaskSection tenantSlug={tenant.slug} sectionId="done-tasks" title="已完成" tasks={doneTasks} readOnly />
        <LeadSection tenantSlug={tenant.slug} title="高意向客户" leads={highIntentLeads} />
        <LeadSection tenantSlug={tenant.slug} title="报价客户" leads={quotedLeads} />
        <LeadSection tenantSlug={tenant.slug} title="待激活客户" leads={reactivateLeads} />
      </div>
    </PageShell>
  );
}

function TaskSection({
  tenantSlug,
  sectionId,
  title,
  tasks,
  urgent = false,
  readOnly = false
}: {
  tenantSlug: string;
  sectionId: string;
  title: string;
  tasks: TaskItem[];
  urgent?: boolean;
  readOnly?: boolean;
}) {
  return (
    <section id={sectionId}>
      <Card>
        <h2 className="mb-3 text-base font-semibold text-slate-950">{title}</h2>
        <div className="space-y-3">
          {tasks.length ? (
            tasks.map((task) => (
              <div key={task.id} className="rounded-md border border-slate-200 p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-emerald-700">{task.title}</span>
                  <span className={urgent ? "text-red-700" : "text-slate-500"}>{formatDate(task.dueAt)}</span>
                </div>
                <p className="mt-1 text-slate-600">
                  {labelOf(taskTypeOptions, task.type)} / {labelOf(taskPriorityOptions, task.priority)} / {labelOf(taskStatusOptions, task.status)}
                </p>
                {task.lead ? <p className="mt-1 text-slate-500">客户类型：{labelOf(customerTypeOptions, task.lead.customerType)}</p> : null}
                <p className="mt-1 text-slate-500">负责人：{task.owner?.name ?? "未分配"}</p>
                {task.description ? <p className="mt-1 text-slate-500">{task.description}</p> : null}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {task.lead ? (
                    <Link className="rounded-md border border-slate-300 px-3 py-1 text-xs" href={`/app/${tenantSlug}/leads/${task.lead.id}`}>
                      进入客户详情
                    </Link>
                  ) : null}
                  {!readOnly ? (
                    <>
                      <form action={completeTask.bind(null, tenantSlug, task.id)}>
                        <button className="rounded-md bg-emerald-700 px-3 py-1 text-xs font-medium text-white">标记完成</button>
                      </form>
                      <form action={delayTask.bind(null, tenantSlug, task.id)} className="flex items-center gap-2">
                        <input className="w-[170px] rounded-md border border-slate-300 px-2 py-1 text-xs" name="dueAt" type="datetime-local" defaultValue={tomorrowDefault()} />
                        <button className="rounded-md border border-slate-300 px-3 py-1 text-xs">延期</button>
                      </form>
                      <form action={cancelTask.bind(null, tenantSlug, task.id)}>
                        <button className="rounded-md border border-red-200 px-3 py-1 text-xs text-red-700">取消</button>
                      </form>
                    </>
                  ) : null}
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-500">暂无任务</p>
          )}
        </div>
      </Card>
    </section>
  );
}

function LeadSection({ tenantSlug, title, leads }: { tenantSlug: string; title: string; leads: LeadItem[] }) {
  return (
    <Card>
      <h2 className="mb-3 text-base font-semibold text-slate-950">{title}</h2>
      <div className="space-y-2">
        {leads.length ? (
          leads.map((lead) => (
            <Link key={lead.id} className="block rounded-md border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50" href={`/app/${tenantSlug}/leads/${lead.id}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-emerald-700">{lead.name}</span>
                <span className="text-slate-500">{formatDate(lead.nextFollowAt)}</span>
              </div>
              <p className="mt-1 text-slate-600">
                {labelOf(customerTypeOptions, lead.customerType)} / {labelOf(intentionOptions, lead.intentionLevel)} / {labelOf(stageOptions, lead.stage)}
              </p>
              <p className="mt-1 text-slate-500">负责人：{lead.owner?.name ?? "未分配"}</p>
            </Link>
          ))
        ) : (
          <p className="text-sm text-slate-500">暂无客户</p>
        )}
      </div>
    </Card>
  );
}
