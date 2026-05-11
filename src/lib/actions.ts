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
  CustomerType,
  FormType,
  IntentionLevel,
  LeadSource,
  LeadStage,
  MaterialType,
  NeedType,
  TenantStatus,
  WeComConfigStatus
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireLeadAccess, requirePlatformAdmin, requireTenantAccess } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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

export async function createTenant(formData: FormData) {
  await requirePlatformAdmin();
  const name = text(formData, "name");
  const slug = text(formData, "slug");
  if (!name || !slug) return;

  await prisma.tenant.create({
    data: {
      name,
      slug,
      industry: text(formData, "industry"),
      expiredAt: parseDate(text(formData, "expiredAt"))
    }
  });

  revalidatePath("/admin");
}

export async function updateTenantStatus(formData: FormData) {
  await requirePlatformAdmin();
  const id = text(formData, "id");
  if (!id) return;

  await prisma.tenant.update({
    where: { id },
    data: {
      status: enumValue(TenantStatus, text(formData, "status"), TenantStatus.active),
      expiredAt: parseDate(text(formData, "expiredAt"))
    }
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

  redirect(`/t/${tenantSlug}/thanks?lead=${lead.id}`);
}

export async function addFollowUp(tenantSlug: string, leadId: string, formData: FormData) {
  const { user, tenant, lead } = await requireLeadAccess(tenantSlug, leadId);
  const content = text(formData, "content");
  if (!content) return;

  const stageAfter = enumValue(LeadStage, text(formData, "stageAfter"), lead.stage);
  const nextFollowAt = parseDate(text(formData, "nextFollowAt"));

  await prisma.followUp.create({
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

  revalidatePath(`/app/${tenantSlug}/leads/${leadId}`);
}

export async function updateStrategy(tenantSlug: string, strategyId: string, formData: FormData) {
  const { tenant } = await requireTenantAccess(tenantSlug, ["TENANT_ADMIN", "OPERATOR"]);

  await prisma.customerTypeStrategy.update({
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

  revalidatePath(`/app/${tenantSlug}/strategies`);
}

export async function createMaterial(tenantSlug: string, formData: FormData) {
  const { tenant } = await requireTenantAccess(tenantSlug, ["TENANT_ADMIN", "OPERATOR"]);
  const title = text(formData, "title");
  const url = text(formData, "url");
  if (!title || !url) return;

  await prisma.material.create({
    data: {
      tenantId: tenant.id,
      title,
      url,
      description: text(formData, "description"),
      type: enumValue(MaterialType, text(formData, "type"), MaterialType.link),
      customerType: enumValue(CustomerType, text(formData, "customerType"), CustomerType.OTHER)
    }
  });

  revalidatePath(`/app/${tenantSlug}/materials`);
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
