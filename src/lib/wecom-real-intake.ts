/*
 * 文件说明：该文件实现 V2.7 CNAS 企业微信真实轻接入的承接服务。
 * 功能说明：负责从企业微信外部联系人事件拉取基础客户信息、生成或更新 Lead、写入来源归因并触发 CNAS 跟进流程。
 *
 * 结构概览：
 *   第一部分：导入依赖与类型定义
 *   第二部分：外部联系人基础资料拉取
 *   第三部分：客户承接、来源归因和任务创建
 */
import {
  CustomerType,
  FollowTaskType,
  IntentionLevel,
  LeadSource,
  LeadStage,
  NeedType,
  TagGroup,
  type Prisma,
  type Tenant
} from "@prisma/client";
import { addMinutes, buildCnasExtraData, buildCnasLeadMessage, CNAS_BUSINESS_LINE_NAME, CNAS_BUSINESS_LINE_SLUG, getCnasDiagnosisResult, getCnasStructuredTags, type CnasFormValues } from "@/lib/cnas";
import { prisma } from "@/lib/prisma";
import { upsertLeadSourceAttribution } from "@/lib/source-attribution";
import { createFirstFollowTask, createHighIntentTask, createTaskWithAudit } from "@/lib/tasks";
import { getDefaultTenantUser } from "@/lib/tenant";

type WecomContactProfile = {
  externalUserId: string;
  name?: string | null;
  avatar?: string | null;
  corpName?: string | null;
  position?: string | null;
  gender?: number | null;
  unionId?: string | null;
};

export type WecomExternalContactEventInput = {
  tenant: Tenant;
  externalUserId: string;
  wecomUserId?: string | null;
  state?: string | null;
  eventId?: string | null;
  addedAt?: Date;
};

function mergeJsonRecord(existing: unknown, next: Record<string, unknown>): Prisma.InputJsonValue {
  if (!existing || typeof existing !== "object" || Array.isArray(existing)) {
    return next as Prisma.InputJsonValue;
  }
  return { ...(existing as Record<string, unknown>), ...next } as Prisma.InputJsonValue;
}

function mockContactProfile(externalUserId: string): WecomContactProfile {
  const suffix = externalUserId.split("_").pop() ?? Date.now().toString().slice(-6);
  return {
    externalUserId,
    name: `企微CNAS真实客户${suffix}`,
    corpName: `CNAS企微实验室${suffix}`
  };
}

async function fetchAccessToken(config: { corpId?: string | null; secretEncrypted?: string | null }) {
  if (!config.corpId || !config.secretEncrypted) {
    throw new Error("CorpID 或 Secret 未配置，无法拉取企业微信 access_token。");
  }

  const response = await fetch(
    `https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${encodeURIComponent(config.corpId)}&corpsecret=${encodeURIComponent(config.secretEncrypted)}`,
    { cache: "no-store" }
  );
  const data = (await response.json()) as { errcode?: number; errmsg?: string; access_token?: string };
  if (data.errcode && data.errcode !== 0) {
    throw new Error(`企业微信 access_token 获取失败：${data.errmsg ?? data.errcode}`);
  }
  if (!data.access_token) {
    throw new Error("企业微信 access_token 响应缺少 access_token。");
  }
  return data.access_token;
}

async function fetchExternalContactProfile(input: {
  tenantId: string;
  externalUserId: string;
}): Promise<WecomContactProfile> {
  // smoke 与本地联调使用 wm_mock / wm_v27 前缀，避免测试依赖真实企业微信网络。
  // 真实回调会走下方 access_token + externalcontact/get 的轻量资料拉取。
  if (/^wm_(mock|v27|test)/.test(input.externalUserId)) {
    return mockContactProfile(input.externalUserId);
  }

  const config = await prisma.weComConfig.findUnique({ where: { tenantId: input.tenantId } });
  const accessToken = await fetchAccessToken({
    corpId: config?.corpId,
    secretEncrypted: config?.secretEncrypted
  });
  const response = await fetch(
    `https://qyapi.weixin.qq.com/cgi-bin/externalcontact/get?access_token=${encodeURIComponent(accessToken)}&external_userid=${encodeURIComponent(input.externalUserId)}`,
    { cache: "no-store" }
  );
  const data = (await response.json()) as {
    errcode?: number;
    errmsg?: string;
    external_contact?: {
      external_userid?: string;
      name?: string;
      avatar?: string;
      corp_name?: string;
      position?: string;
      gender?: number;
      unionid?: string;
    };
  };

  if (data.errcode && data.errcode !== 0) {
    throw new Error(`企业微信外部联系人拉取失败：${data.errmsg ?? data.errcode}`);
  }
  const contact = data.external_contact;
  if (!contact?.external_userid) {
    throw new Error("企业微信外部联系人响应缺少 external_userid。");
  }

  return {
    externalUserId: contact.external_userid,
    name: contact.name,
    avatar: contact.avatar,
    corpName: contact.corp_name,
    position: contact.position,
    gender: contact.gender,
    unionId: contact.unionid
  };
}

function buildCnasValues(profile: WecomContactProfile, addedAt: Date, state?: string | null): CnasFormValues {
  return {
    company: profile.corpName ?? "企微未填写企业",
    contactName: profile.name ?? profile.externalUserId,
    phone: "",
    labType: "检测实验室",
    currentStage: "刚开始了解",
    scopeClarity: "还不清楚",
    readiness: "不确定",
    primaryConcern: "不知道从哪开始",
    startPlan: "只是先了解",
    wecomAdded: "是",
    note: `来自企业微信真实轻接入，external_userid=${profile.externalUserId}`,
    sourcePage: "/api/wecom/[tenantSlug]/callback",
    utmSource: "wecom",
    utmMedium: "callback",
    utmCampaign: state ?? "cnas-wecom-real-intake",
    utmContent: "add_external_contact",
    submittedAt: addedAt.toISOString()
  };
}

async function resolveOwner(input: { tenantId: string; wecomUserId?: string | null }) {
  if (input.wecomUserId) {
    const binding = await prisma.userWecomBinding.findFirst({
      where: {
        tenantId: input.tenantId,
        wecomUserId: input.wecomUserId,
        enabled: true,
        user: { status: "active" }
      },
      include: { user: true }
    });
    if (binding?.user) return binding.user;
  }
  return getDefaultTenantUser(input.tenantId);
}

export async function intakeWecomExternalContact(input: WecomExternalContactEventInput) {
  const addedAt = input.addedAt ?? new Date();
  const profile = await fetchExternalContactProfile({
    tenantId: input.tenant.id,
    externalUserId: input.externalUserId
  });
  const owner = await resolveOwner({
    tenantId: input.tenant.id,
    wecomUserId: input.wecomUserId
  });
  const isCnasTemplate = input.tenant.templateKey === "cnas-pilot";
  const cnasValues = isCnasTemplate ? buildCnasValues(profile, addedAt, input.state) : null;
  const cnasResult = cnasValues ? getCnasDiagnosisResult(cnasValues) : null;
  const existingLead = await prisma.lead.findFirst({
    where: {
      tenantId: input.tenant.id,
      OR: [
        { wechat: profile.externalUserId },
        {
          extraData: {
            path: ["wecomRealIntake", "externalUserId"],
            equals: profile.externalUserId
          }
        }
      ]
    },
    orderBy: { updatedAt: "desc" }
  });

  const extraData = mergeJsonRecord(existingLead?.extraData, {
    wecomRealIntake: {
      sourceChannel: "企业微信",
      externalUserId: profile.externalUserId,
      wecomUserId: input.wecomUserId ?? null,
      state: input.state ?? null,
      addedAt: addedAt.toISOString(),
      ownerId: owner?.id ?? null,
      ownerName: owner?.name ?? null,
      avatar: profile.avatar ?? null,
      corpName: profile.corpName ?? null,
      position: profile.position ?? null,
      unionId: profile.unionId ?? null,
      intakeStatus: "已承接",
      boundary: "仅承接外部联系人新增事件，不做聊天同步、自动回复、AI Agent 或会话存档。"
    },
    ...(cnasValues && cnasResult ? buildCnasExtraData(cnasValues, cnasResult) : {})
  });
  const nextFollowAt = cnasResult ? addMinutes(addedAt, cnasResult.dueInMinutes) : undefined;

  const lead = existingLead
    ? await prisma.lead.update({
        where: { id: existingLead.id },
        data: {
          name: profile.name ?? existingLead.name,
          wechat: profile.externalUserId,
          company: profile.corpName ?? existingLead.company,
          source: LeadSource.other,
          customerType: isCnasTemplate ? CustomerType.OTHER : existingLead.customerType,
          needType: isCnasTemplate ? NeedType.BOOK_CONSULTATION : existingLead.needType,
          intentionLevel: cnasResult?.intentionLevel ?? existingLead.intentionLevel,
          stage: isCnasTemplate ? LeadStage.DIAGNOSED : existingLead.stage,
          message: cnasValues && cnasResult ? buildCnasLeadMessage(cnasValues, cnasResult) : existingLead.message,
          ownerId: existingLead.ownerId ?? owner?.id ?? null,
          nextFollowAt,
          extraData
        }
      })
    : await prisma.lead.create({
        data: {
          tenantId: input.tenant.id,
          name: profile.name ?? profile.externalUserId,
          phone: "",
          wechat: profile.externalUserId,
          company: profile.corpName,
          source: LeadSource.other,
          customerType: CustomerType.OTHER,
          needType: isCnasTemplate ? NeedType.BOOK_CONSULTATION : NeedType.OTHER,
          intentionLevel: cnasResult?.intentionLevel ?? IntentionLevel.MEDIUM,
          stage: isCnasTemplate ? LeadStage.DIAGNOSED : LeadStage.NEW,
          message: cnasValues && cnasResult ? buildCnasLeadMessage(cnasValues, cnasResult) : "来自企业微信外部联系人新增事件。",
          ownerId: owner?.id ?? null,
          nextFollowAt,
          extraData
        }
      });

  await upsertLeadSourceAttribution({
    db: prisma,
    tenantId: input.tenant.id,
    leadId: lead.id,
    attribution: {
      sourceChannel: "企业微信",
      sourceProject: isCnasTemplate ? CNAS_BUSINESS_LINE_NAME : "企业微信客户承接",
      sourceCampaign: input.state ?? "cnas-wecom-real-intake",
      sourceScene: "客户扫码添加企微",
      sourceTouchpoint: "add_external_contact",
      sourceStaffName: owner?.name,
      sourceStaffId: owner?.id,
      sourcePage: `/api/wecom/${input.tenant.slug}/callback`,
      sourceContent: `external_userid=${profile.externalUserId}`,
      utmSource: "wecom",
      utmMedium: "callback",
      utmCampaign: input.state ?? "cnas-wecom-real-intake",
      utmContent: "add_external_contact",
      firstSeenAt: addedAt,
      submittedAt: addedAt
    }
  });

  const tagSeeds = [
    { tagName: "企业微信客户", tagGroup: TagGroup.CUSTOM },
    { tagName: "真实企微承接", tagGroup: TagGroup.CUSTOM },
    { tagName: isCnasTemplate ? CNAS_BUSINESS_LINE_NAME : "企业微信", tagGroup: TagGroup.BUSINESS_LINE },
    ...(cnasResult ? getCnasStructuredTags(cnasResult) : [])
  ];
  const existingTags = await prisma.leadTag.findMany({ where: { tenantId: input.tenant.id, leadId: lead.id } });
  const existingTagKeys = new Set(existingTags.map((tag) => `${tag.tagGroup}::${tag.tagName}`));
  const tagsToCreate = tagSeeds.filter((tag) => !existingTagKeys.has(`${tag.tagGroup}::${tag.tagName}`));
  if (tagsToCreate.length) {
    await prisma.leadTag.createMany({
      data: tagsToCreate.map((tag) => ({
        tenantId: input.tenant.id,
        leadId: lead.id,
        tagName: tag.tagName,
        tagGroup: tag.tagGroup
      }))
    });
  }

  if (cnasResult && lead.ownerId) {
    await createTaskWithAudit({
      tenantId: input.tenant.id,
      leadId: lead.id,
      ownerId: lead.ownerId,
      title: cnasResult.taskTitle,
      description: `${cnasResult.taskDescription} 来源：企业微信真实轻接入。`,
      type:
        cnasResult.diagnosisType === "A"
          ? FollowTaskType.PHONE_CALL
          : cnasResult.diagnosisType === "B"
            ? FollowTaskType.SEND_MATERIAL
            : FollowTaskType.WECHAT_FOLLOW,
      priority: cnasResult.taskPriority,
      dueAt: nextFollowAt,
      auditAction: "wecom_real_intake_cnas_task_created",
      auditMetadata: {
        leadId: lead.id,
        eventId: input.eventId ?? null,
        externalUserId: profile.externalUserId,
        businessLine: CNAS_BUSINESS_LINE_SLUG,
        diagnosisType: cnasResult.diagnosisType
      }
    });
  } else {
    await createFirstFollowTask(lead);
    await createHighIntentTask(lead);
  }

  return { lead, profile, owner };
}
