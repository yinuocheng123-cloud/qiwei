/*
 * 文件说明：该文件实现 V1.9.2 客户来源归因的通用解析与落库工具。
 * 功能说明：统一处理 URL 参数、表单隐藏字段、来源归因写入与审计记录，供公开表单、导入和后续其它入口复用。
 *
 * 结构概览：
 *   第一部分：类型与常量
 *   第二部分：查询参数 / 表单解析工具
 *   第三部分：来源归因归一化与辅助函数
 *   第四部分：来源归因落库与审计
 */
import { type LeadSourceAttribution, type Prisma } from "@prisma/client";
import { safeWriteAuditLog } from "@/lib/audit";

type SearchParams = Record<string, string | string[] | undefined>;

export type LeadSourceAttributionInput = {
  sourceChannel?: string | null;
  sourceProject?: string | null;
  sourceCampaign?: string | null;
  sourceScene?: string | null;
  sourceTouchpoint?: string | null;
  sourceQrCode?: string | null;
  sourceStaffName?: string | null;
  sourceStaffId?: string | null;
  sourcePage?: string | null;
  sourceContent?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmContent?: string | null;
  utmTerm?: string | null;
  firstSeenAt?: Date | string | null;
  submittedAt?: Date | string | null;
};

type NormalizedLeadSourceAttributionInput = Omit<LeadSourceAttributionInput, "firstSeenAt" | "submittedAt"> & {
  firstSeenAt?: Date;
  submittedAt?: Date;
};

type SourceAttributionDb = {
  user: {
    findFirst: (args: Prisma.UserFindFirstArgs) => Promise<{ id: string } | null>;
  };
  leadSourceAttribution: {
    findUnique: (args: Prisma.LeadSourceAttributionFindUniqueArgs) => Promise<LeadSourceAttribution | null>;
    create: (args: Prisma.LeadSourceAttributionCreateArgs) => Promise<LeadSourceAttribution>;
    update: (args: Prisma.LeadSourceAttributionUpdateArgs) => Promise<LeadSourceAttribution>;
  };
};

export const sourceAttributionQueryKeys = [
  "source_channel",
  "source_project",
  "source_campaign",
  "source_scene",
  "source_touchpoint",
  "source_qr",
  "source_staff",
  "source_staff_id",
  "source_page",
  "source_content",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term"
] as const;

function trimText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function pickSearchValue(searchParams: SearchParams, key: string) {
  const value = searchParams[key];
  if (typeof value === "string") {
    return trimText(value);
  }
  return Array.isArray(value) ? trimText(value[0]) : undefined;
}

function pickFormValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? trimText(value) : undefined;
}

function normalizeDate(value?: Date | string | null) {
  if (!value) return undefined;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function normalizeSourceAttributionInput(input: LeadSourceAttributionInput): NormalizedLeadSourceAttributionInput {
  return {
    sourceChannel: trimText(input.sourceChannel ?? undefined),
    sourceProject: trimText(input.sourceProject ?? undefined),
    sourceCampaign: trimText(input.sourceCampaign ?? undefined),
    sourceScene: trimText(input.sourceScene ?? undefined),
    sourceTouchpoint: trimText(input.sourceTouchpoint ?? undefined),
    sourceQrCode: trimText(input.sourceQrCode ?? undefined),
    sourceStaffName: trimText(input.sourceStaffName ?? undefined),
    sourceStaffId: trimText(input.sourceStaffId ?? undefined),
    sourcePage: trimText(input.sourcePage ?? undefined),
    sourceContent: trimText(input.sourceContent ?? undefined),
    utmSource: trimText(input.utmSource ?? undefined),
    utmMedium: trimText(input.utmMedium ?? undefined),
    utmCampaign: trimText(input.utmCampaign ?? undefined),
    utmContent: trimText(input.utmContent ?? undefined),
    utmTerm: trimText(input.utmTerm ?? undefined),
    firstSeenAt: normalizeDate(input.firstSeenAt),
    submittedAt: normalizeDate(input.submittedAt)
  };
}

function buildAttributionMetadata(leadId: string, input: LeadSourceAttributionInput) {
  return {
    leadId,
    sourceChannel: input.sourceChannel ?? null,
    sourceProject: input.sourceProject ?? null,
    sourceCampaign: input.sourceCampaign ?? null,
    sourceScene: input.sourceScene ?? null,
    sourceTouchpoint: input.sourceTouchpoint ?? null,
    sourceQrCode: input.sourceQrCode ?? null,
    sourceStaffName: input.sourceStaffName ?? null,
    utmSource: input.utmSource ?? null,
    utmCampaign: input.utmCampaign ?? null
  } satisfies Prisma.InputJsonValue;
}

function hasAttributionValue(input: NormalizedLeadSourceAttributionInput) {
  return Boolean(
    input.sourceChannel ||
      input.sourceProject ||
      input.sourceCampaign ||
      input.sourceScene ||
      input.sourceTouchpoint ||
      input.sourceQrCode ||
      input.sourceStaffName ||
      input.sourceStaffId ||
      input.sourcePage ||
      input.sourceContent ||
      input.utmSource ||
      input.utmMedium ||
      input.utmCampaign ||
      input.utmContent ||
      input.utmTerm
  );
}

function normalizeComparisonValue(value: unknown) {
  if (value instanceof Date) {
    return value.getTime();
  }
  return value ?? null;
}

function mergePreservingFirstSource(
  existing: LeadSourceAttribution,
  incoming: Required<
    Pick<
      LeadSourceAttribution,
      | "sourceChannel"
      | "sourceProject"
      | "sourceCampaign"
      | "sourceScene"
      | "sourceTouchpoint"
      | "sourceQrCode"
      | "sourceStaffName"
      | "sourceStaffId"
      | "sourcePage"
      | "sourceContent"
      | "utmSource"
      | "utmMedium"
      | "utmCampaign"
      | "utmContent"
      | "utmTerm"
      | "firstSeenAt"
      | "submittedAt"
    >
  >
) {
  return {
    sourceChannel: existing.sourceChannel ?? incoming.sourceChannel,
    sourceProject: existing.sourceProject ?? incoming.sourceProject,
    sourceCampaign: existing.sourceCampaign ?? incoming.sourceCampaign,
    sourceScene: existing.sourceScene ?? incoming.sourceScene,
    sourceTouchpoint: existing.sourceTouchpoint ?? incoming.sourceTouchpoint,
    sourceQrCode: existing.sourceQrCode ?? incoming.sourceQrCode,
    sourceStaffName: existing.sourceStaffName ?? incoming.sourceStaffName,
    sourceStaffId: existing.sourceStaffId ?? incoming.sourceStaffId,
    sourcePage: existing.sourcePage ?? incoming.sourcePage,
    sourceContent: existing.sourceContent ?? incoming.sourceContent,
    utmSource: existing.utmSource ?? incoming.utmSource,
    utmMedium: existing.utmMedium ?? incoming.utmMedium,
    utmCampaign: existing.utmCampaign ?? incoming.utmCampaign,
    utmContent: existing.utmContent ?? incoming.utmContent,
    utmTerm: existing.utmTerm ?? incoming.utmTerm,
    firstSeenAt: existing.firstSeenAt ?? incoming.firstSeenAt,
    submittedAt: existing.submittedAt ?? incoming.submittedAt
  };
}

async function resolveSourceStaffId(
  db: SourceAttributionDb,
  tenantId: string,
  input: NormalizedLeadSourceAttributionInput
) {
  if (input.sourceStaffId) {
    const byId = await db.user.findFirst({
      where: {
        id: input.sourceStaffId,
        tenantId
      },
      select: { id: true }
    });
    if (byId) {
      return byId.id;
    }
  }

  if (!input.sourceStaffName) {
    return undefined;
  }

  const byNameOrEmail = await db.user.findFirst({
    where: {
      tenantId,
      OR: [{ name: input.sourceStaffName }, { email: input.sourceStaffName }]
    },
    select: { id: true }
  });

  return byNameOrEmail?.id;
}

export function parseSourceAttributionFromSearchParams(
  searchParams: SearchParams,
  defaults: LeadSourceAttributionInput = {}
) {
  return normalizeSourceAttributionInput({
    ...defaults,
    sourceChannel: pickSearchValue(searchParams, "source_channel") ?? defaults.sourceChannel,
    sourceProject: pickSearchValue(searchParams, "source_project") ?? defaults.sourceProject,
    sourceCampaign: pickSearchValue(searchParams, "source_campaign") ?? defaults.sourceCampaign,
    sourceScene: pickSearchValue(searchParams, "source_scene") ?? defaults.sourceScene,
    sourceTouchpoint: pickSearchValue(searchParams, "source_touchpoint") ?? defaults.sourceTouchpoint,
    sourceQrCode: pickSearchValue(searchParams, "source_qr") ?? defaults.sourceQrCode,
    sourceStaffName: pickSearchValue(searchParams, "source_staff") ?? defaults.sourceStaffName,
    sourceStaffId: pickSearchValue(searchParams, "source_staff_id") ?? defaults.sourceStaffId,
    sourcePage:
      pickSearchValue(searchParams, "source_page") ??
      pickSearchValue(searchParams, "sourcePage") ??
      defaults.sourcePage,
    sourceContent: pickSearchValue(searchParams, "source_content") ?? defaults.sourceContent,
    utmSource: pickSearchValue(searchParams, "utm_source") ?? defaults.utmSource,
    utmMedium: pickSearchValue(searchParams, "utm_medium") ?? defaults.utmMedium,
    utmCampaign: pickSearchValue(searchParams, "utm_campaign") ?? defaults.utmCampaign,
    utmContent: pickSearchValue(searchParams, "utm_content") ?? defaults.utmContent,
    utmTerm: pickSearchValue(searchParams, "utm_term") ?? defaults.utmTerm
  });
}

export function parseSourceAttributionFromFormData(
  formData: FormData,
  defaults: LeadSourceAttributionInput = {}
) {
  return normalizeSourceAttributionInput({
    ...defaults,
    sourceChannel: pickFormValue(formData, "source_channel") ?? defaults.sourceChannel,
    sourceProject: pickFormValue(formData, "source_project") ?? defaults.sourceProject,
    sourceCampaign: pickFormValue(formData, "source_campaign") ?? defaults.sourceCampaign,
    sourceScene: pickFormValue(formData, "source_scene") ?? defaults.sourceScene,
    sourceTouchpoint: pickFormValue(formData, "source_touchpoint") ?? defaults.sourceTouchpoint,
    sourceQrCode: pickFormValue(formData, "source_qr") ?? defaults.sourceQrCode,
    sourceStaffName: pickFormValue(formData, "source_staff") ?? defaults.sourceStaffName,
    sourceStaffId: pickFormValue(formData, "source_staff_id") ?? defaults.sourceStaffId,
    sourcePage: pickFormValue(formData, "source_page") ?? pickFormValue(formData, "sourcePage") ?? defaults.sourcePage,
    sourceContent: pickFormValue(formData, "source_content") ?? defaults.sourceContent,
    utmSource: pickFormValue(formData, "utm_source") ?? defaults.utmSource,
    utmMedium: pickFormValue(formData, "utm_medium") ?? defaults.utmMedium,
    utmCampaign: pickFormValue(formData, "utm_campaign") ?? defaults.utmCampaign,
    utmContent: pickFormValue(formData, "utm_content") ?? defaults.utmContent,
    utmTerm: pickFormValue(formData, "utm_term") ?? defaults.utmTerm
  });
}

export async function upsertLeadSourceAttribution(input: {
  db: SourceAttributionDb;
  tenantId: string;
  leadId: string;
  userId?: string | null;
  attribution: LeadSourceAttributionInput;
}) {
  const normalized = normalizeSourceAttributionInput(input.attribution);
  if (!hasAttributionValue(normalized)) {
    return null;
  }

  const resolvedSourceStaffId = await resolveSourceStaffId(input.db, input.tenantId, normalized);
  const now = new Date();
  const prepared: Required<
    Pick<
      LeadSourceAttribution,
      | "sourceChannel"
      | "sourceProject"
      | "sourceCampaign"
      | "sourceScene"
      | "sourceTouchpoint"
      | "sourceQrCode"
      | "sourceStaffName"
      | "sourceStaffId"
      | "sourcePage"
      | "sourceContent"
      | "utmSource"
      | "utmMedium"
      | "utmCampaign"
      | "utmContent"
      | "utmTerm"
      | "firstSeenAt"
      | "submittedAt"
    >
  > = {
    sourceChannel: normalized.sourceChannel ?? null,
    sourceProject: normalized.sourceProject ?? null,
    sourceCampaign: normalized.sourceCampaign ?? null,
    sourceScene: normalized.sourceScene ?? null,
    sourceTouchpoint: normalized.sourceTouchpoint ?? null,
    sourceQrCode: normalized.sourceQrCode ?? null,
    sourceStaffName: normalized.sourceStaffName ?? null,
    sourceStaffId: resolvedSourceStaffId ?? normalized.sourceStaffId ?? null,
    sourcePage: normalized.sourcePage ?? null,
    sourceContent: normalized.sourceContent ?? null,
    utmSource: normalized.utmSource ?? null,
    utmMedium: normalized.utmMedium ?? null,
    utmCampaign: normalized.utmCampaign ?? null,
    utmContent: normalized.utmContent ?? null,
    utmTerm: normalized.utmTerm ?? null,
    firstSeenAt: normalized.firstSeenAt ?? now,
    submittedAt: normalized.submittedAt ?? normalized.firstSeenAt ?? now
  };

  const existing = await input.db.leadSourceAttribution.findUnique({
    where: { leadId: input.leadId }
  });

  if (!existing) {
    const created = await input.db.leadSourceAttribution.create({
      data: {
        tenantId: input.tenantId,
        leadId: input.leadId,
        ...prepared
      }
    });

    await safeWriteAuditLog({
      tenantId: input.tenantId,
      userId: input.userId ?? undefined,
      action: "lead_source_attribution_created",
      entityType: "LeadSourceAttribution",
      entityId: created.id,
      metadata: buildAttributionMetadata(input.leadId, normalized)
    });

    return created;
  }

  const merged = mergePreservingFirstSource(existing, prepared);
  const hasChanged = (
    Object.entries(merged) as [keyof typeof merged, (typeof merged)[keyof typeof merged]][]
  ).some(([key, value]) => normalizeComparisonValue(existing[key]) !== normalizeComparisonValue(value));

  if (!hasChanged) {
    return existing;
  }

  const updated = await input.db.leadSourceAttribution.update({
    where: { id: existing.id },
    data: merged
  });

  await safeWriteAuditLog({
    tenantId: input.tenantId,
    userId: input.userId ?? undefined,
    action: "lead_source_attribution_updated",
    entityType: "LeadSourceAttribution",
    entityId: updated.id,
    metadata: buildAttributionMetadata(input.leadId, normalized)
  });

  return updated;
}
