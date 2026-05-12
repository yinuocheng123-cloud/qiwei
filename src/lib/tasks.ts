/*
 * 文件说明：该文件封装销售任务的查询、生成、去重和提醒队列同步。
 * 功能说明：负责 FollowTask 的统一创建入口、自动任务规则、IN_APP 提醒队列预留和任务权限查询条件。
 *
 * 结构概览：
 *   第一部分：导入依赖与类型
 *   第二部分：日期、优先级与查询规则
 *   第三部分：提醒队列同步
 *   第四部分：任务去重创建入口
 *   第五部分：业务自动任务规则
 */
import {
  FollowTaskPriority,
  FollowTaskStatus,
  FollowTaskType,
  LeadStage,
  ReminderChannel,
  ReminderStatus,
  type IntentionLevel,
  type Prisma
} from "@prisma/client";
import { safeWriteAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

type TaskAuditUser = {
  userId?: string | null;
};

type TaskLead = {
  id: string;
  tenantId: string;
  ownerId: string | null;
  name: string;
  intentionLevel: IntentionLevel;
  stage: LeadStage;
  nextFollowAt?: Date | null;
};

type TaskRecordForReminder = {
  id: string;
  tenantId: string;
  leadId: string | null;
  ownerId: string | null;
  title: string;
  type: FollowTaskType;
  priority: FollowTaskPriority;
  dueAt: Date | null;
};

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfDay(date: Date) {
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

function endOfWeek(date: Date) {
  const end = startOfWeek(date);
  end.setDate(end.getDate() + 7);
  return end;
}

function defaultDueToday() {
  const due = new Date();
  due.setHours(18, 0, 0, 0);
  return due;
}

export function defaultDueAfterDays(days: number) {
  const due = new Date();
  due.setDate(due.getDate() + Math.max(0, days));
  due.setHours(18, 0, 0, 0);
  return due;
}

export function priorityForIntention(intentionLevel: IntentionLevel): FollowTaskPriority {
  if (intentionLevel === "STRONG") return FollowTaskPriority.URGENT;
  if (intentionLevel === "HIGH") return FollowTaskPriority.HIGH;
  return FollowTaskPriority.NORMAL;
}

export function taskWhere(tenantId: string, ownerId?: string) {
  const now = new Date();
  const today = startOfDay(now);
  const tomorrow = endOfDay(now);
  const weekEnd = endOfWeek(now);
  const openStatuses = [FollowTaskStatus.PENDING, FollowTaskStatus.DELAYED];
  const base: Prisma.FollowTaskWhereInput = ownerId ? { tenantId, ownerId } : { tenantId };
  const openBase: Prisma.FollowTaskWhereInput = { ...base, status: { in: openStatuses } };

  return {
    today: { ...openBase, dueAt: { gte: today, lt: tomorrow } },
    overdue: { ...openBase, dueAt: { lt: today } },
    highPriority: { ...openBase, priority: { in: [FollowTaskPriority.HIGH, FollowTaskPriority.URGENT] } },
    thisWeek: { ...openBase, dueAt: { gte: today, lt: weekEnd } },
    done: { ...base, status: FollowTaskStatus.DONE },
    open: openBase
  } satisfies Record<string, Prisma.FollowTaskWhereInput>;
}

export async function syncInAppReminderForTask(task: TaskRecordForReminder, input: TaskAuditUser = {}) {
  if (!task.dueAt || !task.ownerId) return null;

  const payload = {
    taskId: task.id,
    leadId: task.leadId,
    title: task.title,
    type: task.type,
    priority: task.priority
  };

  const existing = await prisma.reminderQueue.findFirst({
    where: {
      tenantId: task.tenantId,
      taskId: task.id,
      channel: ReminderChannel.IN_APP,
      status: ReminderStatus.PENDING
    }
  });

  if (existing) {
    const reminder = await prisma.reminderQueue.update({
      where: { id: existing.id },
      data: {
        leadId: task.leadId,
        userId: task.ownerId,
        scheduledAt: task.dueAt,
        payload
      }
    });
    await safeWriteAuditLog({
      tenantId: task.tenantId,
      userId: input.userId ?? undefined,
      action: "reminder_updated",
      entityType: "ReminderQueue",
      entityId: reminder.id,
      metadata: { taskId: task.id, scheduledAt: task.dueAt.toISOString() }
    });
    return reminder;
  }

  const reminder = await prisma.reminderQueue.create({
    data: {
      tenantId: task.tenantId,
      taskId: task.id,
      leadId: task.leadId ?? undefined,
      userId: task.ownerId,
      channel: ReminderChannel.IN_APP,
      status: ReminderStatus.PENDING,
      scheduledAt: task.dueAt,
      payload
    }
  });
  await safeWriteAuditLog({
    tenantId: task.tenantId,
    userId: input.userId ?? undefined,
    action: "reminder_created",
    entityType: "ReminderQueue",
    entityId: reminder.id,
    metadata: { taskId: task.id, channel: ReminderChannel.IN_APP, scheduledAt: task.dueAt.toISOString() }
  });

  return reminder;
}

export async function cancelPendingRemindersForTask(task: { id: string; tenantId: string }, input: TaskAuditUser & { reason?: string } = {}) {
  const pendingReminders = await prisma.reminderQueue.findMany({
    where: {
      tenantId: task.tenantId,
      taskId: task.id,
      status: ReminderStatus.PENDING
    },
    select: { id: true }
  });
  if (!pendingReminders.length) return 0;

  await prisma.reminderQueue.updateMany({
    where: { id: { in: pendingReminders.map((reminder) => reminder.id) }, tenantId: task.tenantId },
    data: { status: ReminderStatus.CANCELLED }
  });

  await safeWriteAuditLog({
    tenantId: task.tenantId,
    userId: input.userId ?? undefined,
    action: "reminder_cancelled",
    entityType: "ReminderQueue",
    metadata: { taskId: task.id, count: pendingReminders.length, reason: input.reason ?? null }
  });

  return pendingReminders.length;
}

export async function createTaskWithAudit(input: {
  tenantId: string;
  leadId?: string | null;
  ownerId?: string | null;
  createdById?: string | null;
  title: string;
  description?: string | null;
  type: FollowTaskType;
  priority?: FollowTaskPriority;
  dueAt?: Date | null;
  auditAction?: string;
  auditMetadata?: Prisma.InputJsonObject;
}) {
  const priority = input.priority ?? FollowTaskPriority.NORMAL;
  const dueAt = input.dueAt ?? null;

  if (dueAt && input.leadId && input.ownerId) {
    const existing = await prisma.followTask.findFirst({
      where: {
        tenantId: input.tenantId,
        leadId: input.leadId,
        ownerId: input.ownerId,
        type: input.type,
        status: { in: [FollowTaskStatus.PENDING, FollowTaskStatus.DELAYED] },
        dueAt: { gte: startOfDay(dueAt), lt: endOfDay(dueAt) }
      },
      orderBy: { updatedAt: "desc" }
    });

    if (existing) {
      const task = await prisma.followTask.update({
        where: { id: existing.id },
        data: {
          title: input.title,
          description: input.description ?? undefined,
          priority,
          dueAt
        }
      });
      await safeWriteAuditLog({
        tenantId: input.tenantId,
        userId: input.createdById ?? undefined,
        action: "task_deduped_updated",
        entityType: "FollowTask",
        entityId: task.id,
        metadata: {
          ...(input.auditMetadata ?? {}),
          leadId: input.leadId,
          ownerId: input.ownerId,
          type: input.type,
          priority: task.priority,
          dueAt: task.dueAt?.toISOString() ?? null
        }
      });
      await syncInAppReminderForTask(task, { userId: input.createdById });
      return task;
    }
  }

  const task = await prisma.followTask.create({
    data: {
      tenantId: input.tenantId,
      leadId: input.leadId ?? undefined,
      ownerId: input.ownerId ?? undefined,
      createdById: input.createdById ?? undefined,
      title: input.title,
      description: input.description ?? undefined,
      type: input.type,
      priority,
      dueAt: dueAt ?? undefined
    }
  });

  await safeWriteAuditLog({
    tenantId: input.tenantId,
    userId: input.createdById ?? undefined,
    action: input.auditAction ?? "task_created",
    entityType: "FollowTask",
    entityId: task.id,
    metadata: {
      ...(input.auditMetadata ?? {}),
      leadId: input.leadId ?? null,
      ownerId: input.ownerId ?? null,
      type: input.type,
      priority: task.priority,
      dueAt: task.dueAt?.toISOString() ?? null
    }
  });
  await syncInAppReminderForTask(task, { userId: input.createdById });

  return task;
}

export async function createFirstFollowTask(lead: TaskLead, input: TaskAuditUser = {}) {
  if (!lead.ownerId) return null;
  return createTaskWithAudit({
    tenantId: lead.tenantId,
    leadId: lead.id,
    ownerId: lead.ownerId,
    createdById: input.userId,
    title: `首次跟进：${lead.name}`,
    description: "线索分配后自动生成，请尽快完成首次沟通并记录跟进。",
    type: FollowTaskType.FIRST_FOLLOW,
    priority: priorityForIntention(lead.intentionLevel),
    dueAt: defaultDueToday()
  });
}

export async function createHighIntentTask(lead: TaskLead, input: TaskAuditUser = {}) {
  if (!lead.ownerId || !["HIGH", "STRONG"].includes(lead.intentionLevel)) return null;
  return createTaskWithAudit({
    tenantId: lead.tenantId,
    leadId: lead.id,
    ownerId: lead.ownerId,
    createdById: input.userId,
    title: `高意向客户跟进：${lead.name}`,
    description: "客户意向等级较高，需要优先推进下一步动作。",
    type: FollowTaskType.DEAL_PUSH,
    priority: priorityForIntention(lead.intentionLevel),
    dueAt: defaultDueToday()
  });
}

export async function createStageDrivenTask(lead: TaskLead, stageAfter: LeadStage, input: TaskAuditUser = {}) {
  if (!lead.ownerId) return null;
  if (stageAfter === LeadStage.QUOTED) {
    return createTaskWithAudit({
      tenantId: lead.tenantId,
      leadId: lead.id,
      ownerId: lead.ownerId,
      createdById: input.userId,
      title: `报价跟进：${lead.name}`,
      description: "客户已报价，需要跟进报价反馈和成交阻力。",
      type: FollowTaskType.QUOTE_FOLLOW,
      priority: priorityForIntention(lead.intentionLevel),
      dueAt: lead.nextFollowAt ?? defaultDueToday()
    });
  }
  if (stageAfter === LeadStage.TO_REACTIVATE) {
    return createTaskWithAudit({
      tenantId: lead.tenantId,
      leadId: lead.id,
      ownerId: lead.ownerId,
      createdById: input.userId,
      title: `客户激活：${lead.name}`,
      description: "客户进入待激活阶段，需要重新触达并设计激活动作。",
      type: FollowTaskType.REACTIVATE,
      priority: FollowTaskPriority.HIGH,
      dueAt: lead.nextFollowAt ?? defaultDueToday()
    });
  }
  return null;
}

export async function createNextFollowTask(lead: TaskLead, nextFollowAt: Date, input: TaskAuditUser = {}) {
  if (!lead.ownerId) return null;
  return createTaskWithAudit({
    tenantId: lead.tenantId,
    leadId: lead.id,
    ownerId: lead.ownerId,
    createdById: input.userId,
    title: `下次跟进：${lead.name}`,
    description: "根据跟进记录的下次跟进时间自动生成。",
    type: FollowTaskType.WECHAT_FOLLOW,
    priority: priorityForIntention(lead.intentionLevel),
    dueAt: nextFollowAt
  });
}
