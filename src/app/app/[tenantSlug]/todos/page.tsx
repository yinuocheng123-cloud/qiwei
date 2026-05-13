/*
 * 文件说明：该文件实现 V1.3.1 销售任务工作台。
 * 功能说明：基于 FollowTask 展示任务分组、筛选条件、任务操作和客户快捷入口。
 *
 * 结构概览：
 *   第一部分：导入依赖与类型
 *   第二部分：任务和客户查询
 *   第三部分：筛选表单、任务卡片和客户列表组件
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
import { Card, StatCard } from "@/components/Ui";

export const dynamic = "force-dynamic";

type TaskItem = Prisma.FollowTaskGetPayload<{
  include: { lead: true; owner: true };
}>;

type LeadItem = Prisma.LeadGetPayload<{
  include: { owner: true };
}>;

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
  searchParams?: { status?: string; type?: string; priority?: string; ownerId?: string };
}) {
  const { user, tenant } = await requireTenantAccess(params.tenantSlug, ["TENANT_ADMIN", "OPERATOR", "SALES"]);
  const canViewAll = canViewAllTenantLeads(user.role);
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

  const [todayTasks, overdueTasks, highPriorityTasks, weekTasks, doneTasks, filteredTasks, highIntentLeads, quotedLeads, reactivateLeads, owners] = await Promise.all([
    prisma.followTask.findMany({ where: taskRules.today, include: { lead: true, owner: true }, orderBy: { dueAt: "asc" }, take: 50 }),
    prisma.followTask.findMany({ where: taskRules.overdue, include: { lead: true, owner: true }, orderBy: { dueAt: "asc" }, take: 50 }),
    prisma.followTask.findMany({ where: taskRules.highPriority, include: { lead: true, owner: true }, orderBy: [{ priority: "desc" }, { dueAt: "asc" }], take: 50 }),
    prisma.followTask.findMany({ where: taskRules.thisWeek, include: { lead: true, owner: true }, orderBy: { dueAt: "asc" }, take: 50 }),
    prisma.followTask.findMany({ where: taskRules.done, include: { lead: true, owner: true }, orderBy: { completedAt: "desc" }, take: 30 }),
    hasFilters ? prisma.followTask.findMany({ where: filteredWhere, include: { lead: true, owner: true }, orderBy: [{ dueAt: "asc" }, { updatedAt: "desc" }], take: 80 }) : Promise.resolve([]),
    prisma.lead.findMany({ where: leadRules.highIntent, include: { owner: true }, orderBy: { updatedAt: "desc" }, take: 30 }),
    prisma.lead.findMany({ where: { tenantId: tenant.id, ...(ownerId ? { ownerId } : {}), stage: "QUOTED" }, include: { owner: true }, orderBy: { updatedAt: "desc" }, take: 30 }),
    prisma.lead.findMany({ where: leadRules.reactivate, include: { owner: true }, orderBy: { updatedAt: "desc" }, take: 30 }),
    canViewAll
      ? prisma.user.findMany({ where: { tenantId: tenant.id, status: "active", role: { in: ["SALES", "OPERATOR"] } }, orderBy: [{ role: "asc" }, { createdAt: "asc" }] })
      : Promise.resolve([])
  ]);

  return (
    <PageShell tenant={tenant} title="销售工作台" description="任务工作台支持状态、类型、优先级和负责人筛选；销售只看到自己的任务。">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <StatCard label="今日任务" value={todayTasks.length} />
        <StatCard label="逾期任务" value={overdueTasks.length} />
        <StatCard label="高优先级任务" value={highPriorityTasks.length} />
        <StatCard label="本周待跟进" value={weekTasks.length} />
        <StatCard label="已完成任务" value={doneTasks.length} />
      </div>

      <Card className="mt-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-950">任务筛选</h2>
            <p className="mt-1 text-sm text-slate-500">手动创建任务请进入客户详情页，任务会自动生成站内提醒队列。</p>
          </div>
          <Link className="rounded-md border border-slate-300 px-3 py-2 text-sm" href={`/app/${tenant.slug}/leads`}>
            选择客户创建任务
          </Link>
        </div>
        <form className="grid gap-3 md:grid-cols-4 lg:grid-cols-5">
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

      <div className="mt-6 grid gap-5 xl:grid-cols-2">
        {hasFilters ? <TaskSection tenantSlug={tenant.slug} title="筛选结果" tasks={filteredTasks} /> : null}
        <TaskSection tenantSlug={tenant.slug} title="今日任务" tasks={todayTasks} />
        <TaskSection tenantSlug={tenant.slug} title="逾期任务" tasks={overdueTasks} urgent />
        <TaskSection tenantSlug={tenant.slug} title="高优先级任务" tasks={highPriorityTasks} />
        <TaskSection tenantSlug={tenant.slug} title="本周待跟进" tasks={weekTasks} />
        <TaskSection tenantSlug={tenant.slug} title="已完成任务" tasks={doneTasks} readOnly />
        <LeadSection tenantSlug={tenant.slug} title="我的高意向客户" leads={highIntentLeads} />
        <LeadSection tenantSlug={tenant.slug} title="我的报价客户" leads={quotedLeads} />
        <LeadSection tenantSlug={tenant.slug} title="我的待激活客户" leads={reactivateLeads} />
      </div>
    </PageShell>
  );
}

function TaskSection({ tenantSlug, title, tasks, urgent = false, readOnly = false }: { tenantSlug: string; title: string; tasks: TaskItem[]; urgent?: boolean; readOnly?: boolean }) {
  return (
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
