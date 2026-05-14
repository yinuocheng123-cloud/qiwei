"use server";

/*
 * 文件说明：该文件集中放置 V1.0 Server Actions。
 * 功能说明：处理租户、公开表单、跟进、策略、资料和企业微信占位配置的写入逻辑。
 *
 * 结构概览：
 *   第一部分：导入依赖与通用解析
 *   第二部分：平台与租户动作
 *   第三部分：公开表单与线索动作
 *   第四部分：策略、资料和企业微信动作
 */
import {
  BusinessLineCategory,
  BusinessLineStatus,
  CustomerType,
  FormType,
  FollowTaskPriority,
  FollowTaskStatus,
  FollowTaskType,
  IntentionLevel,
  LeadSource,
  LeadStage,
  MaterialType,
  NeedType,
  TenantStatus,
  UserRole,
  WeComConfigStatus
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { safeWriteAuditLog } from "@/lib/audit";
import { requireLeadAccess, requirePlatformAdmin, requireTenantAccess } from "@/lib/auth";
import { buildBusinessLineSlug, parseBusinessLineRecommendedTagText } from "@/lib/business-lines";
import { prisma } from "@/lib/prisma";
import {
  detectQuestionType,
  detectTagSuggestionTopic,
  generateReplySuggestions,
  getSuggestedTagKey,
  mapSuggestedTagGroupToLeadTagGroup,
  parseSuggestedTags
} from "@/lib/reply-suggestions";
import {
  cancelPendingRemindersForTask,
  createFirstFollowTask,
  createHighIntentTask,
  createNextFollowTask,
  createStageDrivenTask,
  createTaskWithAudit,
  defaultDueAfterDays,
  syncInAppReminderForTask
} from "@/lib/tasks";
import { getDefaultTenantUser } from "@/lib/tenant";

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function enumValue<T extends Record<string, string>>(allowed: T, value: string | undefined, fallback: T[keyof T]) {
  return value && Object.values(allowed).includes(value) ? (value as T[keyof T]) : fallback;
}

function parseDate(value?: string) {
  return value ? new Date(value) : undefined;
}

function splitLines(value?: string) {
  return value
    ? value
        .split(/\r?\n|,/)
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
}

function parseNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function truncateAuditQuestion(question: string, maxLength = 100) {
  return question.length <= maxLength ? question : `${question.slice(0, Math.max(0, maxLength - 3))}...`;
}

export async function createTenant(formData: FormData) {
  const user = await requirePlatformAdmin();
  const name = text(formData, "name");
  const slug = text(formData, "slug");
  if (!name || !slug) return;

  const tenant = await prisma.tenant.create({
    data: {
      name,
      slug,
      industry: text(formData, "industry"),
      expiredAt: parseDate(text(formData, "expiredAt"))
    }
  });
  await safeWriteAuditLog({
    userId: user.id,
    action: "tenant_created",
    entityType: "Tenant",
    entityId: tenant.id,
    metadata: { name: tenant.name, slug: tenant.slug, industry: tenant.industry }
  });

  revalidatePath("/admin");
}

export async function updateTenantStatus(formData: FormData) {
  const user = await requirePlatformAdmin();
  const id = text(formData, "id");
  if (!id) return;

  const tenant = await prisma.tenant.update({
    where: { id },
    data: {
      status: enumValue(TenantStatus, text(formData, "status"), TenantStatus.active),
      expiredAt: parseDate(text(formData, "expiredAt"))
    }
  });
  await safeWriteAuditLog({
    tenantId: tenant.id,
    userId: user.id,
    action: "tenant_status_updated",
    entityType: "Tenant",
    entityId: tenant.id,
    metadata: { status: tenant.status, expiredAt: tenant.expiredAt?.toISOString() ?? null }
  });

  revalidatePath("/admin");
}

export async function submitIntakeForm(tenantSlug: string, formType: FormType, formData: FormData) {
  const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
  if (!tenant || tenant.status !== "active") {
    throw new Error("当前企业项目不存在或已停用。");
  }

  const name = text(formData, "name");
  const phone = text(formData, "phone");
  if (!name || !phone) {
    throw new Error("姓名和手机号为必填项。");
  }

  const customerType = enumValue(CustomerType, text(formData, "customerType"), CustomerType.OTHER);
  const needType = enumValue(NeedType, text(formData, "needType"), NeedType.OTHER);
  const source = enumValue(LeadSource, text(formData, "source"), LeadSource.other);
  const urgent = text(formData, "urgent") === "on";
  const intentionLevel = urgent ? IntentionLevel.STRONG : formType === "diagnosis" ? IntentionLevel.HIGH : IntentionLevel.MEDIUM;
  const owner = await getDefaultTenantUser(tenant.id);

  const lead = await prisma.lead.create({
    data: {
      tenantId: tenant.id,
      name,
      phone,
      wechat: text(formData, "wechat"),
      company: text(formData, "company"),
      industry: text(formData, "industry"),
      city: text(formData, "city"),
      source,
      customerType,
      needType,
      intentionLevel,
      stage: LeadStage.NEW,
      message: text(formData, "message"),
      ownerId: owner?.id
    }
  });

  await prisma.intakeForm.create({
    data: {
      tenantId: tenant.id,
      formType,
      source,
      name,
      phone,
      wechat: text(formData, "wechat"),
      company: text(formData, "company"),
      industry: text(formData, "industry"),
      city: text(formData, "city"),
      customerType,
      needType,
      message: text(formData, "message"),
      createdLeadId: lead.id
    }
  });

  await prisma.leadTag.createMany({
    data: [
      { tenantId: tenant.id, leadId: lead.id, tagName: source, tagGroup: "SOURCE" },
      { tenantId: tenant.id, leadId: lead.id, tagName: customerType, tagGroup: "CUSTOMER_TYPE" },
      { tenantId: tenant.id, leadId: lead.id, tagName: needType, tagGroup: "NEED" },
      { tenantId: tenant.id, leadId: lead.id, tagName: intentionLevel, tagGroup: "INTENTION" }
    ]
  });
  await safeWriteAuditLog({
    tenantId: tenant.id,
    action: "public_form_lead_created",
    entityType: "Lead",
    entityId: lead.id,
    metadata: {
      formType,
      source,
      customerType,
      needType,
      intentionLevel,
      ownerId: owner?.id ?? null
    }
  });
  await createFirstFollowTask(lead);
  await createHighIntentTask(lead);

  redirect(`/t/${tenantSlug}/thanks?lead=${lead.id}`);
}

export async function addFollowUp(tenantSlug: string, leadId: string, formData: FormData) {
  const { user, tenant, lead } = await requireLeadAccess(tenantSlug, leadId);
  const content = text(formData, "content");
  if (!content) return;

  const stageAfter = enumValue(LeadStage, text(formData, "stageAfter"), lead.stage);
  const nextFollowAt = parseDate(text(formData, "nextFollowAt"));

  const followUp = await prisma.followUp.create({
    data: {
      tenantId: tenant.id,
      leadId: lead.id,
      userId: user.id,
      content,
      nextAction: text(formData, "nextAction"),
      nextFollowAt,
      stageBefore: lead.stage,
      stageAfter
    }
  });

  await prisma.lead.update({
    where: { id: lead.id },
    data: {
      stage: stageAfter,
      nextFollowAt,
      lastFollowAt: new Date(),
      dealStatus: stageAfter === "DEAL_DONE" ? "WON" : stageAfter === "LOST" ? "LOST" : lead.dealStatus
    }
  });
  await safeWriteAuditLog({
    tenantId: tenant.id,
    userId: user.id,
    action: "followup_created",
    entityType: "FollowUp",
    entityId: followUp.id,
    metadata: {
      leadId: lead.id,
      stageBefore: lead.stage,
      stageAfter,
      nextFollowAt: nextFollowAt?.toISOString() ?? null
    }
  });
  if (lead.stage !== stageAfter) {
    await safeWriteAuditLog({
      tenantId: tenant.id,
      userId: user.id,
      action: "lead_stage_updated",
      entityType: "Lead",
      entityId: lead.id,
      metadata: { stageBefore: lead.stage, stageAfter }
    });
  }
  const taskLead = { ...lead, stage: stageAfter, nextFollowAt };
  if (nextFollowAt) {
    await createNextFollowTask(taskLead, nextFollowAt, { userId: user.id });
  }
  await createStageDrivenTask(taskLead, stageAfter, { userId: user.id });

  revalidatePath(`/app/${tenantSlug}/leads/${leadId}`);
  revalidatePath(`/app/${tenantSlug}/todos`);
  revalidatePath(`/app/${tenantSlug}/dashboard`);
}

export async function assignLeadOwner(tenantSlug: string, leadId: string, formData: FormData) {
  const { user, tenant, lead } = await requireLeadAccess(tenantSlug, leadId);
  if (!["TENANT_ADMIN", "OPERATOR"].includes(user.role)) return;

  const ownerId = text(formData, "ownerId");
  const owner = ownerId
    ? await prisma.user.findFirst({
        where: {
          id: ownerId,
          tenantId: tenant.id,
          status: "active",
          role: { in: [UserRole.SALES, UserRole.OPERATOR] }
        }
      })
    : null;

  const updatedLead = await prisma.lead.update({
    where: { id: lead.id },
    data: { ownerId: owner?.id ?? null }
  });
  await safeWriteAuditLog({
    tenantId: tenant.id,
    userId: user.id,
    action: "lead_owner_assigned",
    entityType: "Lead",
    entityId: lead.id,
    metadata: {
      ownerBefore: lead.ownerId,
      ownerAfter: owner?.id ?? null
    }
  });
  if (owner?.id) {
    await createFirstFollowTask(updatedLead, { userId: user.id });
    await createHighIntentTask(updatedLead, { userId: user.id });
  }

  revalidatePath(`/app/${tenantSlug}/leads`);
  revalidatePath(`/app/${tenantSlug}/leads/${leadId}`);
  revalidatePath(`/app/${tenantSlug}/todos`);
  revalidatePath(`/app/${tenantSlug}/dashboard`);
}

async function requireTaskAccess(tenantSlug: string, taskId: string) {
  const { user, tenant } = await requireTenantAccess(tenantSlug, ["TENANT_ADMIN", "OPERATOR", "SALES"]);
  const task = await prisma.followTask.findFirst({
    where: { id: taskId, tenantId: tenant.id },
    include: { lead: true }
  });
  if (!task) return redirect("/forbidden");
  if (user.role === "SALES" && task.ownerId !== user.id) {
    redirect("/forbidden");
  }
  return { user, tenant, task };
}

export async function completeTask(tenantSlug: string, taskId: string) {
  const { user, tenant, task } = await requireTaskAccess(tenantSlug, taskId);
  const updatedTask = await prisma.followTask.update({
    where: { id: task.id },
    data: {
      status: FollowTaskStatus.DONE,
      completedAt: new Date(),
      cancelledAt: null
    }
  });
  await safeWriteAuditLog({
    tenantId: tenant.id,
    userId: user.id,
    action: "task_completed",
    entityType: "FollowTask",
    entityId: updatedTask.id,
    metadata: { leadId: updatedTask.leadId, ownerId: updatedTask.ownerId }
  });
  await cancelPendingRemindersForTask(updatedTask, { userId: user.id, reason: "task_completed" });

  revalidatePath(`/app/${tenantSlug}/todos`);
  revalidatePath(`/app/${tenantSlug}/dashboard`);
}

export async function delayTask(tenantSlug: string, taskId: string, formData: FormData) {
  const { user, tenant, task } = await requireTaskAccess(tenantSlug, taskId);
  const dueAt = parseDate(text(formData, "dueAt"));
  if (!dueAt) return;
  const updatedTask = await prisma.followTask.update({
    where: { id: task.id },
    data: {
      status: FollowTaskStatus.DELAYED,
      dueAt
    }
  });
  await safeWriteAuditLog({
    tenantId: tenant.id,
    userId: user.id,
    action: "task_delayed",
    entityType: "FollowTask",
    entityId: updatedTask.id,
    metadata: { leadId: updatedTask.leadId, ownerId: updatedTask.ownerId, dueAt: updatedTask.dueAt?.toISOString() ?? null }
  });
  await syncInAppReminderForTask(updatedTask, { userId: user.id });

  revalidatePath(`/app/${tenantSlug}/todos`);
  revalidatePath(`/app/${tenantSlug}/dashboard`);
}

export async function cancelTask(tenantSlug: string, taskId: string) {
  const { user, tenant, task } = await requireTaskAccess(tenantSlug, taskId);
  const updatedTask = await prisma.followTask.update({
    where: { id: task.id },
    data: {
      status: FollowTaskStatus.CANCELLED,
      cancelledAt: new Date()
    }
  });
  await safeWriteAuditLog({
    tenantId: tenant.id,
    userId: user.id,
    action: "task_cancelled",
    entityType: "FollowTask",
    entityId: updatedTask.id,
    metadata: { leadId: updatedTask.leadId, ownerId: updatedTask.ownerId }
  });
  await cancelPendingRemindersForTask(updatedTask, { userId: user.id, reason: "task_cancelled" });

  revalidatePath(`/app/${tenantSlug}/todos`);
  revalidatePath(`/app/${tenantSlug}/dashboard`);
}

export async function createManualTask(tenantSlug: string, leadId: string, formData: FormData) {
  const { user, tenant, lead } = await requireLeadAccess(tenantSlug, leadId);
  const templateId = text(formData, "templateId");
  const template = templateId
    ? await prisma.taskTemplate.findFirst({
        where: { id: templateId, tenantId: tenant.id, isActive: true }
      })
    : null;

  const requestedOwnerId = text(formData, "ownerId");
  const ownerId = user.role === "SALES" ? user.id : requestedOwnerId ?? lead.ownerId ?? undefined;
  if (!ownerId) return;

  if (user.role === "SALES" && ownerId !== user.id) {
    redirect("/forbidden");
  }

  const owner = await prisma.user.findFirst({
    where: {
      id: ownerId,
      tenantId: tenant.id,
      status: "active",
      role: { in: [UserRole.SALES, UserRole.OPERATOR] }
    }
  });
  if (!owner) return;

  const dueAt = parseDate(text(formData, "dueAt")) ?? (template ? defaultDueAfterDays(template.defaultDueDays) : undefined);
  const task = await createTaskWithAudit({
    tenantId: tenant.id,
    leadId: lead.id,
    ownerId: owner.id,
    createdById: user.id,
    title: text(formData, "title") ?? template?.title ?? `手动任务：${lead.name}`,
    description: text(formData, "description") ?? template?.description ?? undefined,
    type: enumValue(FollowTaskType, text(formData, "type") ?? template?.type, FollowTaskType.CUSTOM),
    priority: enumValue(FollowTaskPriority, text(formData, "priority") ?? template?.priority, FollowTaskPriority.NORMAL),
    dueAt,
    auditAction: "task_manual_created",
    auditMetadata: { source: "manual", templateId: template?.id ?? null }
  });

  if (template) {
    await safeWriteAuditLog({
      tenantId: tenant.id,
      userId: user.id,
      action: "task_template_used",
      entityType: "TaskTemplate",
      entityId: template.id,
      metadata: { taskId: task.id, leadId: lead.id, ownerId: owner.id }
    });
  }

  revalidatePath(`/app/${tenantSlug}/leads/${leadId}`);
  revalidatePath(`/app/${tenantSlug}/todos`);
  revalidatePath(`/app/${tenantSlug}/dashboard`);
}

export async function createTaskTemplate(tenantSlug: string, formData: FormData) {
  const { user, tenant } = await requireTenantAccess(tenantSlug, ["TENANT_ADMIN", "OPERATOR"]);
  const name = text(formData, "name");
  const title = text(formData, "title");
  if (!name || !title) return;

  const customerTypeInput = text(formData, "customerType");
  const stageInput = text(formData, "stage");
  const template = await prisma.taskTemplate.create({
    data: {
      tenantId: tenant.id,
      name,
      title,
      description: text(formData, "description"),
      type: enumValue(FollowTaskType, text(formData, "type"), FollowTaskType.CUSTOM),
      priority: enumValue(FollowTaskPriority, text(formData, "priority"), FollowTaskPriority.NORMAL),
      defaultDueDays: Number(text(formData, "defaultDueDays") ?? 1),
      customerType: customerTypeInput ? enumValue(CustomerType, customerTypeInput, CustomerType.OTHER) : null,
      stage: stageInput ? enumValue(LeadStage, stageInput, LeadStage.NEW) : null,
      isActive: true
    }
  });
  await safeWriteAuditLog({
    tenantId: tenant.id,
    userId: user.id,
    action: "task_template_created",
    entityType: "TaskTemplate",
    entityId: template.id,
    metadata: { name: template.name, type: template.type, priority: template.priority }
  });

  revalidatePath(`/app/${tenantSlug}/task-templates`);
}

export async function updateTaskTemplate(tenantSlug: string, templateId: string, formData: FormData) {
  const { user, tenant } = await requireTenantAccess(tenantSlug, ["TENANT_ADMIN", "OPERATOR"]);
  const name = text(formData, "name");
  const title = text(formData, "title");
  if (!name || !title) return;
  const customerTypeInput = text(formData, "customerType");
  const stageInput = text(formData, "stage");

  const template = await prisma.taskTemplate.update({
    where: { id: templateId, tenantId: tenant.id },
    data: {
      name,
      title,
      description: text(formData, "description"),
      type: enumValue(FollowTaskType, text(formData, "type"), FollowTaskType.CUSTOM),
      priority: enumValue(FollowTaskPriority, text(formData, "priority"), FollowTaskPriority.NORMAL),
      defaultDueDays: Number(text(formData, "defaultDueDays") ?? 1),
      customerType: customerTypeInput ? enumValue(CustomerType, customerTypeInput, CustomerType.OTHER) : null,
      stage: stageInput ? enumValue(LeadStage, stageInput, LeadStage.NEW) : null
    }
  });
  await safeWriteAuditLog({
    tenantId: tenant.id,
    userId: user.id,
    action: "task_template_updated",
    entityType: "TaskTemplate",
    entityId: template.id,
    metadata: { name: template.name, type: template.type, priority: template.priority }
  });

  revalidatePath(`/app/${tenantSlug}/task-templates`);
}

export async function deactivateTaskTemplate(tenantSlug: string, templateId: string) {
  const { user, tenant } = await requireTenantAccess(tenantSlug, ["TENANT_ADMIN", "OPERATOR"]);
  const template = await prisma.taskTemplate.update({
    where: { id: templateId, tenantId: tenant.id },
    data: { isActive: false }
  });
  await safeWriteAuditLog({
    tenantId: tenant.id,
    userId: user.id,
    action: "task_template_deactivated",
    entityType: "TaskTemplate",
    entityId: template.id,
    metadata: { name: template.name }
  });

  revalidatePath(`/app/${tenantSlug}/task-templates`);
}

export async function bulkUpdateLeads(tenantSlug: string, formData: FormData) {
  const { user, tenant } = await requireTenantAccess(tenantSlug, ["TENANT_ADMIN", "OPERATOR"]);
  const leadIds = formData
    .getAll("leadIds")
    .map((value) => (typeof value === "string" ? value : ""))
    .filter(Boolean);
  const actionType = text(formData, "bulkAction");
  if (!leadIds.length || !actionType) return;

  const leads = await prisma.lead.findMany({
    where: { id: { in: leadIds }, tenantId: tenant.id }
  });
  if (!leads.length) return;
  const safeLeadIds = leads.map((lead) => lead.id);

  if (actionType === "assign") {
    const ownerId = text(formData, "ownerId");
    const owner = ownerId
      ? await prisma.user.findFirst({
          where: { id: ownerId, tenantId: tenant.id, status: "active", role: { in: [UserRole.SALES, UserRole.OPERATOR] } }
        })
      : null;
    await prisma.lead.updateMany({
      where: { id: { in: safeLeadIds }, tenantId: tenant.id },
      data: { ownerId: owner?.id ?? null }
    });
    await safeWriteAuditLog({
      tenantId: tenant.id,
      userId: user.id,
      action: "lead_bulk_assigned",
      entityType: "Lead",
      metadata: { leadIds: safeLeadIds, ownerId: owner?.id ?? null, count: safeLeadIds.length }
    });
    if (owner?.id) {
      for (const lead of leads) {
        const taskLead = { ...lead, ownerId: owner.id };
        await createFirstFollowTask(taskLead, { userId: user.id });
        await createHighIntentTask(taskLead, { userId: user.id });
      }
    }
  }

  if (actionType === "stage" || actionType === "reactivate") {
    const stage = actionType === "reactivate" ? LeadStage.TO_REACTIVATE : enumValue(LeadStage, text(formData, "stage"), LeadStage.CONTACTED);
    await prisma.lead.updateMany({
      where: { id: { in: safeLeadIds }, tenantId: tenant.id },
      data: {
        stage,
        dealStatus: stage === "DEAL_DONE" ? "WON" : stage === "LOST" ? "LOST" : undefined
      }
    });
    await safeWriteAuditLog({
      tenantId: tenant.id,
      userId: user.id,
      action: actionType === "reactivate" ? "lead_bulk_reactivated" : "lead_bulk_stage_updated",
      entityType: "Lead",
      metadata: { leadIds: safeLeadIds, stage, count: safeLeadIds.length }
    });
    for (const lead of leads) {
      await createStageDrivenTask({ ...lead, stage }, stage, { userId: user.id });
    }
  }

  if (actionType === "nextFollow") {
    const nextFollowAt = parseDate(text(formData, "nextFollowAt"));
    if (!nextFollowAt) return;
    await prisma.lead.updateMany({
      where: { id: { in: safeLeadIds }, tenantId: tenant.id },
      data: { nextFollowAt }
    });
    await safeWriteAuditLog({
      tenantId: tenant.id,
      userId: user.id,
      action: "lead_bulk_next_follow_set",
      entityType: "Lead",
      metadata: { leadIds: safeLeadIds, nextFollowAt: nextFollowAt.toISOString(), count: safeLeadIds.length }
    });
    for (const lead of leads) {
      await createNextFollowTask({ ...lead, nextFollowAt }, nextFollowAt, { userId: user.id });
    }
  }

  if (actionType === "tag") {
    const tagName = text(formData, "tagName");
    if (!tagName) return;
    await prisma.leadTag.createMany({
      data: safeLeadIds.map((leadId) => ({
        tenantId: tenant.id,
        leadId,
        tagName,
        tagGroup: "CUSTOM" as const
      }))
    });
    await safeWriteAuditLog({
      tenantId: tenant.id,
      userId: user.id,
      action: "lead_bulk_tag_added",
      entityType: "LeadTag",
      metadata: { leadIds: safeLeadIds, tagName, count: safeLeadIds.length }
    });
  }

  revalidatePath(`/app/${tenantSlug}/leads`);
  revalidatePath(`/app/${tenantSlug}/todos`);
  revalidatePath(`/app/${tenantSlug}/dashboard`);
}

export async function generateReplySuggestionsForLead(tenantSlug: string, leadId: string, formData: FormData) {
  const { user, tenant, lead } = await requireLeadAccess(tenantSlug, leadId);
  const customerQuestion = text(formData, "customerQuestion");
  if (!customerQuestion) return;

  const [strategy, materials, businessLines] = await Promise.all([
    prisma.customerTypeStrategy.findUnique({
      where: { tenantId_customerType: { tenantId: tenant.id, customerType: lead.customerType } }
    }),
    prisma.material.findMany({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: "desc" }
    }),
    prisma.businessLine.findMany({
      where: {
        tenantId: tenant.id,
        status: "ACTIVE"
      },
      orderBy: [{ priority: "asc" }, { updatedAt: "desc" }]
    })
  ]);

  const generatedAt = new Date();
  const suggestions = generateReplySuggestions({
    lead: {
      name: lead.name,
      customerType: lead.customerType,
      stage: lead.stage,
      needType: lead.needType
    },
    strategy,
    materials,
    businessLines,
    customerQuestion
  });

  const questionType = detectQuestionType(customerQuestion);
  const tagTopic = detectTagSuggestionTopic(customerQuestion);

  const createdSuggestions = await prisma.$transaction(
    suggestions.map((suggestion) =>
      prisma.replySuggestion.create({
        data: {
          tenantId: tenant.id,
          leadId: lead.id,
          userId: user.id,
          customerQuestion,
          suggestionText: suggestion.suggestionText,
          recommendedMaterialIds: suggestion.recommendedMaterialIds,
          suggestedTags: suggestion.suggestedTags,
          recommendedNextAction: suggestion.recommendedNextAction,
          style: suggestion.style,
          warning: suggestion.warning,
          createdAt: generatedAt
        }
      })
    )
  );

  for (const suggestion of createdSuggestions) {
    await safeWriteAuditLog({
      tenantId: tenant.id,
      userId: user.id,
      action: "reply_suggestion_generated",
      entityType: "ReplySuggestion",
      entityId: suggestion.id,
      metadata: {
        leadId: lead.id,
        customerType: lead.customerType,
        questionType,
        style: suggestion.style
      }
    });
  }

  if (createdSuggestions[0]) {
    await safeWriteAuditLog({
      tenantId: tenant.id,
      userId: user.id,
      action: "reply_tag_suggested",
      entityType: "ReplySuggestion",
      entityId: createdSuggestions[0].id,
      metadata: {
        leadId: lead.id,
        replySuggestionId: createdSuggestions[0].id,
        customerType: lead.customerType,
        questionType: tagTopic,
        suggestedTagsCount: suggestions[0]?.suggestedTags.length ?? 0,
        questionPreview: truncateAuditQuestion(customerQuestion)
      }
    });
  }

  revalidatePath(`/app/${tenantSlug}/leads/${leadId}`);
  revalidatePath(`/app/${tenantSlug}/audit-logs`);
}

export async function confirmReplySuggestionTags(tenantSlug: string, leadId: string, formData: FormData) {
  const { user, tenant, lead } = await requireLeadAccess(tenantSlug, leadId);
  const suggestionId = text(formData, "suggestionId");
  if (!suggestionId) return;

  const suggestion = await prisma.replySuggestion.findFirst({
    where: {
      id: suggestionId,
      tenantId: tenant.id,
      leadId: lead.id
    }
  });
  if (!suggestion) return;

  const suggestedTags = parseSuggestedTags(suggestion.suggestedTags);
  if (!suggestedTags.length) return;

  const selectedKeys = formData
    .getAll("selectedTags")
    .map((value) => (typeof value === "string" ? value : ""))
    .filter(Boolean);
  if (!selectedKeys.length) return;

  const selectedTags = suggestedTags.filter((tag) => selectedKeys.includes(getSuggestedTagKey(tag)));
  if (!selectedTags.length) return;

  const existingTags = await prisma.leadTag.findMany({
    where: {
      tenantId: tenant.id,
      leadId: lead.id
    }
  });
  const existingTagKeys = new Set(existingTags.map((tag) => `${tag.tagGroup}::${tag.tagName}`));

  const tagsToCreate = selectedTags.filter((tag) => {
    const storedGroup = mapSuggestedTagGroupToLeadTagGroup(tag.tagGroup);
    return !existingTagKeys.has(`${storedGroup}::${tag.tagName}`);
  });

  if (tagsToCreate.length) {
    await prisma.leadTag.createMany({
      data: tagsToCreate.map((tag) => ({
        tenantId: tenant.id,
        leadId: lead.id,
        tagName: tag.tagName,
        tagGroup: mapSuggestedTagGroupToLeadTagGroup(tag.tagGroup)
      }))
    });
  }

  const questionType = detectTagSuggestionTopic(suggestion.customerQuestion);
  await safeWriteAuditLog({
    tenantId: tenant.id,
    userId: user.id,
    action: "reply_tag_confirmed",
    entityType: "LeadTag",
    entityId: lead.id,
    metadata: {
      leadId: lead.id,
      replySuggestionId: suggestion.id,
      customerType: lead.customerType,
      questionType,
      confirmedTags: selectedTags.map((tag) => tag.tagName),
      confirmedTagsCount: selectedTags.length,
      createdTagsCount: tagsToCreate.length,
      questionPreview: truncateAuditQuestion(suggestion.customerQuestion)
    }
  });

  revalidatePath(`/app/${tenantSlug}/leads/${leadId}`);
  revalidatePath(`/app/${tenantSlug}/audit-logs`);
  revalidatePath(`/app/${tenantSlug}/dashboard`);
}

export async function saveReplySuggestionAsFollowUp(tenantSlug: string, leadId: string, formData: FormData) {
  const { user, tenant, lead } = await requireLeadAccess(tenantSlug, leadId);
  const suggestionId = text(formData, "suggestionId");
  if (!suggestionId) return;

  const suggestion = await prisma.replySuggestion.findFirst({
    where: {
      id: suggestionId,
      tenantId: tenant.id,
      leadId: lead.id
    }
  });
  if (!suggestion) return;

  const questionType = detectQuestionType(suggestion.customerQuestion);
  const followUp = await prisma.followUp.create({
    data: {
      tenantId: tenant.id,
      leadId: lead.id,
      userId: user.id,
      content: suggestion.suggestionText,
      nextAction: suggestion.recommendedNextAction,
      stageBefore: lead.stage,
      stageAfter: lead.stage
    }
  });

  await prisma.lead.update({
    where: { id: lead.id },
    data: { lastFollowAt: new Date() }
  });

  await safeWriteAuditLog({
    tenantId: tenant.id,
    userId: user.id,
    action: "followup_created",
    entityType: "FollowUp",
    entityId: followUp.id,
    metadata: {
      leadId: lead.id,
      stageBefore: lead.stage,
      stageAfter: lead.stage,
      nextFollowAt: null
    }
  });
  await safeWriteAuditLog({
    tenantId: tenant.id,
    userId: user.id,
    action: "reply_suggestion_saved_as_followup",
    entityType: "ReplySuggestion",
    entityId: suggestion.id,
    metadata: {
      leadId: lead.id,
      customerType: lead.customerType,
      questionType,
      style: suggestion.style
    }
  });

  revalidatePath(`/app/${tenantSlug}/leads/${leadId}`);
  revalidatePath(`/app/${tenantSlug}/todos`);
  revalidatePath(`/app/${tenantSlug}/dashboard`);
  revalidatePath(`/app/${tenantSlug}/audit-logs`);
}

export async function updateStrategy(tenantSlug: string, strategyId: string, formData: FormData) {
  const { user, tenant } = await requireTenantAccess(tenantSlug, ["TENANT_ADMIN", "OPERATOR"]);

  const strategy = await prisma.customerTypeStrategy.update({
    where: { id: strategyId, tenantId: tenant.id },
    data: {
      name: text(formData, "name") ?? "",
      painPoints: splitLines(text(formData, "painPoints")),
      firstMaterials: splitLines(text(formData, "firstMaterials")),
      welcomeScript: text(formData, "welcomeScript") ?? "",
      day3Script: text(formData, "day3Script") ?? "",
      day7Script: text(formData, "day7Script") ?? "",
      day15Script: text(formData, "day15Script") ?? "",
      manualTriggerRules: splitLines(text(formData, "manualTriggerRules")),
      recommendedNextAction: text(formData, "recommendedNextAction") ?? "",
      recommendedPrivateContent: text(formData, "recommendedPrivateContent") ?? ""
    }
  });
  await safeWriteAuditLog({
    tenantId: tenant.id,
    userId: user.id,
    action: "strategy_updated",
    entityType: "CustomerTypeStrategy",
    entityId: strategy.id,
    metadata: { customerType: strategy.customerType, name: strategy.name }
  });

  revalidatePath(`/app/${tenantSlug}/strategies`);
}

export async function createMaterial(tenantSlug: string, formData: FormData) {
  const { user, tenant } = await requireTenantAccess(tenantSlug, ["TENANT_ADMIN", "OPERATOR"]);
  const title = text(formData, "title");
  const url = text(formData, "url");
  if (!title || !url) return;
  const customerTypeInput = text(formData, "customerType");
  const customerType = customerTypeInput ? enumValue(CustomerType, customerTypeInput, CustomerType.OTHER) : null;

  const material = await prisma.material.create({
    data: {
      tenantId: tenant.id,
      title,
      url,
      description: text(formData, "description"),
      type: enumValue(MaterialType, text(formData, "type"), MaterialType.link),
      customerType
    }
  });
  await safeWriteAuditLog({
    tenantId: tenant.id,
    userId: user.id,
    action: "material_created",
    entityType: "Material",
    entityId: material.id,
    metadata: { title: material.title, customerType: material.customerType, type: material.type }
  });

  revalidatePath(`/app/${tenantSlug}/materials`);
}

export async function updateMaterial(tenantSlug: string, materialId: string, formData: FormData) {
  const { user, tenant } = await requireTenantAccess(tenantSlug, ["TENANT_ADMIN", "OPERATOR"]);
  const title = text(formData, "title");
  const url = text(formData, "url");
  if (!title || !url) return;
  const customerTypeInput = text(formData, "customerType");
  const customerType = customerTypeInput ? enumValue(CustomerType, customerTypeInput, CustomerType.OTHER) : null;

  const material = await prisma.material.update({
    where: { id: materialId, tenantId: tenant.id },
    data: {
      title,
      url,
      description: text(formData, "description"),
      type: enumValue(MaterialType, text(formData, "type"), MaterialType.link),
      customerType
    }
  });
  await safeWriteAuditLog({
    tenantId: tenant.id,
    userId: user.id,
    action: "material_updated",
    entityType: "Material",
    entityId: material.id,
    metadata: { title: material.title, customerType: material.customerType, type: material.type }
  });

  revalidatePath(`/app/${tenantSlug}/materials`);
  revalidatePath(`/app/${tenantSlug}/strategies`);
}

function parseBusinessLineCustomerTypes(formData: FormData) {
  const allowed = new Set(Object.values(CustomerType));
  return formData
    .getAll("targetCustomerTypes")
    .map((value) => (typeof value === "string" ? value : ""))
    .filter((value): value is CustomerType => allowed.has(value as CustomerType));
}

function parseBusinessLineIds(formData: FormData, key: "recommendedMaterialIds" | "recommendedTaskTemplateIds") {
  return formData
    .getAll(key)
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean);
}

function getBusinessLinePayload(formData: FormData) {
  const name = text(formData, "name");
  if (!name) return null;

  const targetCustomerTypes = parseBusinessLineCustomerTypes(formData);
  const recommendedTags = parseBusinessLineRecommendedTagText(text(formData, "recommendedTags"));
  const recommendedMaterialIds = parseBusinessLineIds(formData, "recommendedMaterialIds");
  const recommendedTaskTemplateIds = parseBusinessLineIds(formData, "recommendedTaskTemplateIds");

  return {
    name,
    slug: buildBusinessLineSlug(name, text(formData, "slug")),
    description: text(formData, "description"),
    status: enumValue(BusinessLineStatus, text(formData, "status"), BusinessLineStatus.ACTIVE),
    category: enumValue(BusinessLineCategory, text(formData, "category"), BusinessLineCategory.OTHER),
    priority: parseNumber(text(formData, "priority"), 100),
    targetCustomerTypes: targetCustomerTypes.length ? targetCustomerTypes : [],
    recommendedTagNames: recommendedTags.length ? recommendedTags : [],
    recommendedMaterialIds: recommendedMaterialIds.length ? recommendedMaterialIds : [],
    recommendedTaskTemplateIds: recommendedTaskTemplateIds.length ? recommendedTaskTemplateIds : [],
    defaultNextAction: text(formData, "defaultNextAction"),
    notes: text(formData, "notes")
  };
}

export async function createBusinessLine(tenantSlug: string, formData: FormData) {
  const { user, tenant } = await requireTenantAccess(tenantSlug, ["TENANT_ADMIN", "OPERATOR"]);
  const payload = getBusinessLinePayload(formData);
  if (!payload) return;

  const businessLine = await prisma.businessLine.create({
    data: {
      tenantId: tenant.id,
      ...payload
    }
  });

  await safeWriteAuditLog({
    tenantId: tenant.id,
    userId: user.id,
    action: "business_line_created",
    entityType: "BusinessLine",
    entityId: businessLine.id,
    metadata: {
      name: businessLine.name,
      slug: businessLine.slug,
      status: businessLine.status,
      category: businessLine.category
    }
  });

  revalidatePath(`/app/${tenantSlug}/business-lines`);
}

export async function updateBusinessLine(tenantSlug: string, businessLineId: string, formData: FormData) {
  const { user, tenant } = await requireTenantAccess(tenantSlug, ["TENANT_ADMIN", "OPERATOR"]);
  const payload = getBusinessLinePayload(formData);
  if (!payload) return;

  const businessLine = await prisma.businessLine.update({
    where: { id: businessLineId, tenantId: tenant.id },
    data: payload
  });

  await safeWriteAuditLog({
    tenantId: tenant.id,
    userId: user.id,
    action: "business_line_updated",
    entityType: "BusinessLine",
    entityId: businessLine.id,
    metadata: {
      name: businessLine.name,
      slug: businessLine.slug,
      status: businessLine.status,
      category: businessLine.category
    }
  });

  revalidatePath(`/app/${tenantSlug}/business-lines`);
}

export async function updateBusinessLineStatus(tenantSlug: string, businessLineId: string, status: BusinessLineStatus) {
  const { user, tenant } = await requireTenantAccess(tenantSlug, ["TENANT_ADMIN", "OPERATOR"]);
  const businessLine = await prisma.businessLine.update({
    where: { id: businessLineId, tenantId: tenant.id },
    data: { status }
  });

  await safeWriteAuditLog({
    tenantId: tenant.id,
    userId: user.id,
    action: "business_line_status_updated",
    entityType: "BusinessLine",
    entityId: businessLine.id,
    metadata: {
      name: businessLine.name,
      slug: businessLine.slug,
      status: businessLine.status
    }
  });

  revalidatePath(`/app/${tenantSlug}/business-lines`);
}

export async function upsertWeComConfig(tenantSlug: string, formData: FormData) {
  const { tenant } = await requireTenantAccess(tenantSlug, ["TENANT_ADMIN", "OPERATOR"]);

  await prisma.weComConfig.upsert({
    where: { tenantId: tenant.id },
    update: {
      corpId: text(formData, "corpId"),
      agentId: text(formData, "agentId"),
      secretEncrypted: text(formData, "secretEncrypted"),
      token: text(formData, "token"),
      encodingAESKey: text(formData, "encodingAESKey"),
      callbackUrl: text(formData, "callbackUrl"),
      status: enumValue(WeComConfigStatus, text(formData, "status"), WeComConfigStatus.draft)
    },
    create: {
      tenantId: tenant.id,
      corpId: text(formData, "corpId"),
      agentId: text(formData, "agentId"),
      secretEncrypted: text(formData, "secretEncrypted"),
      token: text(formData, "token"),
      encodingAESKey: text(formData, "encodingAESKey"),
      callbackUrl: text(formData, "callbackUrl"),
      status: enumValue(WeComConfigStatus, text(formData, "status"), WeComConfigStatus.draft)
    }
  });

  revalidatePath(`/app/${tenantSlug}/wecom`);
}
