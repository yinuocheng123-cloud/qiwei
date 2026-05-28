"use server";

/*
 * 文件说明：该文件实现 V2.6 企业微信轻承接 MVP 的服务端动作。
 * 功能说明：支持手工/模拟导入企业微信客户，写入来源归因，并在 CNAS 模板租户中自动创建跟进任务。
 *
 * 结构概览：
 *   第一部分：导入依赖与表单解析
 *   第二部分：企业微信轻承接辅助工具
 *   第三部分：客户导入与 CNAS 跟进流程
 */
import {
  CustomerType,
  FollowTaskType,
  IntentionLevel,
  LeadSource,
  LeadStage,
  NeedType,
  TagGroup,
  type Prisma
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { safeWriteAuditLog } from "@/lib/audit";
import { requireTenantAccess } from "@/lib/auth";
import {
  CNAS_BUSINESS_LINE_NAME,
  CNAS_BUSINESS_LINE_SLUG,
  addMinutes,
  buildCnasExtraData,
  buildCnasLeadMessage,
  getCnasDiagnosisResult,
  getCnasStructuredTags,
  type CnasFormValues
} from "@/lib/cnas";
import { prisma } from "@/lib/prisma";
import { upsertLeadSourceAttribution } from "@/lib/source-attribution";
import { createFirstFollowTask, createHighIntentTask, createTaskWithAudit } from "@/lib/tasks";
import { getDefaultTenantUser } from "@/lib/tenant";

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function enumValue<T extends Record<string, string>>(allowed: T, value: string | undefined, fallback: T[keyof T]) {
  return value && Object.values(allowed).includes(value) ? (value as T[keyof T]) : fallback;
}

function mergeJsonRecord(existing: unknown, next: Record<string, unknown>): Prisma.InputJsonValue {
  if (!existing || typeof existing !== "object" || Array.isArray(existing)) {
    return next as Prisma.InputJsonValue;
  }
  return { ...(existing as Record<string, unknown>), ...next } as Prisma.InputJsonValue;
}

function buildCnasValues(formData: FormData, submittedAt: Date): CnasFormValues {
  return {
    company: text(formData, "company") ?? "未填写企业",
    contactName: text(formData, "contactName") ?? "未填写客户",
    phone: text(formData, "phone") ?? "",
    labType: text(formData, "labType") ?? "检测实验室",
    currentStage: text(formData, "currentStage") ?? "刚开始了解",
    scopeClarity: text(formData, "scopeClarity") ?? "还不清楚",
    readiness: text(formData, "readiness") ?? "不确定",
    primaryConcern: text(formData, "primaryConcern") ?? "不知道从哪开始",
    startPlan: text(formData, "startPlan") ?? "只是先了解",
    wecomAdded: "是",
    note: text(formData, "note"),
    sourcePage: `/app/zhengmu-platform/wecom/light-intake`,
    utmSource: "wecom-light-intake",
    utmMedium: "manual-simulated",
    utmCampaign: text(formData, "sourceCampaign") ?? "cnas-wecom-mvp",
    utmContent: text(formData, "sourceScene") ?? "manual",
    submittedAt: submittedAt.toISOString()
  };
}

function buildLightIntakeExtraData(input: {
  externalUserId?: string;
  sourceScene?: string;
  sourceCampaign?: string;
  sourceStaffName?: string;
  submittedAt: Date;
}) {
  return {
    wecomLightIntake: {
      channel: "企业微信轻承接",
      mode: "manual_simulated_import",
      externalUserId: input.externalUserId ?? null,
      sourceScene: input.sourceScene ?? null,
      sourceCampaign: input.sourceCampaign ?? null,
      sourceStaffName: input.sourceStaffName ?? null,
      submittedAt: input.submittedAt.toISOString(),
      boundary: "不做聊天同步、不做自动回复、不做会话存档、不接深度企微 API"
    }
  };
}

export async function simulateWecomCustomerImport(tenantSlug: string, formData: FormData) {
  const { user, tenant } = await requireTenantAccess(tenantSlug, ["TENANT_ADMIN", "OPERATOR"]);
  const name = text(formData, "contactName");
  const phone = text(formData, "phone");
  if (!name || !phone) {
    throw new Error("客户姓名和手机号为必填项。");
  }

  const submittedAt = new Date();
  const sourceStaffId = text(formData, "sourceStaffId");
  const selectedStaff = sourceStaffId
    ? await prisma.user.findFirst({
        where: {
          id: sourceStaffId,
          tenantId: tenant.id,
          status: "active",
          role: { in: ["TENANT_ADMIN", "OPERATOR", "SALES"] }
        }
      })
    : null;
  const fallbackOwner = await getDefaultTenantUser(tenant.id);
  const owner = selectedStaff ?? fallbackOwner;
  const isCnasTemplate = tenant.templateKey === "cnas-pilot";
  const sourceScene = text(formData, "sourceScene") ?? "手工模拟导入";
  const sourceCampaign = text(formData, "sourceCampaign") ?? (isCnasTemplate ? "CNAS企微承接MVP" : "企微轻承接MVP");
  const externalUserId = text(formData, "externalUserId");
  const cnasValues = isCnasTemplate ? buildCnasValues(formData, submittedAt) : null;
  const cnasResult = cnasValues ? getCnasDiagnosisResult(cnasValues) : null;
  const existingLead = await prisma.lead.findFirst({
    where: {
      tenantId: tenant.id,
      OR: [{ phone }, { name, company: text(formData, "company") }]
    },
    orderBy: { updatedAt: "desc" }
  });

  const lightIntakeExtraData = buildLightIntakeExtraData({
    externalUserId,
    sourceScene,
    sourceCampaign,
    sourceStaffName: owner?.name,
    submittedAt
  });
  const cnasExtraData = cnasValues && cnasResult ? buildCnasExtraData(cnasValues, cnasResult) : {};
  const extraData = mergeJsonRecord(existingLead?.extraData, {
    ...lightIntakeExtraData,
    ...cnasExtraData
  });
  const nextFollowAt = cnasResult ? addMinutes(submittedAt, cnasResult.dueInMinutes) : undefined;

  const leadPayload = {
    tenantId: tenant.id,
    name,
    phone,
    wechat: externalUserId ?? text(formData, "wechat"),
    company: text(formData, "company"),
    source: LeadSource.other,
    customerType: isCnasTemplate ? CustomerType.OTHER : enumValue(CustomerType, text(formData, "customerType"), CustomerType.OTHER),
    needType: isCnasTemplate ? NeedType.BOOK_CONSULTATION : enumValue(NeedType, text(formData, "needType"), NeedType.OTHER),
    intentionLevel: cnasResult?.intentionLevel ?? enumValue(IntentionLevel, text(formData, "intentionLevel"), IntentionLevel.MEDIUM),
    stage: isCnasTemplate ? LeadStage.DIAGNOSED : LeadStage.NEW,
    message: cnasValues && cnasResult ? buildCnasLeadMessage(cnasValues, cnasResult) : text(formData, "message"),
    ownerId: existingLead?.ownerId ?? owner?.id ?? null,
    nextFollowAt,
    extraData
  };

  const lead = existingLead
    ? await prisma.lead.update({
        where: { id: existingLead.id },
        data: leadPayload
      })
    : await prisma.lead.create({
        data: leadPayload
      });

  await upsertLeadSourceAttribution({
    db: prisma,
    tenantId: tenant.id,
    leadId: lead.id,
    userId: user.id,
    attribution: {
      sourceChannel: "企业微信轻承接",
      sourceProject: isCnasTemplate ? CNAS_BUSINESS_LINE_NAME : "企业微信客户承接",
      sourceCampaign,
      sourceScene,
      sourceTouchpoint: "手工/模拟导入",
      sourceQrCode: text(formData, "sourceQrCode"),
      sourceStaffName: owner?.name,
      sourceStaffId: owner?.id,
      sourcePage: `/app/${tenant.slug}/wecom/light-intake`,
      sourceContent: externalUserId ? `externalUserId=${externalUserId}` : text(formData, "message"),
      utmSource: "wecom-light-intake",
      utmMedium: "manual-simulated",
      utmCampaign: sourceCampaign,
      utmContent: sourceScene,
      firstSeenAt: submittedAt,
      submittedAt
    }
  });

  const baseTags = [
    { tagName: "企业微信客户", tagGroup: TagGroup.CUSTOM },
    { tagName: sourceScene, tagGroup: TagGroup.CUSTOM },
    { tagName: isCnasTemplate ? CNAS_BUSINESS_LINE_NAME : "企业微信轻承接", tagGroup: TagGroup.BUSINESS_LINE }
  ];
  const cnasTags = cnasResult ? getCnasStructuredTags(cnasResult) : [];
  const existingTags = await prisma.leadTag.findMany({ where: { tenantId: tenant.id, leadId: lead.id } });
  const existingTagKeys = new Set(existingTags.map((tag) => `${tag.tagGroup}::${tag.tagName}`));
  const tagsToCreate = [...baseTags, ...cnasTags].filter((tag) => !existingTagKeys.has(`${tag.tagGroup}::${tag.tagName}`));

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

  if (cnasResult && lead.ownerId) {
    await createTaskWithAudit({
      tenantId: tenant.id,
      leadId: lead.id,
      ownerId: lead.ownerId,
      createdById: user.id,
      title: cnasResult.taskTitle,
      description: `${cnasResult.taskDescription} 来源：企业微信轻承接。`,
      type:
        cnasResult.diagnosisType === "A"
          ? FollowTaskType.PHONE_CALL
          : cnasResult.diagnosisType === "B"
            ? FollowTaskType.SEND_MATERIAL
            : FollowTaskType.WECHAT_FOLLOW,
      priority: cnasResult.taskPriority,
      dueAt: nextFollowAt,
      auditAction: "wecom_light_intake_cnas_task_created",
      auditMetadata: {
        leadId: lead.id,
        templateKey: tenant.templateKey,
        businessLine: CNAS_BUSINESS_LINE_SLUG,
        diagnosisType: cnasResult.diagnosisType,
        sourceChannel: "企业微信轻承接"
      }
    });
  } else {
    await createFirstFollowTask(lead, { userId: user.id });
    await createHighIntentTask(lead, { userId: user.id });
  }

  await safeWriteAuditLog({
    tenantId: tenant.id,
    userId: user.id,
    action: existingLead ? "wecom_light_customer_updated" : "wecom_light_customer_imported",
    entityType: "Lead",
    entityId: lead.id,
    metadata: {
      leadId: lead.id,
      sourceChannel: "企业微信轻承接",
      mode: "manual_simulated_import",
      templateKey: tenant.templateKey ?? null,
      isCnasTemplate,
      ownerId: lead.ownerId ?? null,
      externalUserId: externalUserId ?? null
    }
  });

  revalidatePath(`/app/${tenant.slug}/wecom/light-intake`);
  revalidatePath(`/app/${tenant.slug}/leads`);
  revalidatePath(`/app/${tenant.slug}/leads/${lead.id}`);
  revalidatePath(`/app/${tenant.slug}/todos`);
  revalidatePath(`/app/${tenant.slug}/dashboard`);
  redirect(`/app/${tenant.slug}/leads/${lead.id}`);
}
