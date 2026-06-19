/*
 * 文件说明：该文件提供企业看板与销售待办统计查询。
 * 功能说明：所有统计都以 tenantId 为强制过滤条件，并在销售视角下追加 ownerId 过滤。
 *
 * 结构概览：
 *   第一部分：日期边界计算
 *   第二部分：待办规则构造
 *   第三部分：看板统计聚合
 *   第四部分：销售跟进概览
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { taskWhere as followTaskWhere } from "@/lib/tasks";

export function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function endOfDay(date: Date) {
  const end = startOfDay(date);
  end.setDate(end.getDate() + 1);
  return end;
}

function startOfWeek(date: Date) {
  const day = date.getDay() || 7;
  const start = startOfDay(date);
  start.setDate(start.getDate() - day + 1);
  return start;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function scopedWhere(tenantId: string, ownerId?: string, businessLineId?: string): Prisma.LeadWhereInput {
  return {
    tenantId,
    ...(ownerId ? { ownerId } : {}),
    ...(businessLineId ? { businessLineId } : {})
  };
}

export function todoWhere(tenantId: string, ownerId?: string, businessLineId?: string) {
  const now = new Date();
  const today = startOfDay(now);
  const tomorrow = endOfDay(now);
  const base = scopedWhere(tenantId, ownerId, businessLineId);

  return {
    todayFollow: {
      ...base,
      nextFollowAt: { gte: today, lt: tomorrow },
      dealStatus: { not: "WON" }
    },
    overdueFollow: {
      ...base,
      nextFollowAt: { lt: today },
      dealStatus: { not: "WON" }
    },
    highIntent: {
      ...base,
      intentionLevel: { in: ["HIGH", "STRONG"] },
      stage: { not: "DEAL_DONE" },
      dealStatus: { not: "WON" }
    },
    unassigned: {
      tenantId,
      ...(businessLineId ? { businessLineId } : {}),
      ownerId: null
    },
    reactivate: {
      ...base,
      stage: "TO_REACTIVATE"
    },
    recent: base
  } satisfies Record<string, Prisma.LeadWhereInput>;
}

export async function getDashboardMetrics(tenantId: string, ownerId?: string, businessLineId?: string) {
  const now = new Date();
  const today = startOfDay(now);
  const week = startOfWeek(now);
  const month = startOfMonth(now);
  const baseWhere = scopedWhere(tenantId, ownerId, businessLineId);
  const todos = todoWhere(tenantId, ownerId, businessLineId);
  const tasks = followTaskWhere(tenantId, ownerId, businessLineId);

  const [
    todayCount,
    weekCount,
    monthCount,
    pendingFollowCount,
    highIntentCount,
    quotedCount,
    wonCount,
    silentCount,
    todayFollowCount,
    overdueFollowCount,
    unassignedCount,
    reactivateCount,
    taskTodayCount,
    taskOverdueCount,
    taskHighPriorityCount,
    bySource,
    byCustomerType,
    byIntention,
    byStage,
    salesOverview
  ] = await Promise.all([
    prisma.lead.count({ where: { ...baseWhere, createdAt: { gte: today } } }),
    prisma.lead.count({ where: { ...baseWhere, createdAt: { gte: week } } }),
    prisma.lead.count({ where: { ...baseWhere, createdAt: { gte: month } } }),
    prisma.lead.count({
      where: {
        ...baseWhere,
        OR: [{ nextFollowAt: { lte: now } }, { stage: { in: ["NEW", "CONTACTED"] } }]
      }
    }),
    prisma.lead.count({ where: todos.highIntent }),
    prisma.lead.count({ where: { ...baseWhere, stage: "QUOTED" } }),
    prisma.lead.count({ where: { ...baseWhere, dealStatus: "WON" } }),
    prisma.lead.count({
      where: {
        ...baseWhere,
        updatedAt: { lte: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000) },
        dealStatus: { not: "WON" }
      }
    }),
    prisma.lead.count({ where: todos.todayFollow }),
    prisma.lead.count({ where: todos.overdueFollow }),
    prisma.lead.count({ where: todos.unassigned }),
    prisma.lead.count({ where: todos.reactivate }),
    prisma.followTask.count({ where: tasks.today }),
    prisma.followTask.count({ where: tasks.overdue }),
    prisma.followTask.count({ where: tasks.highPriority }),
    prisma.lead.groupBy({ by: ["source"], where: baseWhere, _count: true }),
    prisma.lead.groupBy({ by: ["customerType"], where: baseWhere, _count: true }),
    prisma.lead.groupBy({ by: ["intentionLevel"], where: baseWhere, _count: true }),
    prisma.lead.groupBy({ by: ["stage"], where: baseWhere, _count: true }),
    ownerId ? Promise.resolve([]) : getSalesOverview(tenantId, businessLineId)
  ]);

  return {
    todayCount,
    weekCount,
    monthCount,
    pendingFollowCount,
    highIntentCount,
    quotedCount,
    wonCount,
    silentCount,
    todayFollowCount,
    overdueFollowCount,
    unassignedCount,
    reactivateCount,
    taskTodayCount,
    taskOverdueCount,
    taskHighPriorityCount,
    bySource,
    byCustomerType,
    byIntention,
    byStage,
    salesOverview
  };
}

export async function getSalesOverview(tenantId: string, businessLineId?: string) {
  const users = await prisma.user.findMany({
    where: {
      tenantId,
      status: "active",
      role: { in: ["SALES", "OPERATOR"] }
    },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }]
  });

  return Promise.all(
    users.map(async (user) => {
      const todos = todoWhere(tenantId, user.id, businessLineId);
      const tasks = followTaskWhere(tenantId, user.id, businessLineId);
      const [leadCount, todayFollowCount, overdueFollowCount, highIntentCount, quotedCount, wonCount, todayTaskCount, overdueTaskCount, doneTaskCount] = await Promise.all([
        prisma.lead.count({ where: { tenantId, ownerId: user.id, ...(businessLineId ? { businessLineId } : {}) } }),
        prisma.lead.count({ where: todos.todayFollow }),
        prisma.lead.count({ where: todos.overdueFollow }),
        prisma.lead.count({ where: todos.highIntent }),
        prisma.lead.count({ where: { tenantId, ownerId: user.id, stage: "QUOTED", ...(businessLineId ? { businessLineId } : {}) } }),
        prisma.lead.count({ where: { tenantId, ownerId: user.id, dealStatus: "WON", ...(businessLineId ? { businessLineId } : {}) } }),
        prisma.followTask.count({ where: tasks.today }),
        prisma.followTask.count({ where: tasks.overdue }),
        prisma.followTask.count({ where: tasks.done })
      ]);

      return {
        userId: user.id,
        name: user.name,
        role: user.role,
        leadCount,
        todayFollowCount,
        overdueFollowCount,
        highIntentCount,
        quotedCount,
        wonCount,
        todayTaskCount,
        overdueTaskCount,
        doneTaskCount
      };
    })
  );
}
