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
  CommunicationComplianceChannel,
  CommunicationComplianceProvider,
  CommunicationComplianceStatus,
  CustomerType,
  FormType,
  FollowTaskPriority,
  FollowTaskStatus,
  FollowTaskType,
  IntentionLevel,
  LeadSource,
  LeadStage,
  MarketClawFeedbackStatus,
  MarketClawKnowledgeReviewStatus,
  MarketClawKnowledgeScopeLevel,
  MarketClawKnowledgeStatus,
  MarketClawKnowledgeType,
  MarketClawKnowledgeVisibility,
  MarketClawReplySourceScope,
  MarketClawReplyUseStatus,
  MarketClawReviewResult,
  MarketClawTrainingRating,
  MarketClawTrainingReviewStatus,
  MarketClawTrainingScope,
  MaterialType,
  NeedType,
  TagGroup,
  TenantStatus,
  UserRole,
  WeComConfigStatus,
  type Prisma
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { safeWriteAuditLog } from "@/lib/audit";
import {
  canAccessMarketClawKnowledge,
  canAccessMarketClawReplies,
  canAccessMarketClawTraining,
  canReviewMarketClawTraining,
  canImportTenantLeads,
  canManageCommunicationCompliance,
  requireLeadAccess,
  requirePlatformAdmin,
  requireTenantAccess
} from "@/lib/auth";
import { buildBusinessLineSlug, parseBusinessLineRecommendedTagText } from "@/lib/business-lines";
import {
  CNAS_BUSINESS_LINE_NAME,
  CNAS_BUSINESS_LINE_SLUG,
  CNAS_SOURCE_PAGE,
  CNAS_TARGET_TENANT_SLUG,
  addMinutes,
  buildCnasExtraData,
  buildCnasLeadMessage,
  getCnasDiagnosisResult,
  getCnasResultHref,
  getCnasStructuredTags,
  type CnasFormValues
} from "@/lib/cnas";
import {
  buildAutoImportFieldMapping,
  buildImportBatchPreview,
  buildImportDefaultsFromForm,
  buildImportMappingFromForm,
  completeImportBatch,
  parseImportDefaultSettings,
  parseCsvText,
  readUploadedImportText,
  rebuildImportBatchPreview
} from "@/lib/imports";
import {
  generateMarketClawReply,
  materialTitlesFromIds,
  parseMarketClawSuggestedTags,
  parseMarketClawSuggestedTask,
  splitKnowledgeIdsByScope,
  parseMarketClawTextArray
} from "@/lib/market-claw";
import { prisma } from "@/lib/prisma";
import { parseSourceAttributionFromFormData, upsertLeadSourceAttribution } from "@/lib/source-attribution";
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

function stageRank(stage: LeadStage) {
  const ranks: Record<LeadStage, number> = {
    NEW: 0,
    MATERIAL_SENT: 1,
    CONTACTED: 2,
    DIAGNOSED: 3,
    QUOTED: 4,
    PENDING_DEAL: 5,
    DEAL_DONE: 6,
    LOST: 6,
    TO_REACTIVATE: 2
  };
  return ranks[stage];
}

function intentionRank(level: IntentionLevel) {
  const ranks: Record<IntentionLevel, number> = {
    LOW: 0,
    MEDIUM: 1,
    HIGH: 2,
    STRONG: 3
  };
  return ranks[level];
}

function mergeJsonRecord(existing: unknown, next: Record<string, unknown>): Prisma.InputJsonValue {
  if (!existing || typeof existing !== "object" || Array.isArray(existing)) {
    return next as Prisma.InputJsonValue;
  }
  return { ...(existing as Record<string, unknown>), ...next } as Prisma.InputJsonValue;
}

function truncateAuditQuestion(question: string, maxLength = 100) {
  return question.length <= maxLength ? question : `${question.slice(0, Math.max(0, maxLength - 3))}...`;
}

function truncateFileName(fileName: string, maxLength = 120) {
  return fileName.length <= maxLength ? fileName : `${fileName.slice(0, Math.max(0, maxLength - 3))}...`;
}

function buildCommunicationComplianceMessageUrl(
  tenantSlug: string,
  channel: CommunicationComplianceChannel,
  type: "success" | "error",
  message: string
) {
  const params = new URLSearchParams({
    messageChannel: channel,
    messageType: type,
    message
  });
  return `/app/${tenantSlug}/communication-compliance?${params.toString()}`;
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

export async function submitCnasPathCheckForm(formData: FormData) {
  const tenant = await prisma.tenant.findUnique({ where: { slug: CNAS_TARGET_TENANT_SLUG } });
  if (!tenant || tenant.status !== "active") {
    throw new Error("当前 CNAS 项目租户不可用。");
  }

  const contactName = text(formData, "contactName");
  const company = text(formData, "company");
  const phone = text(formData, "phone");
  const labType = text(formData, "labType");
  const currentStage = text(formData, "currentStage");
  const scopeClarity = text(formData, "scopeClarity");
  const readiness = text(formData, "readiness");
  const primaryConcern = text(formData, "primaryConcern");
  const startPlan = text(formData, "startPlan");
  const wecomAdded = text(formData, "wecomAdded");

  if (!contactName || !company || !phone || !labType || !currentStage || !scopeClarity || !readiness || !primaryConcern || !startPlan || !wecomAdded) {
    throw new Error("请完整填写 CNAS 路径判断问卷。");
  }

  const values: CnasFormValues = {
    company,
    contactName,
    phone,
    labType,
    currentStage,
    scopeClarity,
    readiness,
    primaryConcern,
    startPlan,
    wecomAdded,
    note: text(formData, "note"),
    sourcePage: text(formData, "sourcePage") ?? text(formData, "source_page") ?? CNAS_SOURCE_PAGE,
    utmSource: text(formData, "utm_source"),
    utmMedium: text(formData, "utm_medium"),
    utmCampaign: text(formData, "utm_campaign"),
    utmContent: text(formData, "utm_content"),
    utmTerm: text(formData, "utm_term"),
    submittedAt: new Date().toISOString()
  };

  const result = getCnasDiagnosisResult(values);
  const owner = await getDefaultTenantUser(tenant.id);
  const businessLine = await prisma.businessLine.findFirst({
    where: {
      tenantId: tenant.id,
      slug: CNAS_BUSINESS_LINE_SLUG,
      status: "ACTIVE"
    }
  });

  const existingLead = await prisma.lead.findFirst({
    where: {
      tenantId: tenant.id,
      OR: [{ phone }, { name: contactName, company }]
    },
    orderBy: { updatedAt: "desc" }
  });

  const dueAt = owner?.id ? addMinutes(new Date(), result.dueInMinutes) : null;
  const nextExtraData = buildCnasExtraData(values, result);
  const leadPayload = {
    tenantId: tenant.id,
    name: contactName,
    phone,
    company,
    source: result.leadSource,
    customerType: CustomerType.OTHER,
    needType: NeedType.BOOK_CONSULTATION,
    intentionLevel:
      existingLead && intentionRank(existingLead.intentionLevel) > intentionRank(result.intentionLevel)
        ? existingLead.intentionLevel
        : result.intentionLevel,
    stage: existingLead && stageRank(existingLead.stage) > stageRank(LeadStage.DIAGNOSED) ? existingLead.stage : LeadStage.DIAGNOSED,
    message: buildCnasLeadMessage(values, result),
    ownerId: existingLead?.ownerId ?? owner?.id ?? null,
    nextFollowAt: dueAt,
    extraData: mergeJsonRecord(existingLead?.extraData, nextExtraData)
  };

  const lead = existingLead
    ? await prisma.lead.update({
        where: { id: existingLead.id },
        data: leadPayload
      })
    : await prisma.lead.create({
        data: leadPayload
      });

  const intakeForm = await prisma.intakeForm.create({
    data: {
      tenantId: tenant.id,
      formType: FormType.cnas_path_check,
      source: result.leadSource,
      name: contactName,
      phone,
      company,
      customerType: CustomerType.OTHER,
      needType: NeedType.BOOK_CONSULTATION,
      message: buildCnasLeadMessage(values, result),
      extraData: nextExtraData,
      createdLeadId: lead.id
    }
  });

  await upsertLeadSourceAttribution({
    db: prisma,
    tenantId: tenant.id,
    leadId: lead.id,
    attribution: parseSourceAttributionFromFormData(formData, {
      sourceChannel: "CNAS问卷",
      sourceProject: CNAS_BUSINESS_LINE_NAME,
      sourcePage: values.sourcePage,
      firstSeenAt: new Date(),
      submittedAt: new Date()
    })
  });

  const existingTags = await prisma.leadTag.findMany({
    where: {
      tenantId: tenant.id,
      leadId: lead.id
    }
  });
  const existingTagKeys = new Set(existingTags.map((tag) => `${tag.tagGroup}::${tag.tagName}`));
  const tagsToCreate = getCnasStructuredTags(result).filter((tag) => !existingTagKeys.has(`${tag.tagGroup}::${tag.tagName}`));

  if (tagsToCreate.length) {
    await prisma.leadTag.createMany({
      data: tagsToCreate.map((tag) => ({
        tenantId: tenant.id,
        leadId: lead.id,
        tagName: tag.tagName,
        tagGroup: tag.tagGroup
      }))
    });
  }

  await safeWriteAuditLog({
    tenantId: tenant.id,
    action: "cnas_form_submitted",
    entityType: "Lead",
    entityId: lead.id,
    metadata: {
      leadId: lead.id,
      businessLine: businessLine?.name ?? CNAS_BUSINESS_LINE_NAME,
      diagnosisType: result.diagnosisType,
      intentionLevel: result.intentionLevel,
      labType: values.labType,
      currentStage: values.currentStage,
      sourcePage: values.sourcePage,
      utm_source: values.utmSource ?? null,
      utm_medium: values.utmMedium ?? null,
      utm_campaign: values.utmCampaign ?? null,
      ownerId: lead.ownerId ?? null
    }
  });
  await safeWriteAuditLog({
    tenantId: tenant.id,
    action: "cnas_diagnosis_created",
    entityType: "IntakeForm",
    entityId: intakeForm.id,
    metadata: {
      leadId: lead.id,
      businessLine: businessLine?.name ?? CNAS_BUSINESS_LINE_NAME,
      diagnosisType: result.diagnosisType,
      intentionLevel: result.intentionLevel,
      labType: values.labType,
      currentStage: values.currentStage,
      sourcePage: values.sourcePage
    }
  });

  if (lead.ownerId && dueAt) {
    await createTaskWithAudit({
      tenantId: tenant.id,
      leadId: lead.id,
      ownerId: lead.ownerId,
      title: result.taskTitle,
      description: result.taskDescription,
      type:
        result.diagnosisType === "A"
          ? FollowTaskType.PHONE_CALL
          : result.diagnosisType === "B"
            ? FollowTaskType.SEND_MATERIAL
            : FollowTaskType.WECHAT_FOLLOW,
      priority: result.taskPriority,
      dueAt,
      auditAction: "cnas_follow_task_created",
      auditMetadata: {
        businessLine: businessLine?.name ?? CNAS_BUSINESS_LINE_NAME,
        diagnosisType: result.diagnosisType,
        intentionLevel: result.intentionLevel,
        sourcePage: values.sourcePage
      }
    });
  }

  redirect(getCnasResultHref(result));
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

export async function previewLeadImportBatch(tenantSlug: string, formData: FormData) {
  const { user, tenant } = await requireTenantAccess(tenantSlug, ["TENANT_ADMIN", "OPERATOR"]);
  if (!canImportTenantLeads(user.role)) {
    redirect("/forbidden");
  }

  const uploaded = await readUploadedImportText(formData);
  const { headers, rawRows } = parseCsvText(uploaded.content);
  if (!headers.length) {
    throw new Error("CSV 表头不能为空。");
  }

  const mapping = buildImportMappingFromForm(headers, formData, buildAutoImportFieldMapping(headers));
  const defaults = buildImportDefaultsFromForm(formData);
  const result = await buildImportBatchPreview({
    prisma,
    tenantId: tenant.id,
    createdById: user.id,
    fileName: truncateFileName(uploaded.fileName),
    fileType: uploaded.fileType || "text/csv",
    rawRows,
    headers,
    mapping,
    defaults
  });

  await safeWriteAuditLog({
    tenantId: tenant.id,
    userId: user.id,
    action: "import_batch_created",
    entityType: "ImportBatch",
    entityId: result.batch.id,
    metadata: {
      batchId: result.batch.id,
      fileName: result.batch.fileName,
      totalRows: result.summary.totalRows,
      successRows: result.summary.successRows,
      failedRows: result.summary.failedRows,
      duplicateRows: result.summary.duplicateRows,
      autoCreateFirstTask: defaults.autoCreateFirstTask,
      defaultOwnerId: defaults.defaultOwnerId,
      defaultTags: defaults.defaultTags,
      defaultBusinessLineIds: defaults.defaultBusinessLineIds
    }
  });

  revalidatePath(`/app/${tenantSlug}/imports`);
}

export async function refreshLeadImportBatchPreview(tenantSlug: string, formData: FormData) {
  const { user, tenant } = await requireTenantAccess(tenantSlug, ["TENANT_ADMIN", "OPERATOR"]);
  if (!canImportTenantLeads(user.role)) {
    redirect("/forbidden");
  }

  const batchId = text(formData, "batchId");
  if (!batchId) {
    throw new Error("缺少导入批次。");
  }

  await rebuildImportBatchPreview({
    prisma,
    tenantId: tenant.id,
    batchId,
    formData
  });

  revalidatePath(`/app/${tenantSlug}/imports`);
}

export async function completeLeadImportBatch(tenantSlug: string, formData: FormData) {
  const { user, tenant } = await requireTenantAccess(tenantSlug, ["TENANT_ADMIN", "OPERATOR"]);
  if (!canImportTenantLeads(user.role)) {
    redirect("/forbidden");
  }

  const batchId = text(formData, "batchId");
  if (!batchId) {
    throw new Error("缺少导入批次。");
  }

  try {
    const batch = await completeImportBatch({
      prisma,
      tenantId: tenant.id,
      batchId,
      createdById: user.id
    });
    const defaults = parseImportDefaultSettings(batch);

    await safeWriteAuditLog({
      tenantId: tenant.id,
      userId: user.id,
      action: "import_batch_completed",
      entityType: "ImportBatch",
      entityId: batch.id,
      metadata: {
        batchId: batch.id,
        fileName: batch.fileName,
        totalRows: batch.totalRows,
        successRows: batch.successRows,
        failedRows: batch.failedRows,
        duplicateRows: batch.duplicateRows,
        autoCreateFirstTask: batch.autoCreateFirstTask,
        defaultOwnerId: defaults.defaultOwnerId,
        defaultTags: defaults.defaultTags,
        defaultBusinessLineIds: defaults.defaultBusinessLineIds
      }
    });
  } catch (error) {
    const batchIdForAudit = batchId;
    await safeWriteAuditLog({
      tenantId: tenant.id,
      userId: user.id,
      action: "import_batch_failed",
      entityType: "ImportBatch",
      entityId: batchIdForAudit,
      metadata: {
        batchId: batchIdForAudit,
        message: error instanceof Error ? error.message : "unknown_error"
      }
    });
    throw error;
  }

  revalidatePath(`/app/${tenantSlug}/imports`);
  revalidatePath(`/app/${tenantSlug}/leads`);
  revalidatePath(`/app/${tenantSlug}/todos`);
  revalidatePath(`/app/${tenantSlug}/dashboard`);
  revalidatePath(`/app/${tenantSlug}/audit-logs`);
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

function parseTagGroup(value?: string) {
  return value && Object.values(TagGroup).includes(value as TagGroup) ? (value as TagGroup) : TagGroup.CUSTOM;
}

function parseMarketClawCustomerTypes(formData: FormData, key: string) {
  const allowed = new Set(Object.values(CustomerType));
  return formData
    .getAll(key)
    .map((value) => (typeof value === "string" ? value : ""))
    .filter((value): value is CustomerType => allowed.has(value as CustomerType));
}

function parseMarketClawStages(formData: FormData, key: string) {
  const allowed = new Set(Object.values(LeadStage));
  return formData
    .getAll(key)
    .map((value) => (typeof value === "string" ? value : ""))
    .filter((value): value is LeadStage => allowed.has(value as LeadStage));
}

function parseMarketClawStringArray(formData: FormData, key: string) {
  return splitLines(text(formData, key));
}

function inferMarketClawDepartmentName(user: { role: UserRole; name: string }) {
  if (user.role === "SALES") return "销售部";
  if (user.role === "OPERATOR") return "运营部";
  if (user.role === "TENANT_ADMIN") return "业务管理部";
  return `${user.name}所属部门`;
}

function parseMarketClawTrainingScope(formData: FormData, fallback: MarketClawTrainingScope) {
  return enumValue(MarketClawTrainingScope, text(formData, "trainingScope"), fallback);
}

function parseMarketClawKnowledgeScope(formData: FormData, fallback: MarketClawKnowledgeScopeLevel) {
  return enumValue(MarketClawKnowledgeScopeLevel, text(formData, "scopeLevel"), fallback);
}

function parseMarketClawKnowledgeVisibility(formData: FormData, fallback: MarketClawKnowledgeVisibility) {
  return enumValue(MarketClawKnowledgeVisibility, text(formData, "visibility"), fallback);
}

function marketClawVisibilityFromScope(scopeLevel: MarketClawKnowledgeScopeLevel) {
  if (scopeLevel === MarketClawKnowledgeScopeLevel.PERSONAL) {
    return MarketClawKnowledgeVisibility.PRIVATE;
  }
  if (scopeLevel === MarketClawKnowledgeScopeLevel.DEPARTMENT) {
    return MarketClawKnowledgeVisibility.DEPARTMENT;
  }
  return MarketClawKnowledgeVisibility.TENANT;
}

function marketClawTrainingStatusFromScope(scopeLevel: MarketClawKnowledgeScopeLevel) {
  return scopeLevel === MarketClawKnowledgeScopeLevel.ENTERPRISE
    ? MarketClawTrainingReviewStatus.ENTERPRISE_APPROVED
    : MarketClawTrainingReviewStatus.TEAM_APPROVED;
}

function buildMarketClawKnowledgePayload(formData: FormData) {
  const businessLineId = text(formData, "businessLineId");
  const title = text(formData, "title");
  const content = text(formData, "content");
  if (!title || !content) return null;

  const keywords = parseMarketClawStringArray(formData, "keywords");
  const forbiddenPhrases = parseMarketClawStringArray(formData, "forbiddenPhrases");
  const recommendedMaterialIds = formData
    .getAll("recommendedMaterialIds")
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean);

  return {
    businessLineId: businessLineId || null,
    ownerUserId: text(formData, "ownerUserId"),
    departmentName: text(formData, "departmentName"),
    title,
    content,
    knowledgeType: enumValue(MarketClawKnowledgeType, text(formData, "knowledgeType"), MarketClawKnowledgeType.OTHER),
    status: enumValue(MarketClawKnowledgeStatus, text(formData, "status"), MarketClawKnowledgeStatus.ACTIVE),
    scopeLevel: parseMarketClawKnowledgeScope(formData, MarketClawKnowledgeScopeLevel.BUSINESS_LINE),
    visibility: parseMarketClawKnowledgeVisibility(formData, MarketClawKnowledgeVisibility.TENANT),
    reviewStatus: enumValue(
      MarketClawKnowledgeReviewStatus,
      text(formData, "reviewStatus"),
      MarketClawKnowledgeReviewStatus.APPROVED
    ),
    approvedById: text(formData, "approvedById"),
    sourceTrainingCaseId: text(formData, "sourceTrainingCaseId"),
    keywords,
    applicableCustomerTypes: parseMarketClawCustomerTypes(formData, "applicableCustomerTypes"),
    applicableStages: parseMarketClawStages(formData, "applicableStages"),
    recommendedMaterialIds,
    forbiddenPhrases,
    riskNotes: text(formData, "riskNotes"),
    sortOrder: parseNumber(text(formData, "sortOrder"), 100)
  };
}

async function requireMarketClawKnowledgeAccess(tenantSlug: string) {
  const access = await requireTenantAccess(tenantSlug, ["TENANT_ADMIN", "OPERATOR"]);
  if (!canAccessMarketClawKnowledge(access.user.role)) {
    redirect("/forbidden");
  }
  return access;
}

async function requireMarketClawTrainingAccess(tenantSlug: string) {
  const access = await requireTenantAccess(tenantSlug, ["TENANT_ADMIN", "OPERATOR", "SALES"]);
  if (!canAccessMarketClawTraining(access.user.role)) {
    redirect("/forbidden");
  }
  return access;
}

async function requireMarketClawTrainingReviewAccess(tenantSlug: string) {
  const access = await requireTenantAccess(tenantSlug, ["TENANT_ADMIN", "OPERATOR"]);
  if (!canReviewMarketClawTraining(access.user.role)) {
    redirect("/forbidden");
  }
  return access;
}

async function requireMarketClawRepliesAccess(tenantSlug: string) {
  const access = await requireTenantAccess(tenantSlug, ["TENANT_ADMIN", "OPERATOR", "SALES"]);
  if (!canAccessMarketClawReplies(access.user.role)) {
    redirect("/forbidden");
  }
  return access;
}

function pickMarketClawReplyText(
  draft: {
    shortReply: string | null;
    professionalReply: string | null;
    closingReply: string | null;
  },
  selectedReplyType: string | undefined,
  salesEditedReply?: string
) {
  if (salesEditedReply?.trim()) return salesEditedReply.trim();
  if (selectedReplyType === "PROFESSIONAL") return draft.professionalReply ?? draft.shortReply ?? draft.closingReply ?? "";
  if (selectedReplyType === "CLOSING") return draft.closingReply ?? draft.professionalReply ?? draft.shortReply ?? "";
  return draft.shortReply ?? draft.professionalReply ?? draft.closingReply ?? "";
}

export async function createMarketClawKnowledgeItem(tenantSlug: string, formData: FormData) {
  const { user, tenant } = await requireMarketClawKnowledgeAccess(tenantSlug);
  const payload = buildMarketClawKnowledgePayload(formData);
  if (!payload) return;
  const { approvedById: _approvedById, departmentName: payloadDepartmentName, ...restPayload } = payload;

  const knowledgeItem = await prisma.marketClawKnowledgeItem.create({
    data: {
      tenantId: tenant.id,
      createdById: user.id,
      updatedById: user.id,
      approvedById: payload.reviewStatus === MarketClawKnowledgeReviewStatus.APPROVED ? user.id : null,
      approvedAt: payload.reviewStatus === MarketClawKnowledgeReviewStatus.APPROVED ? new Date() : null,
      departmentName: payloadDepartmentName ?? inferMarketClawDepartmentName(user),
      ...restPayload
    }
  });

  await safeWriteAuditLog({
    tenantId: tenant.id,
    userId: user.id,
    action: "market_claw_knowledge_created",
    entityType: "MarketClawKnowledgeItem",
    entityId: knowledgeItem.id,
    metadata: {
      businessLineId: knowledgeItem.businessLineId,
      knowledgeType: knowledgeItem.knowledgeType,
      status: knowledgeItem.status,
      scopeLevel: knowledgeItem.scopeLevel,
      reviewStatus: knowledgeItem.reviewStatus,
      departmentName: knowledgeItem.departmentName
    }
  });

  revalidatePath(`/app/${tenantSlug}/market-claw/knowledge`);
  revalidatePath(`/app/${tenantSlug}/leads`);
  revalidatePath(`/app/${tenantSlug}/audit-logs`);
}

export async function updateMarketClawKnowledgeItem(tenantSlug: string, knowledgeItemId: string, formData: FormData) {
  const { user, tenant } = await requireMarketClawKnowledgeAccess(tenantSlug);
  const payload = buildMarketClawKnowledgePayload(formData);
  if (!payload) return;
  const { approvedById: _approvedById, departmentName: payloadDepartmentName, ...restPayload } = payload;
  const existing = await prisma.marketClawKnowledgeItem.findFirst({
    where: { id: knowledgeItemId, tenantId: tenant.id }
  });
  if (!existing) return;

  const knowledgeItem = await prisma.marketClawKnowledgeItem.update({
    where: { id: knowledgeItemId, tenantId: tenant.id },
    data: {
      updatedById: user.id,
      approvedById: payload.reviewStatus === MarketClawKnowledgeReviewStatus.APPROVED ? user.id : null,
      approvedAt: payload.reviewStatus === MarketClawKnowledgeReviewStatus.APPROVED ? new Date() : null,
      departmentName: payloadDepartmentName ?? inferMarketClawDepartmentName(user),
      ...restPayload
    }
  });

  await safeWriteAuditLog({
    tenantId: tenant.id,
    userId: user.id,
    action: "market_claw_knowledge_updated",
    entityType: "MarketClawKnowledgeItem",
    entityId: knowledgeItem.id,
    metadata: {
      businessLineId: knowledgeItem.businessLineId,
      knowledgeType: knowledgeItem.knowledgeType,
      status: knowledgeItem.status,
      scopeLevel: knowledgeItem.scopeLevel,
      reviewStatus: knowledgeItem.reviewStatus,
      departmentName: knowledgeItem.departmentName
    }
  });
  if (
    existing.scopeLevel !== knowledgeItem.scopeLevel ||
    existing.reviewStatus !== knowledgeItem.reviewStatus ||
    existing.departmentName !== knowledgeItem.departmentName
  ) {
    await safeWriteAuditLog({
      tenantId: tenant.id,
      userId: user.id,
      action: "market_claw_knowledge_scope_updated",
      entityType: "MarketClawKnowledgeItem",
      entityId: knowledgeItem.id,
      metadata: {
        previousScopeLevel: existing.scopeLevel,
        nextScopeLevel: knowledgeItem.scopeLevel,
        previousReviewStatus: existing.reviewStatus,
        nextReviewStatus: knowledgeItem.reviewStatus,
        previousDepartmentName: existing.departmentName,
        nextDepartmentName: knowledgeItem.departmentName
      }
    });
  }

  revalidatePath(`/app/${tenantSlug}/market-claw/knowledge`);
  revalidatePath(`/app/${tenantSlug}/leads`);
  revalidatePath(`/app/${tenantSlug}/audit-logs`);
}

export async function generateMarketClawTrainingCase(tenantSlug: string, formData: FormData) {
  const { user, tenant } = await requireMarketClawTrainingAccess(tenantSlug);
  const businessLineId = text(formData, "businessLineId");
  const customerQuestion = text(formData, "customerQuestion");
  if (!customerQuestion) return;
  const departmentName = text(formData, "departmentName") ?? inferMarketClawDepartmentName(user);
  const trainingScope =
    user.role === "SALES"
      ? MarketClawTrainingScope.SALES_SELF_TRAINING
      : parseMarketClawTrainingScope(
          formData,
          businessLineId ? MarketClawTrainingScope.BUSINESS_LINE_TRAINING : MarketClawTrainingScope.ENTERPRISE_TRAINING
        );

  const [businessLine, knowledgeItems, materials] = await Promise.all([
    businessLineId ? prisma.businessLine.findFirst({ where: { id: businessLineId, tenantId: tenant.id } }) : Promise.resolve(null),
    prisma.marketClawKnowledgeItem.findMany({
      where: {
        tenantId: tenant.id,
        status: "ACTIVE"
      },
      orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }]
    }),
    prisma.material.findMany({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: "desc" }
    })
  ]);

  const reply = generateMarketClawReply({
    lead: {
      name: "训练场客户",
      customerType: enumValue(CustomerType, text(formData, "customerType"), CustomerType.OTHER),
      stage: enumValue(LeadStage, text(formData, "customerStage"), LeadStage.NEW)
    },
    question: customerQuestion,
    businessLine,
    departmentName,
    currentUserId: user.id,
    knowledgeItems
  });

  const trainingCase = await prisma.marketClawTrainingCase.create({
    data: {
      tenantId: tenant.id,
      businessLineId: businessLineId ?? null,
      createdById: user.id,
      ownerUserId: user.id,
      departmentName,
      trainingScope,
      customerQuestion,
      customerType: text(formData, "customerType")
        ? enumValue(CustomerType, text(formData, "customerType"), CustomerType.OTHER)
        : null,
      customerStage: text(formData, "customerStage")
        ? enumValue(LeadStage, text(formData, "customerStage"), LeadStage.NEW)
        : null,
      customerTags: parseMarketClawStringArray(formData, "customerTags"),
      replyStyle: text(formData, "replyStyle"),
      replyLength: text(formData, "replyLength"),
      generatedShortReply: reply.shortReply,
      generatedProfessionalReply: reply.professionalReply,
      generatedClosingReply: reply.closingReply,
      salesNote: text(formData, "salesNote"),
      forbiddenNotes: reply.riskWarnings.join("\n"),
      reviewStatus: MarketClawTrainingReviewStatus.GENERATED
    }
  });

  await safeWriteAuditLog({
    tenantId: tenant.id,
    userId: user.id,
    action: user.role === "SALES" ? "market_claw_personal_training_created" : "market_claw_training_generated",
    entityType: "MarketClawTrainingCase",
    entityId: trainingCase.id,
    metadata: {
      businessLineId: businessLineId ?? null,
      departmentName,
      trainingScope,
      knowledgeItemIds: reply.matchedKnowledgeIds,
      suggestedTagsCount: reply.suggestedTags.length,
      riskWarningCount: reply.riskWarnings.length,
      suggestedMaterials: materialTitlesFromIds(materials, reply.suggestedMaterialIds)
    }
  });

  revalidatePath(`/app/${tenantSlug}/market-claw/training`);
  revalidatePath(`/app/${tenantSlug}/market-claw/training/review`);
  revalidatePath(`/app/${tenantSlug}/market-claw`);
  revalidatePath(`/app/${tenantSlug}/audit-logs`);
}

export async function reviewMarketClawTrainingCase(tenantSlug: string, trainingCaseId: string, formData: FormData) {
  const { user, tenant } = await requireMarketClawTrainingReviewAccess(tenantSlug);

  const trainingCase = await prisma.marketClawTrainingCase.update({
    where: { id: trainingCaseId, tenantId: tenant.id },
    data: {
      manualOptimizedReply: text(formData, "manualOptimizedReply"),
      salesNote: text(formData, "salesNote"),
      forbiddenNotes: text(formData, "forbiddenNotes"),
      rating: enumValue(MarketClawTrainingRating, text(formData, "rating"), MarketClawTrainingRating.UNRATED),
      reviewStatus: enumValue(MarketClawTrainingReviewStatus, text(formData, "reviewStatus"), MarketClawTrainingReviewStatus.GENERATED),
      reviewedById: user.id,
      reviewedAt: new Date(),
      reviewComment: text(formData, "reviewComment")
    }
  });
  await safeWriteAuditLog({
    tenantId: tenant.id,
    userId: user.id,
    action:
      trainingCase.reviewStatus === MarketClawTrainingReviewStatus.REJECTED
        ? "market_claw_training_rejected"
        : "market_claw_training_reviewed",
    entityType: "MarketClawTrainingCase",
    entityId: trainingCase.id,
    metadata: {
      businessLineId: trainingCase.businessLineId,
      departmentName: trainingCase.departmentName,
      reviewStatus: trainingCase.reviewStatus,
      rating: trainingCase.rating,
      reviewedById: user.id
    }
  });

  revalidatePath(`/app/${tenantSlug}/market-claw/training`);
  revalidatePath(`/app/${tenantSlug}/market-claw/training/review`);
  revalidatePath(`/app/${tenantSlug}/audit-logs`);
}

export async function saveMarketClawTrainingAsKnowledge(tenantSlug: string, trainingCaseId: string, formData: FormData) {
  const { user, tenant } = await requireMarketClawTrainingReviewAccess(tenantSlug);
  const trainingCase = await prisma.marketClawTrainingCase.findFirst({
    where: { id: trainingCaseId, tenantId: tenant.id }
  });
  if (!trainingCase) return;

  const content =
    text(formData, "manualOptimizedReply") ??
    trainingCase.manualOptimizedReply ??
    trainingCase.generatedProfessionalReply ??
    trainingCase.generatedShortReply ??
    trainingCase.generatedClosingReply;
  if (!content) return;
  const scopeLevel = parseMarketClawKnowledgeScope(
    formData,
    trainingCase.businessLineId ? MarketClawKnowledgeScopeLevel.BUSINESS_LINE : MarketClawKnowledgeScopeLevel.ENTERPRISE
  );
  const visibility = marketClawVisibilityFromScope(scopeLevel);
  const nextReviewStatus = marketClawTrainingStatusFromScope(scopeLevel);
  const reviewComment = text(formData, "reviewComment");

  const knowledgeItem = await prisma.marketClawKnowledgeItem.create({
    data: {
      tenantId: tenant.id,
      businessLineId: trainingCase.businessLineId,
      createdById: user.id,
      updatedById: user.id,
      ownerUserId: scopeLevel === MarketClawKnowledgeScopeLevel.PERSONAL ? trainingCase.ownerUserId ?? trainingCase.createdById : null,
      departmentName: trainingCase.departmentName ?? inferMarketClawDepartmentName(user),
      title: text(formData, "knowledgeTitle") ?? `标准回复：${truncateAuditQuestion(trainingCase.customerQuestion, 40)}`,
      content,
      knowledgeType: MarketClawKnowledgeType.STANDARD_REPLY,
      scopeLevel,
      visibility,
      reviewStatus: MarketClawKnowledgeReviewStatus.APPROVED,
      approvedById: user.id,
      approvedAt: new Date(),
      sourceTrainingCaseId: trainingCase.id,
      status: MarketClawKnowledgeStatus.ACTIVE,
      keywords: splitLines(trainingCase.customerQuestion),
      applicableCustomerTypes: trainingCase.customerType ? [trainingCase.customerType] : [],
      applicableStages: trainingCase.customerStage ? [trainingCase.customerStage] : [],
      forbiddenPhrases: parseMarketClawStringArray(formData, "forbiddenPhraseList"),
      riskNotes: text(formData, "forbiddenNotes") ?? trainingCase.forbiddenNotes,
      sortOrder: 80
    }
  });

  await prisma.marketClawTrainingCase.update({
    where: { id: trainingCase.id },
    data: {
      manualOptimizedReply: text(formData, "manualOptimizedReply") ?? trainingCase.manualOptimizedReply,
      forbiddenNotes: text(formData, "forbiddenNotes") ?? trainingCase.forbiddenNotes,
      rating: enumValue(MarketClawTrainingRating, text(formData, "rating"), MarketClawTrainingRating.GOOD),
      reviewStatus: nextReviewStatus,
      promotedKnowledgeItemId: knowledgeItem.id,
      reviewedById: user.id,
      reviewedAt: new Date(),
      reviewComment
    }
  });

  await safeWriteAuditLog({
    tenantId: tenant.id,
    userId: user.id,
    action: "market_claw_knowledge_created",
    entityType: "MarketClawKnowledgeItem",
    entityId: knowledgeItem.id,
    metadata: {
      businessLineId: knowledgeItem.businessLineId,
      knowledgeType: knowledgeItem.knowledgeType,
      status: knowledgeItem.status,
      scopeLevel: knowledgeItem.scopeLevel,
      reviewStatus: knowledgeItem.reviewStatus,
      departmentName: knowledgeItem.departmentName,
      sourceTrainingCaseId: trainingCase.id
    }
  });
  await safeWriteAuditLog({
    tenantId: tenant.id,
    userId: user.id,
    action:
      nextReviewStatus === MarketClawTrainingReviewStatus.ENTERPRISE_APPROVED
        ? "market_claw_training_adopted_as_enterprise"
        : "market_claw_training_adopted_as_team",
    entityType: "MarketClawTrainingCase",
    entityId: trainingCase.id,
    metadata: {
      businessLineId: trainingCase.businessLineId,
      departmentName: trainingCase.departmentName,
      knowledgeItemId: knowledgeItem.id,
      scopeLevel,
      reviewStatus: nextReviewStatus,
      reviewedById: user.id
    }
  });

  revalidatePath(`/app/${tenantSlug}/market-claw/training`);
  revalidatePath(`/app/${tenantSlug}/market-claw/knowledge`);
  revalidatePath(`/app/${tenantSlug}/market-claw/training/review`);
  revalidatePath(`/app/${tenantSlug}/audit-logs`);
}

export async function saveMarketClawTrainingAsPersonalKnowledge(tenantSlug: string, trainingCaseId: string, formData: FormData) {
  const { user, tenant } = await requireMarketClawTrainingAccess(tenantSlug);
  const trainingCase = await prisma.marketClawTrainingCase.findFirst({
    where: {
      id: trainingCaseId,
      tenantId: tenant.id,
      ...(user.role === "SALES" ? { ownerUserId: user.id } : {})
    }
  });
  if (!trainingCase) return;

  const content =
    text(formData, "manualOptimizedReply") ??
    trainingCase.manualOptimizedReply ??
    trainingCase.generatedProfessionalReply ??
    trainingCase.generatedShortReply ??
    trainingCase.generatedClosingReply;
  if (!content) return;

  const knowledgeItem = await prisma.marketClawKnowledgeItem.create({
    data: {
      tenantId: tenant.id,
      businessLineId: trainingCase.businessLineId,
      createdById: user.id,
      updatedById: user.id,
      ownerUserId: user.id,
      departmentName: trainingCase.departmentName ?? inferMarketClawDepartmentName(user),
      title: text(formData, "knowledgeTitle") ?? `个人话术：${truncateAuditQuestion(trainingCase.customerQuestion, 36)}`,
      content,
      knowledgeType: MarketClawKnowledgeType.SALES_SCRIPT,
      scopeLevel: MarketClawKnowledgeScopeLevel.PERSONAL,
      visibility: MarketClawKnowledgeVisibility.PRIVATE,
      reviewStatus: MarketClawKnowledgeReviewStatus.APPROVED,
      approvedById: user.id,
      approvedAt: new Date(),
      sourceTrainingCaseId: trainingCase.id,
      status: MarketClawKnowledgeStatus.ACTIVE,
      keywords: splitLines(trainingCase.customerQuestion),
      applicableCustomerTypes: trainingCase.customerType ? [trainingCase.customerType] : [],
      applicableStages: trainingCase.customerStage ? [trainingCase.customerStage] : [],
      forbiddenPhrases: parseMarketClawStringArray(formData, "forbiddenPhraseList"),
      riskNotes: text(formData, "forbiddenNotes") ?? trainingCase.forbiddenNotes,
      sortOrder: 90
    }
  });

  await prisma.marketClawTrainingCase.update({
    where: { id: trainingCase.id, tenantId: tenant.id },
    data: {
      manualOptimizedReply: text(formData, "manualOptimizedReply") ?? trainingCase.manualOptimizedReply,
      salesNote: text(formData, "salesNote") ?? trainingCase.salesNote,
      forbiddenNotes: text(formData, "forbiddenNotes") ?? trainingCase.forbiddenNotes,
      reviewStatus: MarketClawTrainingReviewStatus.PERSONAL_SAVED,
      promotedKnowledgeItemId: knowledgeItem.id
    }
  });

  await safeWriteAuditLog({
    tenantId: tenant.id,
    userId: user.id,
    action: "market_claw_personal_reply_saved",
    entityType: "MarketClawKnowledgeItem",
    entityId: knowledgeItem.id,
    metadata: {
      trainingCaseId: trainingCase.id,
      businessLineId: trainingCase.businessLineId,
      departmentName: trainingCase.departmentName,
      scopeLevel: MarketClawKnowledgeScopeLevel.PERSONAL,
      reviewStatus: MarketClawTrainingReviewStatus.PERSONAL_SAVED
    }
  });

  revalidatePath(`/app/${tenantSlug}/market-claw/training`);
  revalidatePath(`/app/${tenantSlug}/market-claw/replies`);
  revalidatePath(`/app/${tenantSlug}/market-claw/knowledge`);
  revalidatePath(`/app/${tenantSlug}/audit-logs`);
}

export async function submitMarketClawTrainingForReview(tenantSlug: string, trainingCaseId: string, formData: FormData) {
  const { user, tenant } = await requireMarketClawTrainingAccess(tenantSlug);
  const trainingCase = await prisma.marketClawTrainingCase.findFirst({
    where: {
      id: trainingCaseId,
      tenantId: tenant.id,
      ...(user.role === "SALES" ? { ownerUserId: user.id } : {})
    }
  });
  if (!trainingCase) return;

  const updated = await prisma.marketClawTrainingCase.update({
    where: { id: trainingCase.id, tenantId: tenant.id },
    data: {
      manualOptimizedReply:
        text(formData, "manualOptimizedReply") ??
        trainingCase.manualOptimizedReply ??
        trainingCase.generatedProfessionalReply ??
        trainingCase.generatedShortReply,
      salesNote: text(formData, "salesNote") ?? trainingCase.salesNote,
      forbiddenNotes: text(formData, "forbiddenNotes") ?? trainingCase.forbiddenNotes,
      reviewStatus: MarketClawTrainingReviewStatus.PENDING_REVIEW,
      submittedForReviewAt: new Date()
    }
  });

  await safeWriteAuditLog({
    tenantId: tenant.id,
    userId: user.id,
    action: "market_claw_training_submitted_for_review",
    entityType: "MarketClawTrainingCase",
    entityId: updated.id,
    metadata: {
      businessLineId: updated.businessLineId,
      departmentName: updated.departmentName,
      trainingScope: updated.trainingScope,
      reviewStatus: updated.reviewStatus,
      createdById: updated.createdById
    }
  });

  revalidatePath(`/app/${tenantSlug}/market-claw/training`);
  revalidatePath(`/app/${tenantSlug}/market-claw/training/review`);
  revalidatePath(`/app/${tenantSlug}/market-claw/replies`);
  revalidatePath(`/app/${tenantSlug}/audit-logs`);
}

export async function generateMarketClawReplyDraft(tenantSlug: string, leadId: string, formData: FormData) {
  const { user, tenant, lead } = await requireLeadAccess(tenantSlug, leadId);
  const customerQuestion = text(formData, "customerQuestion");
  if (!customerQuestion) return;
  const departmentName = text(formData, "departmentName") ?? inferMarketClawDepartmentName(user);

  let businessLineId = text(formData, "businessLineId");
  const [businessLines, knowledgeItems, materials] = await Promise.all([
    prisma.businessLine.findMany({
      where: { tenantId: tenant.id, status: "ACTIVE" },
      orderBy: [{ priority: "asc" }, { updatedAt: "desc" }]
    }),
    prisma.marketClawKnowledgeItem.findMany({
      where: { tenantId: tenant.id, status: "ACTIVE" },
      orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }]
    }),
    prisma.material.findMany({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: "desc" }
    })
  ]);

  if (!businessLineId) {
    businessLineId = businessLines.find((item) => item.name.includes("GEO") && customerQuestion.includes("GEO"))?.id ?? businessLines[0]?.id;
  }

  const businessLine = businessLines.find((item) => item.id === businessLineId) ?? null;
  const reply = generateMarketClawReply({
    lead: {
      name: lead.name,
      customerType: lead.customerType,
      stage: lead.stage
    },
    question: customerQuestion,
    businessLine,
    departmentName,
    currentUserId: user.id,
    knowledgeItems
  });
  const matchedKnowledgeItems = knowledgeItems.filter((item) => reply.matchedKnowledgeIds.includes(item.id));
  const scopedKnowledgeIds = splitKnowledgeIdsByScope(matchedKnowledgeItems);

  const draft = await prisma.marketClawReplyDraft.create({
    data: {
      tenantId: tenant.id,
      leadId: lead.id,
      businessLineId: businessLine?.id ?? null,
      createdById: user.id,
      departmentName,
      sourceScope: MarketClawReplySourceScope.CUSTOMER_REPLY,
      customerQuestion,
      matchedKnowledgeIds: reply.matchedKnowledgeIds,
      usedPersonalKnowledgeIds: scopedKnowledgeIds.personal,
      usedDepartmentKnowledgeIds: scopedKnowledgeIds.department,
      usedEnterpriseKnowledgeIds: scopedKnowledgeIds.enterprise,
      shortReply: reply.shortReply,
      professionalReply: reply.professionalReply,
      closingReply: reply.closingReply,
      riskWarnings: reply.riskWarnings,
      suggestedTags: reply.suggestedTags,
      suggestedMaterials: reply.suggestedMaterialIds,
      suggestedTask: reply.suggestedTask ?? undefined,
      selectedReplyType: text(formData, "replyType") ?? "ALL",
      useStatus: MarketClawReplyUseStatus.GENERATED,
      feedbackStatus: MarketClawFeedbackStatus.UNRATED
    }
  });

  await safeWriteAuditLog({
    tenantId: tenant.id,
    userId: user.id,
    action: "market_claw_reply_generated",
    entityType: "MarketClawReplyDraft",
    entityId: draft.id,
    metadata: {
      leadId: lead.id,
      businessLineId: businessLine?.id ?? null,
      departmentName,
      replyDraftId: draft.id,
      knowledgeItemIds: reply.matchedKnowledgeIds,
      replyType: text(formData, "replyType") ?? "ALL",
      suggestedTagsCount: reply.suggestedTags.length,
      hasTask: Boolean(reply.suggestedTask),
      riskWarningCount: reply.riskWarnings.length,
      suggestedMaterials: materialTitlesFromIds(materials, reply.suggestedMaterialIds)
    }
  });

  revalidatePath(`/app/${tenantSlug}/leads/${leadId}`);
  revalidatePath(`/app/${tenantSlug}/market-claw/replies`);
  revalidatePath(`/app/${tenantSlug}/audit-logs`);
}

export async function saveMarketClawReplyDraftAsPersonalKnowledge(tenantSlug: string, leadId: string, formData: FormData) {
  const { user, tenant, lead } = await requireLeadAccess(tenantSlug, leadId);
  const draftId = text(formData, "draftId");
  if (!draftId) return;

  const draft = await prisma.marketClawReplyDraft.findFirst({
    where: { id: draftId, tenantId: tenant.id, leadId: lead.id, createdById: user.id }
  });
  if (!draft) return;

  const selectedReplyType = text(formData, "selectedReplyType") ?? "SHORT";
  const salesEditedReply = text(formData, "salesEditedReply");
  const finalReply = pickMarketClawReplyText(draft, selectedReplyType, salesEditedReply);
  if (!finalReply) return;

  const knowledgeItem = await prisma.marketClawKnowledgeItem.create({
    data: {
      tenantId: tenant.id,
      businessLineId: draft.businessLineId,
      createdById: user.id,
      updatedById: user.id,
      ownerUserId: user.id,
      departmentName: draft.departmentName ?? inferMarketClawDepartmentName(user),
      title: text(formData, "knowledgeTitle") ?? `个人话术：${truncateAuditQuestion(draft.customerQuestion, 36)}`,
      content: finalReply,
      knowledgeType: MarketClawKnowledgeType.SALES_SCRIPT,
      scopeLevel: MarketClawKnowledgeScopeLevel.PERSONAL,
      visibility: MarketClawKnowledgeVisibility.PRIVATE,
      reviewStatus: MarketClawKnowledgeReviewStatus.APPROVED,
      approvedById: user.id,
      approvedAt: new Date(),
      status: MarketClawKnowledgeStatus.ACTIVE,
      keywords: splitLines(draft.customerQuestion),
      forbiddenPhrases: parseMarketClawTextArray(draft.riskWarnings),
      sortOrder: 90
    }
  });

  await prisma.marketClawReplyDraft.update({
    where: { id: draft.id },
    data: {
      selectedReplyType,
      finalReply
    }
  });

  await safeWriteAuditLog({
    tenantId: tenant.id,
    userId: user.id,
    action: "market_claw_personal_reply_saved",
    entityType: "MarketClawKnowledgeItem",
    entityId: knowledgeItem.id,
    metadata: {
      leadId: lead.id,
      replyDraftId: draft.id,
      businessLineId: draft.businessLineId,
      departmentName: draft.departmentName,
      scopeLevel: MarketClawKnowledgeScopeLevel.PERSONAL
    }
  });

  revalidatePath(`/app/${tenantSlug}/leads/${leadId}`);
  revalidatePath(`/app/${tenantSlug}/market-claw/replies`);
  revalidatePath(`/app/${tenantSlug}/audit-logs`);
}

export async function submitMarketClawReplyDraftForReview(tenantSlug: string, leadId: string, formData: FormData) {
  const { user, tenant, lead } = await requireLeadAccess(tenantSlug, leadId);
  const draftId = text(formData, "draftId");
  if (!draftId) return;

  const draft = await prisma.marketClawReplyDraft.findFirst({
    where: { id: draftId, tenantId: tenant.id, leadId: lead.id, createdById: user.id }
  });
  if (!draft) return;

  const selectedReplyType = text(formData, "selectedReplyType") ?? "PROFESSIONAL";
  const salesEditedReply = text(formData, "salesEditedReply");
  const finalReply = pickMarketClawReplyText(draft, selectedReplyType, salesEditedReply);
  if (!finalReply) return;

  const trainingCase =
    draft.trainingCaseId
      ? await prisma.marketClawTrainingCase.update({
          where: { id: draft.trainingCaseId, tenantId: tenant.id },
          data: {
            businessLineId: draft.businessLineId,
            ownerUserId: user.id,
            departmentName: draft.departmentName ?? inferMarketClawDepartmentName(user),
            trainingScope: MarketClawTrainingScope.SALES_SELF_TRAINING,
            customerQuestion: draft.customerQuestion,
            customerType: lead.customerType,
            customerStage: lead.stage,
            generatedShortReply: draft.shortReply,
            generatedProfessionalReply: draft.professionalReply,
            generatedClosingReply: draft.closingReply,
            manualOptimizedReply: finalReply,
            salesNote: text(formData, "salesNote"),
            forbiddenNotes: parseMarketClawTextArray(draft.riskWarnings).join("\n"),
            reviewStatus: MarketClawTrainingReviewStatus.PENDING_REVIEW,
            submittedForReviewAt: new Date()
          }
        })
      : await prisma.marketClawTrainingCase.create({
          data: {
            tenantId: tenant.id,
            businessLineId: draft.businessLineId,
            createdById: user.id,
            ownerUserId: user.id,
            departmentName: draft.departmentName ?? inferMarketClawDepartmentName(user),
            trainingScope: MarketClawTrainingScope.SALES_SELF_TRAINING,
            customerQuestion: draft.customerQuestion,
            customerType: lead.customerType,
            customerStage: lead.stage,
            generatedShortReply: draft.shortReply,
            generatedProfessionalReply: draft.professionalReply,
            generatedClosingReply: draft.closingReply,
            manualOptimizedReply: finalReply,
            salesNote: text(formData, "salesNote"),
            forbiddenNotes: parseMarketClawTextArray(draft.riskWarnings).join("\n"),
            reviewStatus: MarketClawTrainingReviewStatus.PENDING_REVIEW,
            submittedForReviewAt: new Date()
          }
        });

  await prisma.marketClawReplyDraft.update({
    where: { id: draft.id, tenantId: tenant.id },
    data: {
      trainingCaseId: trainingCase.id,
      submittedForReviewAt: new Date(),
      selectedReplyType,
      finalReply
    }
  });

  await safeWriteAuditLog({
    tenantId: tenant.id,
    userId: user.id,
    action: "market_claw_training_submitted_for_review",
    entityType: "MarketClawTrainingCase",
    entityId: trainingCase.id,
    metadata: {
      leadId: lead.id,
      replyDraftId: draft.id,
      businessLineId: draft.businessLineId,
      departmentName: trainingCase.departmentName,
      trainingScope: trainingCase.trainingScope,
      reviewStatus: trainingCase.reviewStatus,
      createdById: user.id
    }
  });

  revalidatePath(`/app/${tenantSlug}/leads/${leadId}`);
  revalidatePath(`/app/${tenantSlug}/market-claw/training`);
  revalidatePath(`/app/${tenantSlug}/market-claw/training/review`);
  revalidatePath(`/app/${tenantSlug}/market-claw/replies`);
  revalidatePath(`/app/${tenantSlug}/audit-logs`);
}

export async function confirmMarketClawDraftTags(tenantSlug: string, leadId: string, formData: FormData) {
  const { user, tenant, lead } = await requireLeadAccess(tenantSlug, leadId);
  const draftId = text(formData, "draftId");
  if (!draftId) return;

  const draft = await prisma.marketClawReplyDraft.findFirst({
    where: { id: draftId, tenantId: tenant.id, leadId: lead.id }
  });
  if (!draft) return;

  const suggestedTags = parseMarketClawSuggestedTags(draft.suggestedTags);
  const selectedKeys = formData.getAll("selectedTags").map((value) => (typeof value === "string" ? value : ""));
  const tagsToConfirm = suggestedTags.filter((tag) => selectedKeys.includes(`${tag.tagGroup}::${tag.tagName}`));
  if (!tagsToConfirm.length) return;

  const existingTags = await prisma.leadTag.findMany({
    where: { tenantId: tenant.id, leadId: lead.id }
  });
  const existingKeys = new Set(existingTags.map((tag) => `${tag.tagGroup}::${tag.tagName}`));
  const createPayload = tagsToConfirm.filter((tag) => !existingKeys.has(`${tag.tagGroup}::${tag.tagName}`));

  if (createPayload.length) {
    await prisma.leadTag.createMany({
      data: createPayload.map((tag) => ({
        tenantId: tenant.id,
        leadId: lead.id,
        tagName: tag.tagName,
        tagGroup: tag.tagGroup
      }))
    });
  }

  await safeWriteAuditLog({
    tenantId: tenant.id,
    userId: user.id,
    action: "market_claw_tags_confirmed",
    entityType: "LeadTag",
    entityId: lead.id,
    metadata: {
      leadId: lead.id,
      replyDraftId: draft.id,
      suggestedTagsCount: tagsToConfirm.length
    }
  });

  revalidatePath(`/app/${tenantSlug}/leads/${leadId}`);
  revalidatePath(`/app/${tenantSlug}/market-claw/replies`);
  revalidatePath(`/app/${tenantSlug}/audit-logs`);
}

export async function saveMarketClawReplyDraftAsFollowUp(tenantSlug: string, leadId: string, formData: FormData) {
  const { user, tenant, lead } = await requireLeadAccess(tenantSlug, leadId);
  const draftId = text(formData, "draftId");
  if (!draftId) return;

  const draft = await prisma.marketClawReplyDraft.findFirst({
    where: { id: draftId, tenantId: tenant.id, leadId: lead.id }
  });
  if (!draft) return;

  const selectedReplyType = text(formData, "selectedReplyType") ?? "SHORT";
  const salesEditedReply = text(formData, "salesEditedReply");
  const finalReply = pickMarketClawReplyText(draft, selectedReplyType, salesEditedReply);
  if (!finalReply) return;

  const suggestedTask = parseMarketClawSuggestedTask(draft.suggestedTask);
  const followUp = await prisma.followUp.create({
    data: {
      tenantId: tenant.id,
      leadId: lead.id,
      userId: user.id,
      marketClawReplyDraftId: draft.id,
      content: finalReply,
      nextAction: suggestedTask?.title ?? draft.customerQuestion,
      stageBefore: lead.stage,
      stageAfter: lead.stage
    }
  });

  await prisma.lead.update({
    where: { id: lead.id },
    data: { lastFollowAt: new Date() }
  });

  await prisma.marketClawReplyDraft.update({
    where: { id: draft.id },
    data: {
      useStatus: MarketClawReplyUseStatus.SAVED_AS_FOLLOWUP,
      selectedReplyType,
      finalReply
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
      stageAfter: lead.stage,
      nextFollowAt: null
    }
  });
  await safeWriteAuditLog({
    tenantId: tenant.id,
    userId: user.id,
    action: "market_claw_reply_saved_as_followup",
    entityType: "MarketClawReplyDraft",
    entityId: draft.id,
    metadata: {
      leadId: lead.id,
      businessLineId: draft.businessLineId,
      replyDraftId: draft.id,
      replyType: selectedReplyType
    }
  });

  revalidatePath(`/app/${tenantSlug}/leads/${leadId}`);
  revalidatePath(`/app/${tenantSlug}/market-claw/replies`);
  revalidatePath(`/app/${tenantSlug}/todos`);
  revalidatePath(`/app/${tenantSlug}/audit-logs`);
}

export async function markMarketClawReplyCopied(tenantSlug: string, leadId: string, formData: FormData) {
  const { user, tenant, lead } = await requireLeadAccess(tenantSlug, leadId);
  const draftId = text(formData, "draftId");
  if (!draftId) return;

  const draft = await prisma.marketClawReplyDraft.findFirst({
    where: { id: draftId, tenantId: tenant.id, leadId: lead.id }
  });
  if (!draft) return;

  const selectedReplyType = text(formData, "selectedReplyType") ?? "SHORT";
  const finalReply = pickMarketClawReplyText(draft, selectedReplyType, text(formData, "salesEditedReply"));
  await prisma.marketClawReplyDraft.update({
    where: { id: draft.id },
    data: {
      useStatus: MarketClawReplyUseStatus.COPIED,
      selectedReplyType,
      finalReply
    }
  });

  await safeWriteAuditLog({
    tenantId: tenant.id,
    userId: user.id,
    action: "market_claw_reply_copied",
    entityType: "MarketClawReplyDraft",
    entityId: draft.id,
    metadata: {
      leadId: lead.id,
      businessLineId: draft.businessLineId,
      replyDraftId: draft.id,
      replyType: selectedReplyType
    }
  });

  revalidatePath(`/app/${tenantSlug}/leads/${leadId}`);
  revalidatePath(`/app/${tenantSlug}/market-claw/replies`);
  revalidatePath(`/app/${tenantSlug}/audit-logs`);
}

export async function createMarketClawTask(tenantSlug: string, leadId: string, formData: FormData) {
  const { user, tenant, lead } = await requireLeadAccess(tenantSlug, leadId);
  const draftId = text(formData, "draftId");
  if (!draftId) return;

  const draft = await prisma.marketClawReplyDraft.findFirst({
    where: { id: draftId, tenantId: tenant.id, leadId: lead.id }
  });
  if (!draft) return;

  const suggestedTask = parseMarketClawSuggestedTask(draft.suggestedTask);
  if (!suggestedTask) return;

  const ownerId = lead.ownerId ?? user.id;
  await createTaskWithAudit({
    tenantId: tenant.id,
    leadId: lead.id,
    ownerId,
    createdById: user.id,
    title: suggestedTask.title,
    description: suggestedTask.description,
    type: FollowTaskType.CUSTOM,
    priority: enumValue(FollowTaskPriority, suggestedTask.priority, FollowTaskPriority.NORMAL),
    dueAt: defaultDueAfterDays(suggestedTask.dueDays),
    auditAction: "market_claw_task_created",
    auditMetadata: {
      leadId: lead.id,
      businessLineId: draft.businessLineId,
      replyDraftId: draft.id,
      hasTask: true
    }
  });

  revalidatePath(`/app/${tenantSlug}/leads/${leadId}`);
  revalidatePath(`/app/${tenantSlug}/todos`);
  revalidatePath(`/app/${tenantSlug}/market-claw/replies`);
  revalidatePath(`/app/${tenantSlug}/audit-logs`);
}

export async function createMarketClawFeedback(tenantSlug: string, leadId: string, formData: FormData) {
  const { user, tenant, lead } = await requireLeadAccess(tenantSlug, leadId);
  const draftId = text(formData, "draftId");
  if (!draftId) return;

  const draft = await prisma.marketClawReplyDraft.findFirst({
    where: { id: draftId, tenantId: tenant.id, leadId: lead.id }
  });
  if (!draft) return;

  const feedbackStatus = enumValue(
    MarketClawFeedbackStatus,
    text(formData, "feedbackStatus"),
    MarketClawFeedbackStatus.UNRATED
  );

  const feedback = await prisma.marketClawReplyFeedback.create({
    data: {
      tenantId: tenant.id,
      replyDraftId: draft.id,
      leadId: lead.id,
      createdById: user.id,
      departmentName: draft.departmentName ?? inferMarketClawDepartmentName(user),
      feedbackStatus,
      feedbackNote: text(formData, "feedbackNote"),
      salesEditedReply: text(formData, "salesEditedReply"),
      recommendAsTrainingCase: checkbox(formData, "recommendAsTrainingCase"),
      submittedToReview: false,
      reviewResult: MarketClawReviewResult.NONE,
      reviewComment: text(formData, "reviewComment")
    }
  });

  await prisma.marketClawReplyDraft.update({
    where: { id: draft.id },
    data: {
      feedbackStatus,
      finalReply: text(formData, "salesEditedReply") ?? draft.finalReply
    }
  });

  await safeWriteAuditLog({
    tenantId: tenant.id,
    userId: user.id,
    action: "market_claw_feedback_created",
    entityType: "MarketClawReplyFeedback",
    entityId: feedback.id,
    metadata: {
      leadId: lead.id,
      businessLineId: draft.businessLineId,
      replyDraftId: draft.id,
      feedbackStatus,
      departmentName: feedback.departmentName,
      reviewResult: feedback.reviewResult
    }
  });

  revalidatePath(`/app/${tenantSlug}/leads/${leadId}`);
  revalidatePath(`/app/${tenantSlug}/market-claw/replies`);
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

function checkbox(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

function parseMultiValue(formData: FormData, key: string) {
  return formData
    .getAll(key)
    .flatMap((value) =>
      typeof value === "string"
        ? value
            .split(/\r?\n|,/)
            .map((item) => item.trim())
            .filter(Boolean)
        : []
    )
    .filter(Boolean);
}

function summarizeCommunicationScope(scopeConfig: {
  employeeScopeMode: string;
  employeeScopeUsers: string[];
  businessLineScopeMode: string;
  businessLineScopeIds: string[];
  customerScopeMode: string;
  customerScopeTags: string[];
  customerScopeBusinessLines: string[];
  customerScopeSources: string[];
}) {
  return {
    employeeScopeMode: scopeConfig.employeeScopeMode,
    employeeScopeCount: scopeConfig.employeeScopeUsers.length,
    businessLineScopeMode: scopeConfig.businessLineScopeMode,
    businessLineScopeCount: scopeConfig.businessLineScopeIds.length,
    customerScopeMode: scopeConfig.customerScopeMode,
    customerTagCount: scopeConfig.customerScopeTags.length,
    customerBusinessLineCount: scopeConfig.customerScopeBusinessLines.length,
    customerSourceCount: scopeConfig.customerScopeSources.length
  };
}

export async function createBusinessLine(tenantSlug: string, formData: FormData) {
  const { user, tenant } = await requireTenantAccess(tenantSlug, ["TENANT_ADMIN", "OPERATOR"]);
  const payload = getBusinessLinePayload(formData);
  if (!payload) return;
  if (payload.status === "ARCHIVED" && user.role !== "TENANT_ADMIN") {
    redirect("/forbidden");
  }

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
  if (payload.status === "ARCHIVED" && user.role !== "TENANT_ADMIN") {
    redirect("/forbidden");
  }

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
  if (status === "ARCHIVED" && user.role !== "TENANT_ADMIN") {
    redirect("/forbidden");
  }
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
  const { tenant } = await requireTenantAccess(tenantSlug, ["TENANT_ADMIN"]);

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

export async function upsertCommunicationComplianceConfig(
  tenantSlug: string,
  channel: CommunicationComplianceChannel,
  formData: FormData
) {
  const { user, tenant } = await requireTenantAccess(tenantSlug, ["TENANT_ADMIN", "OPERATOR"]);
  if (!canManageCommunicationCompliance(user.role)) {
    redirect("/forbidden");
  }

  const requestedStatus = enumValue(
    CommunicationComplianceStatus,
    text(formData, "status"),
    CommunicationComplianceStatus.DISABLED
  );
  const provider = enumValue(
    CommunicationComplianceProvider,
    text(formData, "provider"),
    CommunicationComplianceProvider.MANUAL
  );
  const featureApplicationRequired = true;
  const featureApplicationSubmitted = checkbox(formData, "featureApplicationSubmitted");
  const employeeScopeMode = text(formData, "employeeScopeMode") ?? "ALL";
  const businessLineScopeMode = text(formData, "businessLineScopeMode") ?? "ALL_ACTIVE";
  const customerScopeMode = text(formData, "customerScopeMode") ?? "ALL";
  const employeeScopeUsers = parseMultiValue(formData, "employeeScopeUsers");
  const businessLineScopeIds = parseMultiValue(formData, "businessLineScopeIds");
  const customerScopeTags = parseMultiValue(formData, "customerScopeTags");
  const customerScopeBusinessLines = parseMultiValue(formData, "customerScopeBusinessLines");
  const customerScopeSources = parseMultiValue(formData, "customerScopeSources");
  const dataRetentionDays = parseNumber(text(formData, "dataRetentionDays"), 180);
  const allowAutoSend = false;
  const confirmationItems = {
    enterpriseAware: checkbox(formData, "enterpriseAware"),
    employeeNoticeConfirmed: checkbox(formData, "employeeNoticeConfirmed"),
    customerNoticeConfirmed: checkbox(formData, "customerNoticeConfirmed"),
    usageScopeConfirmed: checkbox(formData, "usageScopeConfirmed"),
    noUnauthorizedMonitoring: checkbox(formData, "noUnauthorizedMonitoring"),
    aiAssistOnlyConfirmed: checkbox(formData, "aiAssistOnlyConfirmed")
  };
  const allConfirmed = Object.values(confirmationItems).every(Boolean);

  if ((requestedStatus === CommunicationComplianceStatus.ENABLED || requestedStatus === CommunicationComplianceStatus.APPLYING) && !featureApplicationSubmitted) {
    redirect(
      buildCommunicationComplianceMessageUrl(
        tenantSlug,
        channel,
        "error",
        "该功能属于单独收费能力，必须先提交开通申请后才能进入申请中或启用状态。"
      )
    );
  }

  if (requestedStatus === CommunicationComplianceStatus.ENABLED && !allConfirmed) {
    redirect(
      buildCommunicationComplianceMessageUrl(
        tenantSlug,
        channel,
        "error",
        "未完成全部合规确认项前，不能启用自动采集通道。"
      )
    );
  }

  const existingConfig = await prisma.communicationComplianceConfig.findUnique({
    where: {
      tenantId_channel: {
        tenantId: tenant.id,
        channel
      }
    }
  });

  const status =
    requestedStatus === CommunicationComplianceStatus.ENABLED && allConfirmed
      ? CommunicationComplianceStatus.ENABLED
      : requestedStatus;

  const scopeConfig = {
    employeeScopeMode,
    employeeScopeUsers,
    businessLineScopeMode,
    businessLineScopeIds,
    customerScopeMode,
    customerScopeTags,
    customerScopeBusinessLines,
    customerScopeSources,
    excludePausedOrArchivedBusinessLines: checkbox(formData, "excludePausedOrArchivedBusinessLines")
  };

  const noticeConfig = {
    featureApplicationRequired,
    featureApplicationSubmitted,
    enterpriseAware: confirmationItems.enterpriseAware,
    employeeNoticeConfirmed: confirmationItems.employeeNoticeConfirmed,
    customerNoticeConfirmed: confirmationItems.customerNoticeConfirmed,
    usageScopeConfirmed: confirmationItems.usageScopeConfirmed,
    noUnauthorizedMonitoring: confirmationItems.noUnauthorizedMonitoring,
    aiAssistOnlyConfirmed: confirmationItems.aiAssistOnlyConfirmed,
    customerNoticeRequired: checkbox(formData, "customerNoticeRequired"),
    recordingConsentConfirmed: checkbox(formData, "recordingConsentConfirmed"),
    customerNoticeTemplate: text(formData, "customerNoticeTemplate"),
    internalNoticeNotes: text(formData, "internalNoticeNotes")
  };

  const retentionConfig = {
    dataRetentionDays,
    keepRawText: checkbox(formData, "keepRawText"),
    keepSummaryOnly: checkbox(formData, "keepSummaryOnly"),
    keepAudioFile: checkbox(formData, "keepAudioFile"),
    keepTranscriptOnly: checkbox(formData, "keepTranscriptOnly")
  };

  const aiConfig = {
    allowAiSummary: checkbox(formData, "allowAiSummary"),
    allowAiTagSuggestion: checkbox(formData, "allowAiTagSuggestion"),
    allowAiTaskSuggestion: checkbox(formData, "allowAiTaskSuggestion"),
    allowReplySuggestion: checkbox(formData, "allowReplySuggestion"),
    allowAiAnalysis: checkbox(formData, "allowAiAnalysis"),
    allowTranscription: checkbox(formData, "allowTranscription"),
    allowAudioUpload: checkbox(formData, "allowAudioUpload"),
    allowAutoTranscription: checkbox(formData, "allowAutoTranscription"),
    allowAutoSend
  };

  const confirmedAt = status === CommunicationComplianceStatus.ENABLED ? new Date() : existingConfig?.confirmedAt ?? null;
  const confirmedById = status === CommunicationComplianceStatus.ENABLED ? user.id : existingConfig?.confirmedById ?? null;

  const savedConfig = await prisma.communicationComplianceConfig.upsert({
    where: {
      tenantId_channel: {
        tenantId: tenant.id,
        channel
      }
    },
    update: {
      status,
      provider,
      scopeConfig,
      noticeConfig,
      retentionConfig,
      aiConfig,
      confirmedById,
      confirmedAt
    },
    create: {
      tenantId: tenant.id,
      channel,
      status,
      provider,
      scopeConfig,
      noticeConfig,
      retentionConfig,
      aiConfig,
      confirmedById,
      confirmedAt
    }
  });

  const scopeSummary = summarizeCommunicationScope(scopeConfig);
  const metadata = {
    channel,
    status: savedConfig.status,
    provider: savedConfig.provider,
    confirmedById: savedConfig.confirmedById,
    scopeSummary,
    allowAiAnalysis: aiConfig.allowAiAnalysis,
    allowReplySuggestion: aiConfig.allowReplySuggestion,
    allowAutoSend,
    featureApplicationSubmitted
  };

  await safeWriteAuditLog({
    tenantId: tenant.id,
    userId: user.id,
    action: existingConfig ? "communication_compliance_config_updated" : "communication_compliance_config_created",
    entityType: "CommunicationComplianceConfig",
    entityId: savedConfig.id,
    metadata
  });

  if (existingConfig?.status !== savedConfig.status && savedConfig.status === CommunicationComplianceStatus.ENABLED) {
    await safeWriteAuditLog({
      tenantId: tenant.id,
      userId: user.id,
      action: "communication_compliance_config_enabled",
      entityType: "CommunicationComplianceConfig",
      entityId: savedConfig.id,
      metadata
    });
  }

  if (
    existingConfig?.status !== savedConfig.status &&
    savedConfig.status === CommunicationComplianceStatus.PAUSED
  ) {
    await safeWriteAuditLog({
      tenantId: tenant.id,
      userId: user.id,
      action: "communication_compliance_config_paused",
      entityType: "CommunicationComplianceConfig",
      entityId: savedConfig.id,
      metadata
    });
  }

  revalidatePath(`/app/${tenantSlug}/communication-compliance`);
  revalidatePath(`/app/${tenantSlug}/audit-logs`);
  redirect(
    buildCommunicationComplianceMessageUrl(
      tenantSlug,
      channel,
      "success",
      status === CommunicationComplianceStatus.ENABLED
        ? "采集合规配置已启用并保存。"
        : status === CommunicationComplianceStatus.APPLYING
          ? "采集合规配置已保存为申请中。"
          : "采集合规配置已保存。"
    )
  );
}
