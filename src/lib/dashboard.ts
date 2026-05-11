/*
 * 文件说明：该文件提供企业看板统计查询。
 * 功能说明：所有统计都以 tenantId 为强制过滤条件，保证企业之间数据隔离。
 *
 * 结构概览：
 *   第一部分：日期边界计算
 *   第二部分：看板统计聚合
 */
import { prisma } from "@/lib/prisma";

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
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

export async function getDashboardMetrics(tenantId: string, ownerId?: string) {
  const now = new Date();
  const today = startOfDay(now);
  const week = startOfWeek(now);
  const month = startOfMonth(now);
  const baseWhere = ownerId ? { tenantId, ownerId } : { tenantId };

  const [
    todayCount,
    weekCount,
    monthCount,
    pendingFollowCount,
    highIntentCount,
    quotedCount,
    wonCount,
    silentCount,
    bySource,
    byCustomerType,
    byIntention,
    byStage
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
    prisma.lead.count({ where: { ...baseWhere, intentionLevel: { in: ["HIGH", "STRONG"] } } }),
    prisma.lead.count({ where: { ...baseWhere, stage: "QUOTED" } }),
    prisma.lead.count({ where: { ...baseWhere, dealStatus: "WON" } }),
    prisma.lead.count({
      where: {
        ...baseWhere,
        updatedAt: { lte: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000) },
        dealStatus: { not: "WON" }
      }
    }),
    prisma.lead.groupBy({ by: ["source"], where: baseWhere, _count: true }),
    prisma.lead.groupBy({ by: ["customerType"], where: baseWhere, _count: true }),
    prisma.lead.groupBy({ by: ["intentionLevel"], where: baseWhere, _count: true }),
    prisma.lead.groupBy({ by: ["stage"], where: baseWhere, _count: true })
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
    bySource,
    byCustomerType,
    byIntention,
    byStage
  };
}
