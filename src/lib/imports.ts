/*
 * 文件说明：该文件实现 V1.8 客户导入的解析、预览、去重和写入服务。
 * 功能说明：负责 CSV 模板、字段映射、导入预览、负责人解析、业务线与标签处理，以及导入落库结果汇总。
 *
 * 结构概览：
 *   第一部分：导入依赖、常量与基础类型
 *   第二部分：CSV 解析与字段映射
 *   第三部分：预览行标准化、校验与去重
 *   第四部分：导入批次重建与正式写入
 */
import {
  CustomerType,
  FollowTaskPriority,
  FollowTaskType,
  ImportBatchStatus,
  ImportRowStatus,
  IntentionLevel,
  LeadSource,
  LeadStage,
  LeadSourceAttribution,
  Prisma,
  UserRole,
  type ImportBatch,
  type ImportRow
} from "@prisma/client";
import { upsertLeadSourceAttribution, type LeadSourceAttributionInput } from "@/lib/source-attribution";
import { createTaskWithAudit } from "@/lib/tasks";

export const importTemplateHeaders = [
  "客户姓名",
  "手机号",
  "微信号",
  "公司名称",
  "客户类型",
  "来源渠道",
  "来源项目",
  "来源活动",
  "来源场景",
  "来源触点",
  "来源二维码",
  "来源人员",
  "来源页面",
  "来源内容",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "需求说明",
  "意向等级",
  "当前阶段",
  "备注",
  "业务线",
  "标签",
  "负责人邮箱",
  "下次跟进时间"
] as const;

export const importTemplateSampleRow = [
  "王总",
  "13800138000",
  "wangzong-growth",
  "整木增长工厂",
  "整木工厂老板",
  "会议活动",
  "GEO／AI推广",
  "2026整木企业GEO增长会",
  "会场入口",
  "签到台二维码",
  "event-geo-2026-door-01",
  "张老师",
  "/landing/geo-growth",
  "整木企业GEO增长会海报",
  "offline",
  "qrcode",
  "geo_growth_2026",
  "door_poster",
  "zhengmu_factory_owner",
  "想了解 GEO 服务怎么做，预算大概多少",
  "HIGH",
  "NEW",
  "来自活动现场收集",
  "GEO／AI 推广",
  "高意向，品牌增信关注",
  "platform-sales@zhengmu.local",
  "2026-05-16 10:00"
] as const;

export type ImportFieldKey =
  | "name"
  | "phone"
  | "wechat"
  | "company"
  | "customerType"
  | "source"
  | "sourceProject"
  | "sourceCampaign"
  | "sourceScene"
  | "sourceTouchpoint"
  | "sourceQrCode"
  | "sourceStaffName"
  | "sourcePage"
  | "sourceContent"
  | "utmSource"
  | "utmMedium"
  | "utmCampaign"
  | "utmContent"
  | "utmTerm"
  | "needDescription"
  | "intentionLevel"
  | "stage"
  | "note"
  | "businessLine"
  | "tags"
  | "ownerEmail"
  | "nextFollowAt";

export type ImportFieldMapping = Record<ImportFieldKey, string | null>;

export type ImportBatchMappingPayload = {
  headers: string[];
  fieldMapping: ImportFieldMapping;
};

export type ImportDefaultSettings = {
  defaultOwnerId: string | null;
  defaultTags: string[];
  defaultBusinessLineIds: string[];
  autoCreateFirstTask: boolean;
  skipDuplicates: boolean;
};

export type ImportPreviewRow = {
  rowIndex: number;
  rawData: Record<string, string>;
  normalizedData: NormalizedImportRowData | null;
  status: ImportRowStatus;
  errorMessage: string | null;
  duplicateLeadId: string | null;
};

export type NormalizedImportRowData = {
  name: string;
  phone: string;
  wechat: string;
  company: string;
  customerType: CustomerType;
  source: LeadSource;
  sourceAttribution: LeadSourceAttributionInput;
  needDescription: string;
  intentionLevel: IntentionLevel;
  stage: LeadStage;
  note: string;
  ownerEmail: string;
  ownerId: string | null;
  nextFollowAt: string | null;
  tags: string[];
  businessLineNames: string[];
  businessLineIds: string[];
  message: string | null;
};

export type ImportBatchRebuildResult = {
  mapping: ImportBatchMappingPayload;
  defaults: ImportDefaultSettings;
  rows: ImportPreviewRow[];
  summary: {
    totalRows: number;
    successRows: number;
    failedRows: number;
    duplicateRows: number;
    skippedRows: number;
    generatedTaskRows: number;
    errorSummary: { rowIndex: number; errorMessage: string }[];
  };
};

export const importFieldDefinitions: { key: ImportFieldKey; label: string }[] = [
  { key: "name", label: "客户姓名" },
  { key: "phone", label: "手机号" },
  { key: "wechat", label: "微信号" },
  { key: "company", label: "公司名称" },
  { key: "customerType", label: "客户类型" },
  { key: "source", label: "来源渠道" },
  { key: "sourceProject", label: "来源项目" },
  { key: "sourceCampaign", label: "来源活动" },
  { key: "sourceScene", label: "来源场景" },
  { key: "sourceTouchpoint", label: "来源触点" },
  { key: "sourceQrCode", label: "来源二维码" },
  { key: "sourceStaffName", label: "来源人员" },
  { key: "sourcePage", label: "来源页面" },
  { key: "sourceContent", label: "来源内容" },
  { key: "utmSource", label: "utm_source" },
  { key: "utmMedium", label: "utm_medium" },
  { key: "utmCampaign", label: "utm_campaign" },
  { key: "utmContent", label: "utm_content" },
  { key: "utmTerm", label: "utm_term" },
  { key: "needDescription", label: "需求说明" },
  { key: "intentionLevel", label: "意向等级" },
  { key: "stage", label: "当前阶段" },
  { key: "note", label: "备注" },
  { key: "businessLine", label: "业务线" },
  { key: "tags", label: "标签" },
  { key: "ownerEmail", label: "负责人邮箱" },
  { key: "nextFollowAt", label: "下次跟进时间" }
];

const headerAliases: Record<ImportFieldKey, string[]> = {
  name: ["客户姓名", "姓名", "name"],
  phone: ["手机号", "手机", "电话", "联系电话", "phone", "mobile"],
  wechat: ["微信号", "微信", "wechat", "weixin"],
  company: ["公司名称", "公司", "企业名称", "company"],
  customerType: ["客户类型", "类型", "customerType"],
  source: ["来源渠道", "来源", "渠道", "source"],
  sourceProject: ["来源项目", "项目", "sourceProject"],
  sourceCampaign: ["来源活动", "来源campaign", "活动", "campaign", "sourceCampaign"],
  sourceScene: ["来源场景", "场景", "sourceScene"],
  sourceTouchpoint: ["来源触点", "触点", "sourceTouchpoint"],
  sourceQrCode: ["来源二维码", "二维码", "二维码编号", "sourceQrCode", "sourceQr"],
  sourceStaffName: ["来源人员", "来源业务员", "承接人员", "sourceStaff", "sourceStaffName"],
  sourcePage: ["来源页面", "页面", "sourcePage"],
  sourceContent: ["来源内容", "内容标题", "sourceContent"],
  utmSource: ["utm_source", "UTM Source", "utmSource"],
  utmMedium: ["utm_medium", "UTM Medium", "utmMedium"],
  utmCampaign: ["utm_campaign", "UTM Campaign", "utmCampaign"],
  utmContent: ["utm_content", "UTM Content", "utmContent"],
  utmTerm: ["utm_term", "UTM Term", "utmTerm"],
  needDescription: ["需求说明", "需求", "咨询内容", "message", "needDescription"],
  intentionLevel: ["意向等级", "意向", "intentionLevel"],
  stage: ["当前阶段", "阶段", "stage"],
  note: ["备注", "补充说明", "note", "remark"],
  businessLine: ["业务线", "产品线", "项目线", "businessLine"],
  tags: ["标签", "客户标签", "tags", "tag"],
  ownerEmail: ["负责人邮箱", "销售邮箱", "ownerEmail", "负责人", "owner"],
  nextFollowAt: ["下次跟进时间", "跟进时间", "nextFollowAt", "下次联系时间"]
};

const customerTypeAliasMap = new Map<string, CustomerType>([
  ["OWNER_CLIENT", CustomerType.OWNER_CLIENT],
  ["业主客户", CustomerType.OWNER_CLIENT],
  ["DEALER_CLIENT", CustomerType.DEALER_CLIENT],
  ["经销商客户", CustomerType.DEALER_CLIENT],
  ["DESIGNER_CLIENT", CustomerType.DESIGNER_CLIENT],
  ["设计师客户", CustomerType.DESIGNER_CLIENT],
  ["FACTORY_CLIENT", CustomerType.FACTORY_CLIENT],
  ["工厂客户", CustomerType.FACTORY_CLIENT],
  ["CHANNEL_PARTNER", CustomerType.CHANNEL_PARTNER],
  ["渠道伙伴", CustomerType.CHANNEL_PARTNER],
  ["OLD_CLIENT", CustomerType.OLD_CLIENT],
  ["老客户", CustomerType.OLD_CLIENT],
  ["PLATFORM_FACTORY_OWNER", CustomerType.PLATFORM_FACTORY_OWNER],
  ["整木工厂老板", CustomerType.PLATFORM_FACTORY_OWNER],
  ["PLATFORM_MEMBERSHIP_CLIENT", CustomerType.PLATFORM_MEMBERSHIP_CLIENT],
  ["会员意向客户", CustomerType.PLATFORM_MEMBERSHIP_CLIENT],
  ["PLATFORM_GEO_AI_CLIENT", CustomerType.PLATFORM_GEO_AI_CLIENT],
  ["GEO／AI 推广客户", CustomerType.PLATFORM_GEO_AI_CLIENT],
  ["GEO/AI 推广客户", CustomerType.PLATFORM_GEO_AI_CLIENT],
  ["PLATFORM_TRAINING_CLIENT", CustomerType.PLATFORM_TRAINING_CLIENT],
  ["培训课程客户", CustomerType.PLATFORM_TRAINING_CLIENT],
  ["PLATFORM_EVENT_RESOURCE_CLIENT", CustomerType.PLATFORM_EVENT_RESOURCE_CLIENT],
  ["活动／乌镇资源客户", CustomerType.PLATFORM_EVENT_RESOURCE_CLIENT],
  ["活动/乌镇资源客户", CustomerType.PLATFORM_EVENT_RESOURCE_CLIENT],
  ["PLATFORM_SUPPLY_CHAIN_CLIENT", CustomerType.PLATFORM_SUPPLY_CHAIN_CLIENT],
  ["供应链／集采客户", CustomerType.PLATFORM_SUPPLY_CHAIN_CLIENT],
  ["供应链/集采客户", CustomerType.PLATFORM_SUPPLY_CHAIN_CLIENT],
  ["PLATFORM_AFTERMARKET_CLIENT", CustomerType.PLATFORM_AFTERMARKET_CLIENT],
  ["一清一护后市场客户", CustomerType.PLATFORM_AFTERMARKET_CLIENT],
  ["PLATFORM_PARTNER_CLIENT", CustomerType.PLATFORM_PARTNER_CLIENT],
  ["合作伙伴客户", CustomerType.PLATFORM_PARTNER_CLIENT],
  ["OTHER", CustomerType.OTHER],
  ["其他", CustomerType.OTHER]
]);

const leadSourceAliasMap = new Map<string, LeadSource>([
  ["DOUYIN", LeadSource.douyin],
  ["抖音", LeadSource.douyin],
  ["XIAOHONGSHU", LeadSource.xiaohongshu],
  ["小红书", LeadSource.xiaohongshu],
  ["SHIPINHAO", LeadSource.shipinhao],
  ["视频号", LeadSource.shipinhao],
  ["GONGZHONGHAO", LeadSource.gongzhonghao],
  ["公众号", LeadSource.gongzhonghao],
  ["WEBSITE", LeadSource.website],
  ["网站咨询", LeadSource.website],
  ["官网", LeadSource.website],
  ["FRIEND_CIRCLE", LeadSource.friend_circle],
  ["朋友圈", LeadSource.friend_circle],
  ["OFFLINE_EVENT", LeadSource.offline_event],
  ["会议活动", LeadSource.offline_event],
  ["线下活动", LeadSource.offline_event],
  ["REFERRAL", LeadSource.referral],
  ["转介绍", LeadSource.referral],
  ["老客户", LeadSource.referral],
  ["IMPORTED", LeadSource.imported],
  ["IMPORT", LeadSource.imported],
  ["导入", LeadSource.imported],
  ["OTHER", LeadSource.other],
  ["其他", LeadSource.other]
]);

const intentionAliasMap = new Map<string, IntentionLevel>([
  ["LOW", IntentionLevel.LOW],
  ["低", IntentionLevel.LOW],
  ["MEDIUM", IntentionLevel.MEDIUM],
  ["中", IntentionLevel.MEDIUM],
  ["HIGH", IntentionLevel.HIGH],
  ["高", IntentionLevel.HIGH],
  ["STRONG", IntentionLevel.STRONG],
  ["强", IntentionLevel.STRONG]
]);

const stageAliasMap = new Map<string, LeadStage>([
  ["NEW", LeadStage.NEW],
  ["新线索", LeadStage.NEW],
  ["MATERIAL_SENT", LeadStage.MATERIAL_SENT],
  ["已发资料", LeadStage.MATERIAL_SENT],
  ["CONTACTED", LeadStage.CONTACTED],
  ["已联系", LeadStage.CONTACTED],
  ["DIAGNOSED", LeadStage.DIAGNOSED],
  ["已诊断", LeadStage.DIAGNOSED],
  ["QUOTED", LeadStage.QUOTED],
  ["已报价", LeadStage.QUOTED],
  ["PENDING_DEAL", LeadStage.PENDING_DEAL],
  ["待成交", LeadStage.PENDING_DEAL],
  ["DEAL_DONE", LeadStage.DEAL_DONE],
  ["已成交", LeadStage.DEAL_DONE],
  ["LOST", LeadStage.LOST],
  ["已流失", LeadStage.LOST],
  ["TO_REACTIVATE", LeadStage.TO_REACTIVATE],
  ["待激活", LeadStage.TO_REACTIVATE]
]);

type ImportReferenceData = {
  existingLeads: {
    id: string;
    phone: string;
    wechat: string | null;
    name: string;
    company: string | null;
  }[];
  ownerMap: Map<string, { id: string; role: UserRole }>;
  sourceStaffByEmail: Map<string, { id: string; name: string }>;
  sourceStaffByName: Map<string, { id: string; name: string }>;
  activeBusinessLineByName: Map<string, { id: string; name: string }>;
  activeBusinessLineBySlug: Map<string, { id: string; name: string }>;
  defaultBusinessLinesById: Map<string, { id: string; name: string }>;
};

function normalizeHeaderToken(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}

function normalizeLooseText(value: string) {
  return value.trim().replace(/\s+/g, "");
}

function normalizeUpperText(value: string) {
  return normalizeLooseText(value).toUpperCase();
}

function splitMultiValue(value?: string | null) {
  return (value ?? "")
    .split(/[，,；;、\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function dedupeStrings(values: string[]) {
  return [...new Set(values.map((item) => item.trim()).filter(Boolean))];
}

function toRecord(value: Prisma.JsonValue | null | undefined) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function createEmptyFieldMapping(): ImportFieldMapping {
  return {
    name: null,
    phone: null,
    wechat: null,
    company: null,
    customerType: null,
    source: null,
    sourceProject: null,
    sourceCampaign: null,
    sourceScene: null,
    sourceTouchpoint: null,
    sourceQrCode: null,
    sourceStaffName: null,
    sourcePage: null,
    sourceContent: null,
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
    utmContent: null,
    utmTerm: null,
    needDescription: null,
    intentionLevel: null,
    stage: null,
    note: null,
    businessLine: null,
    tags: null,
    ownerEmail: null,
    nextFollowAt: null
  };
}

export function parseCsvText(content: string) {
  const text = content.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let currentCell = "";
  let currentRow: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentCell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && char === ",") {
      currentRow.push(currentCell);
      currentCell = "";
      continue;
    }

    if (!inQuotes && (char === "\n" || char === "\r")) {
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }
      currentRow.push(currentCell);
      currentCell = "";
      if (currentRow.some((cell) => cell.trim().length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      continue;
    }

    currentCell += char;
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell);
    if (currentRow.some((cell) => cell.trim().length > 0)) {
      rows.push(currentRow);
    }
  }

  const [headerRow = [], ...dataRows] = rows;
  const headers = headerRow.map((header, index) => header.trim() || `列${index + 1}`);
  const rawRows = dataRows.map((cells) =>
    Object.fromEntries(headers.map((header, index) => [header, (cells[index] ?? "").trim()]))
  );

  return { headers, rawRows };
}

export function buildAutoImportFieldMapping(headers: string[]): ImportFieldMapping {
  const mapping = createEmptyFieldMapping();
  const normalizedHeaders = headers.map((header) => ({ header, normalized: normalizeHeaderToken(header) }));

  for (const definition of importFieldDefinitions) {
    const aliasSet = new Set(headerAliases[definition.key].map(normalizeHeaderToken));
    const matched = normalizedHeaders.find((item) => aliasSet.has(item.normalized));
    mapping[definition.key] = matched?.header ?? null;
  }

  return mapping;
}

export function parseImportBatchMapping(value: Prisma.JsonValue | null | undefined): ImportBatchMappingPayload {
  const record = toRecord(value);
  const headers = Array.isArray(record?.headers) ? record?.headers.filter((item): item is string => typeof item === "string") : [];
  const savedMapping = toRecord(record?.fieldMapping as Prisma.JsonValue | undefined);
  const mapping = createEmptyFieldMapping();

  for (const definition of importFieldDefinitions) {
    const mappedHeader = savedMapping?.[definition.key];
    mapping[definition.key] = typeof mappedHeader === "string" && mappedHeader.trim() ? mappedHeader : null;
  }

  return { headers, fieldMapping: mapping };
}

export function buildImportBatchMappingPayload(headers: string[], fieldMapping: ImportFieldMapping): ImportBatchMappingPayload {
  return {
    headers,
    fieldMapping: { ...fieldMapping }
  };
}

export function parseImportDefaultSettings(batch: Pick<ImportBatch, "defaultOwnerId" | "defaultTags" | "defaultBusinessLineIds" | "autoCreateFirstTask" | "skipDuplicates">): ImportDefaultSettings {
  return {
    defaultOwnerId: batch.defaultOwnerId ?? null,
    defaultTags: Array.isArray(batch.defaultTags) ? batch.defaultTags.filter((item): item is string => typeof item === "string") : [],
    defaultBusinessLineIds: Array.isArray(batch.defaultBusinessLineIds)
      ? batch.defaultBusinessLineIds.filter((item): item is string => typeof item === "string")
      : [],
    autoCreateFirstTask: batch.autoCreateFirstTask,
    skipDuplicates: batch.skipDuplicates
  };
}

export async function readUploadedImportText(formData: FormData) {
  const csvText = formData.get("csvText");
  if (typeof csvText === "string" && csvText.trim()) {
    return {
      fileName: "manual-input.csv",
      fileType: "text/csv",
      content: csvText.trim()
    };
  }

  const csvFile = formData.get("csvFile");
  if (csvFile && typeof csvFile !== "string" && "text" in csvFile) {
    const file = csvFile as File;
    const content = await file.text();
    return {
      fileName: file.name || "uploaded.csv",
      fileType: file.type || "text/csv",
      content
    };
  }

  throw new Error("请上传 CSV 文件，或粘贴 CSV 内容。");
}

export async function loadImportReferenceData(prisma: {
  lead: { findMany: (args: Prisma.LeadFindManyArgs) => Promise<ImportReferenceData["existingLeads"]> };
  user: { findMany: (args: Prisma.UserFindManyArgs) => Promise<{ id: string; email: string; name: string; role: UserRole }[]> };
  businessLine: {
    findMany: (args: Prisma.BusinessLineFindManyArgs) => Promise<{ id: string; name: string; slug: string; status: string }[]>;
  };
}, tenantId: string): Promise<ImportReferenceData> {
  const [existingLeads, owners, activeBusinessLines] = await Promise.all([
    prisma.lead.findMany({
      where: { tenantId },
      select: { id: true, phone: true, wechat: true, name: true, company: true }
    }),
    prisma.user.findMany({
      where: {
        tenantId,
        status: "active",
        role: { in: [UserRole.SALES, UserRole.OPERATOR, UserRole.TENANT_ADMIN] }
      },
      select: { id: true, email: true, name: true, role: true }
    }),
    prisma.businessLine.findMany({
      where: { tenantId, status: "ACTIVE" },
      select: { id: true, name: true, slug: true, status: true }
    })
  ]);

  const ownerMap = new Map(owners.map((owner) => [owner.email.trim().toLowerCase(), { id: owner.id, role: owner.role }]));
  const sourceStaffByEmail = new Map(owners.map((owner) => [owner.email.trim().toLowerCase(), { id: owner.id, name: owner.name }]));
  const sourceStaffByName = new Map(owners.map((owner) => [normalizeLooseText(owner.name), { id: owner.id, name: owner.name }]));
  const activeBusinessLineByName = new Map(activeBusinessLines.map((line) => [normalizeLooseText(line.name), { id: line.id, name: line.name }]));
  const activeBusinessLineBySlug = new Map(activeBusinessLines.map((line) => [normalizeLooseText(line.slug), { id: line.id, name: line.name }]));
  const defaultBusinessLinesById = new Map(activeBusinessLines.map((line) => [line.id, { id: line.id, name: line.name }]));

  return {
    existingLeads,
    ownerMap,
    sourceStaffByEmail,
    sourceStaffByName,
    activeBusinessLineByName,
    activeBusinessLineBySlug,
    defaultBusinessLinesById
  };
}

function normalizeMappedValue(rawData: Record<string, string>, mapping: ImportFieldMapping, key: ImportFieldKey) {
  const header = mapping[key];
  if (!header) return "";
  return rawData[header]?.trim() ?? "";
}

function parseCustomerTypeValue(value: string) {
  return customerTypeAliasMap.get(normalizeUpperText(value)) ?? CustomerType.OTHER;
}

function parseLeadSourceValue(value: string) {
  return leadSourceAliasMap.get(normalizeUpperText(value)) ?? (value ? LeadSource.other : LeadSource.imported);
}

function parseIntentionLevelValue(value: string) {
  return intentionAliasMap.get(normalizeUpperText(value)) ?? IntentionLevel.MEDIUM;
}

function parseLeadStageValue(value: string) {
  return stageAliasMap.get(normalizeUpperText(value)) ?? LeadStage.NEW;
}

function parseFlexibleDate(value: string) {
  if (!value.trim()) return null;
  const candidate = value.replace(/\//g, "-").replace("T", " ");
  const normalized = /\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/.test(candidate) ? candidate.replace(" ", "T") : candidate;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function resolveSourceStaff(
  value: string,
  references: Pick<ImportReferenceData, "sourceStaffByEmail" | "sourceStaffByName">
) {
  if (!value.trim()) {
    return null;
  }

  const byEmail = references.sourceStaffByEmail.get(value.trim().toLowerCase());
  if (byEmail) {
    return byEmail;
  }

  return references.sourceStaffByName.get(normalizeLooseText(value)) ?? null;
}

function buildLeadMessage(needDescription: string, note: string) {
  const lines = [needDescription.trim(), note.trim()].filter(Boolean);
  return lines.length ? lines.join("\n\n备注：") : null;
}

function buildSourceAttributionInputFromNormalizedData(
  normalizedData: NormalizedImportRowData
): LeadSourceAttributionInput | null {
  const attribution = {
    ...normalizedData.sourceAttribution,
    sourceChannel: normalizedData.sourceAttribution.sourceChannel || normalizedData.sourceAttribution.sourceProject || normalizedData.sourceAttribution.sourceCampaign
      ? normalizedData.sourceAttribution.sourceChannel || "客户导入"
      : normalizedData.source !== LeadSource.imported
        ? normalizedData.sourceAttribution.sourceChannel || normalizedData.source
        : normalizedData.sourceAttribution.sourceChannel,
    firstSeenAt: new Date(),
    submittedAt: new Date()
  } satisfies LeadSourceAttributionInput;

  const hasValue = Object.entries(attribution).some(([key, value]) => {
    if (key === "firstSeenAt" || key === "submittedAt") {
      return false;
    }
    return typeof value === "string" ? Boolean(value.trim()) : Boolean(value);
  });

  return hasValue ? attribution : null;
}

function getDuplicateIdentityKeys(normalizedData: NormalizedImportRowData) {
  const phoneKey = normalizedData.phone ? `phone:${normalizedData.phone}` : null;
  const wechatKey = normalizedData.wechat ? `wechat:${normalizedData.wechat}` : null;
  const nameCompanyKey =
    !normalizedData.phone && !normalizedData.wechat && normalizedData.name && normalizedData.company
      ? `nameCompany:${normalizeLooseText(normalizedData.name)}::${normalizeLooseText(normalizedData.company)}`
      : null;

  return {
    primary: phoneKey ?? wechatKey ?? nameCompanyKey,
    phoneKey,
    wechatKey,
    nameCompanyKey
  };
}

function buildExistingDuplicateMaps(existingLeads: ImportReferenceData["existingLeads"]) {
  const phoneMap = new Map<string, string>();
  const wechatMap = new Map<string, string>();
  const nameCompanyMap = new Map<string, string>();

  for (const lead of existingLeads) {
    const phone = lead.phone.trim();
    if (phone) {
      phoneMap.set(phone, lead.id);
    }
    const wechat = lead.wechat?.trim();
    if (wechat) {
      wechatMap.set(wechat, lead.id);
    }
    if (!phone && !wechat && lead.name.trim() && lead.company?.trim()) {
      nameCompanyMap.set(`nameCompany:${normalizeLooseText(lead.name)}::${normalizeLooseText(lead.company)}`, lead.id);
    }
  }

  return { phoneMap, wechatMap, nameCompanyMap };
}

function parseRequestedMapping(headers: string[], formData?: FormData | null, currentMapping?: ImportFieldMapping) {
  const mapping = createEmptyFieldMapping();
  const headerSet = new Set(headers);

  for (const definition of importFieldDefinitions) {
    const requestedValue = formData?.get(`mapping_${definition.key}`);
    const candidate = typeof requestedValue === "string" && requestedValue.trim() ? requestedValue.trim() : currentMapping?.[definition.key] ?? null;
    mapping[definition.key] = candidate && headerSet.has(candidate) ? candidate : null;
  }

  return mapping;
}

function parseDefaultSettingsFromForm(formData: FormData, fallback?: Partial<ImportDefaultSettings>): ImportDefaultSettings {
  const defaultOwnerIdRaw = formData.get("defaultOwnerId");
  const defaultTagsRaw = formData.get("defaultTags");
  const defaultBusinessLineIds = formData
    .getAll("defaultBusinessLineIds")
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean);

  return {
    defaultOwnerId:
      typeof defaultOwnerIdRaw === "string" && defaultOwnerIdRaw.trim()
        ? defaultOwnerIdRaw.trim()
        : fallback?.defaultOwnerId ?? null,
    defaultTags:
      typeof defaultTagsRaw === "string" && defaultTagsRaw.trim()
        ? dedupeStrings(splitMultiValue(defaultTagsRaw))
        : fallback?.defaultTags ?? [],
    defaultBusinessLineIds: defaultBusinessLineIds.length ? dedupeStrings(defaultBusinessLineIds) : fallback?.defaultBusinessLineIds ?? [],
    autoCreateFirstTask: formData.get("autoCreateFirstTask") === "on" ? true : (fallback?.autoCreateFirstTask ?? false),
    skipDuplicates: formData.get("skipDuplicates") === "off" ? false : (fallback?.skipDuplicates ?? true)
  };
}

function buildPreviewRows(
  rawRows: Record<string, string>[],
  mapping: ImportFieldMapping,
  defaults: ImportDefaultSettings,
  references: ImportReferenceData
): ImportPreviewRow[] {
  const existingMaps = buildExistingDuplicateMaps(references.existingLeads);
  const batchDuplicateKeys = new Set<string>();

  return rawRows.map((rawData, index) => {
    const rowIndex = index + 1;
    const errors: string[] = [];

    const name = normalizeMappedValue(rawData, mapping, "name");
    const phone = normalizeMappedValue(rawData, mapping, "phone");
    const wechat = normalizeMappedValue(rawData, mapping, "wechat");
    const company = normalizeMappedValue(rawData, mapping, "company");
    const sourceChannelValue = normalizeMappedValue(rawData, mapping, "source");
    const sourceProject = normalizeMappedValue(rawData, mapping, "sourceProject");
    const sourceCampaign = normalizeMappedValue(rawData, mapping, "sourceCampaign");
    const sourceScene = normalizeMappedValue(rawData, mapping, "sourceScene");
    const sourceTouchpoint = normalizeMappedValue(rawData, mapping, "sourceTouchpoint");
    const sourceQrCode = normalizeMappedValue(rawData, mapping, "sourceQrCode");
    const sourceStaffName = normalizeMappedValue(rawData, mapping, "sourceStaffName");
    const sourcePage = normalizeMappedValue(rawData, mapping, "sourcePage");
    const sourceContent = normalizeMappedValue(rawData, mapping, "sourceContent");
    const utmSource = normalizeMappedValue(rawData, mapping, "utmSource");
    const utmMedium = normalizeMappedValue(rawData, mapping, "utmMedium");
    const utmCampaign = normalizeMappedValue(rawData, mapping, "utmCampaign");
    const utmContent = normalizeMappedValue(rawData, mapping, "utmContent");
    const utmTerm = normalizeMappedValue(rawData, mapping, "utmTerm");
    const needDescription = normalizeMappedValue(rawData, mapping, "needDescription");
    const note = normalizeMappedValue(rawData, mapping, "note");
    const ownerEmail = normalizeMappedValue(rawData, mapping, "ownerEmail").toLowerCase();
    const customerType = parseCustomerTypeValue(normalizeMappedValue(rawData, mapping, "customerType"));
    const source = parseLeadSourceValue(sourceChannelValue);
    const intentionLevel = parseIntentionLevelValue(normalizeMappedValue(rawData, mapping, "intentionLevel"));
    const stage = parseLeadStageValue(normalizeMappedValue(rawData, mapping, "stage"));
    const nextFollowAtValue = normalizeMappedValue(rawData, mapping, "nextFollowAt");
    const nextFollowAt = parseFlexibleDate(nextFollowAtValue);
    const resolvedSourceStaff = resolveSourceStaff(sourceStaffName, references);

    if (!name && !phone && !wechat) {
      errors.push("客户姓名、手机号、微信号至少填写一项。");
    }

    if (nextFollowAtValue && !nextFollowAt) {
      errors.push("下次跟进时间格式错误。");
    }

    const resolvedOwner =
      ownerEmail
        ? references.ownerMap.get(ownerEmail)
        : defaults.defaultOwnerId
          ? [...references.ownerMap.values()].find((owner) => owner.id === defaults.defaultOwnerId)
          : null;

    if (ownerEmail && !resolvedOwner) {
      errors.push("负责人邮箱未匹配到当前租户可分配用户。");
    }

    const businessLineNames = dedupeStrings([
      ...splitMultiValue(normalizeMappedValue(rawData, mapping, "businessLine")),
      ...defaults.defaultBusinessLineIds
        .map((id) => references.defaultBusinessLinesById.get(id)?.name ?? "")
        .filter(Boolean)
    ]);

    const businessLines = businessLineNames.map((value) => {
      const byName = references.activeBusinessLineByName.get(normalizeLooseText(value));
      const bySlug = references.activeBusinessLineBySlug.get(normalizeLooseText(value));
      return byName ?? bySlug ?? null;
    });

    const missingBusinessLines = businessLineNames.filter((_, itemIndex) => !businessLines[itemIndex]);
    if (missingBusinessLines.length) {
      errors.push(`业务线不存在或未启用：${missingBusinessLines.join("、")}。`);
    }

    const normalizedData: NormalizedImportRowData = {
      name,
      phone,
      wechat,
      company,
      customerType,
      source,
      sourceAttribution: {
        sourceChannel: sourceChannelValue,
        sourceProject,
        sourceCampaign,
        sourceScene,
        sourceTouchpoint,
        sourceQrCode,
        sourceStaffName,
        sourceStaffId: resolvedSourceStaff?.id ?? null,
        sourcePage,
        sourceContent,
        utmSource,
        utmMedium,
        utmCampaign,
        utmContent,
        utmTerm
      },
      needDescription,
      intentionLevel,
      stage,
      note,
      ownerEmail,
      ownerId: resolvedOwner?.id ?? defaults.defaultOwnerId ?? null,
      nextFollowAt: nextFollowAt ? nextFollowAt.toISOString() : null,
      tags: dedupeStrings([...splitMultiValue(normalizeMappedValue(rawData, mapping, "tags")), ...defaults.defaultTags]),
      businessLineNames: businessLines.filter(Boolean).map((line) => line!.name),
      businessLineIds: businessLines.filter(Boolean).map((line) => line!.id),
      message: buildLeadMessage(needDescription, note)
    };

    const duplicateKeys = getDuplicateIdentityKeys(normalizedData);
    let duplicateLeadId: string | null = null;

    if (duplicateKeys.phoneKey) {
      duplicateLeadId = existingMaps.phoneMap.get(duplicateKeys.phoneKey.replace("phone:", "")) ?? null;
    }
    if (!duplicateLeadId && duplicateKeys.wechatKey) {
      duplicateLeadId = existingMaps.wechatMap.get(duplicateKeys.wechatKey.replace("wechat:", "")) ?? null;
    }
    if (!duplicateLeadId && duplicateKeys.nameCompanyKey) {
      duplicateLeadId = existingMaps.nameCompanyMap.get(duplicateKeys.nameCompanyKey) ?? null;
    }

    if (!duplicateLeadId && duplicateKeys.primary && batchDuplicateKeys.has(duplicateKeys.primary)) {
      errors.push("与本次导入中的前序行重复。");
    }

    if (duplicateLeadId) {
      return {
        rowIndex,
        rawData,
        normalizedData,
        status: ImportRowStatus.DUPLICATE,
        errorMessage: "与当前租户已有客户重复，本轮默认跳过。",
        duplicateLeadId
      };
    }

    if (duplicateKeys.primary) {
      batchDuplicateKeys.add(duplicateKeys.primary);
    }

    if (errors.length) {
      return {
        rowIndex,
        rawData,
        normalizedData,
        status: ImportRowStatus.FAILED,
        errorMessage: errors.join(" "),
        duplicateLeadId: null
      };
    }

    return {
      rowIndex,
      rawData,
      normalizedData,
      status: ImportRowStatus.PENDING,
      errorMessage: null,
      duplicateLeadId: null
    };
  });
}

function summarizePreviewRows(rows: ImportPreviewRow[]) {
  return {
    totalRows: rows.length,
    successRows: rows.filter((row) => row.status === ImportRowStatus.PENDING).length,
    failedRows: rows.filter((row) => row.status === ImportRowStatus.FAILED).length,
    duplicateRows: rows.filter((row) => row.status === ImportRowStatus.DUPLICATE).length,
    skippedRows: 0,
    generatedTaskRows: 0,
    errorSummary: rows
      .filter((row) => row.errorMessage)
      .map((row) => ({
        rowIndex: row.rowIndex,
        errorMessage: row.errorMessage as string
      }))
      .slice(0, 20)
  };
}

export async function buildImportBatchPreview(input: {
  prisma: {
    importBatch: {
      create: (args: Prisma.ImportBatchCreateArgs) => Promise<ImportBatch>;
      update: (args: Prisma.ImportBatchUpdateArgs) => Promise<ImportBatch>;
    };
    importRow: {
      createMany: (args: Prisma.ImportRowCreateManyArgs) => Promise<Prisma.BatchPayload>;
      deleteMany: (args: Prisma.ImportRowDeleteManyArgs) => Promise<Prisma.BatchPayload>;
      findMany: (args: Prisma.ImportRowFindManyArgs) => Promise<ImportRow[]>;
      update: (args: Prisma.ImportRowUpdateArgs) => Promise<ImportRow>;
    };
    lead: { findMany: (args: Prisma.LeadFindManyArgs) => Promise<ImportReferenceData["existingLeads"]> };
    user: { findMany: (args: Prisma.UserFindManyArgs) => Promise<{ id: string; email: string; name: string; role: UserRole }[]> };
    businessLine: {
      findMany: (args: Prisma.BusinessLineFindManyArgs) => Promise<{ id: string; name: string; slug: string; status: string }[]>;
    };
  };
  tenantId: string;
  createdById: string;
  fileName: string;
  fileType: string;
  rawRows: Record<string, string>[];
  headers: string[];
  mapping: ImportFieldMapping;
  defaults: ImportDefaultSettings;
  existingBatchId?: string;
}) {
  const references = await loadImportReferenceData(input.prisma, input.tenantId);
  const rows = buildPreviewRows(input.rawRows, input.mapping, input.defaults, references);
  const summary = summarizePreviewRows(rows);
  const mappingPayload = buildImportBatchMappingPayload(input.headers, input.mapping);

  const batch = input.existingBatchId
    ? await input.prisma.importBatch.update({
        where: { id: input.existingBatchId },
        data: {
          fileName: input.fileName,
          fileType: input.fileType,
          status: ImportBatchStatus.PREVIEWED,
          totalRows: summary.totalRows,
          successRows: summary.successRows,
          failedRows: summary.failedRows,
          duplicateRows: summary.duplicateRows,
          skippedRows: 0,
          generatedTaskRows: 0,
          mapping: mappingPayload,
          defaultOwnerId: input.defaults.defaultOwnerId,
          defaultTags: input.defaults.defaultTags,
          defaultBusinessLineIds: input.defaults.defaultBusinessLineIds,
          autoCreateFirstTask: input.defaults.autoCreateFirstTask,
          skipDuplicates: input.defaults.skipDuplicates,
          errorSummary: summary.errorSummary
        }
      })
    : await input.prisma.importBatch.create({
        data: {
          tenantId: input.tenantId,
          createdById: input.createdById,
          fileName: input.fileName,
          fileType: input.fileType,
          status: ImportBatchStatus.PREVIEWED,
          totalRows: summary.totalRows,
          successRows: summary.successRows,
          failedRows: summary.failedRows,
          duplicateRows: summary.duplicateRows,
          skippedRows: 0,
          generatedTaskRows: 0,
          mapping: mappingPayload,
          defaultOwnerId: input.defaults.defaultOwnerId,
          defaultTags: input.defaults.defaultTags,
          defaultBusinessLineIds: input.defaults.defaultBusinessLineIds,
          autoCreateFirstTask: input.defaults.autoCreateFirstTask,
          skipDuplicates: input.defaults.skipDuplicates,
          errorSummary: summary.errorSummary
        }
      });

  if (input.existingBatchId) {
    await input.prisma.importRow.deleteMany({ where: { batchId: input.existingBatchId, tenantId: input.tenantId } });
  }

  if (rows.length) {
    await input.prisma.importRow.createMany({
      data: rows.map((row) => ({
        tenantId: input.tenantId,
        batchId: batch.id,
        rowIndex: row.rowIndex,
        rawData: row.rawData,
        normalizedData: row.normalizedData ?? undefined,
        status: row.status,
        errorMessage: row.errorMessage,
        duplicateLeadId: row.duplicateLeadId
      }))
    });
  }

  return { batch, rows, summary, mapping: mappingPayload };
}

export async function rebuildImportBatchPreview(input: {
  prisma: {
    importBatch: {
      findFirst: (args: Prisma.ImportBatchFindFirstArgs) => Promise<ImportBatch | null>;
      create: (args: Prisma.ImportBatchCreateArgs) => Promise<ImportBatch>;
      update: (args: Prisma.ImportBatchUpdateArgs) => Promise<ImportBatch>;
    };
    importRow: {
      findMany: (args: Prisma.ImportRowFindManyArgs) => Promise<ImportRow[]>;
      deleteMany: (args: Prisma.ImportRowDeleteManyArgs) => Promise<Prisma.BatchPayload>;
      createMany: (args: Prisma.ImportRowCreateManyArgs) => Promise<Prisma.BatchPayload>;
      update: (args: Prisma.ImportRowUpdateArgs) => Promise<ImportRow>;
    };
    lead: { findMany: (args: Prisma.LeadFindManyArgs) => Promise<ImportReferenceData["existingLeads"]> };
    user: { findMany: (args: Prisma.UserFindManyArgs) => Promise<{ id: string; email: string; name: string; role: UserRole }[]> };
    businessLine: {
      findMany: (args: Prisma.BusinessLineFindManyArgs) => Promise<{ id: string; name: string; slug: string; status: string }[]>;
    };
  };
  tenantId: string;
  batchId: string;
  formData: FormData;
}) {
  const batch = await input.prisma.importBatch.findFirst({
    where: { id: input.batchId, tenantId: input.tenantId }
  });
  if (!batch) {
    throw new Error("导入批次不存在。");
  }

  const mappingPayload = parseImportBatchMapping(batch.mapping);
  const rows = await input.prisma.importRow.findMany({
    where: { batchId: batch.id, tenantId: input.tenantId },
    orderBy: { rowIndex: "asc" }
  });
  const rawRows = rows.map((row) => {
    const record = toRecord(row.rawData);
    return Object.fromEntries(
      Object.entries(record ?? {}).map(([key, value]) => [key, typeof value === "string" ? value : String(value ?? "")])
    );
  });

  const mapping = parseRequestedMapping(mappingPayload.headers, input.formData, mappingPayload.fieldMapping);
  const defaults = parseDefaultSettingsFromForm(input.formData, parseImportDefaultSettings(batch));

  return buildImportBatchPreview({
    prisma: input.prisma,
    tenantId: input.tenantId,
    createdById: batch.createdById,
    fileName: batch.fileName,
    fileType: batch.fileType,
    rawRows,
    headers: mappingPayload.headers,
    mapping,
    defaults,
    existingBatchId: batch.id
  });
}

function parseNormalizedRowData(value: Prisma.JsonValue | null): NormalizedImportRowData | null {
  const record = toRecord(value);
  if (!record) return null;
  const sourceAttributionRecord = toRecord(record.sourceAttribution as Prisma.JsonValue | undefined);

  return {
    name: typeof record.name === "string" ? record.name : "",
    phone: typeof record.phone === "string" ? record.phone : "",
    wechat: typeof record.wechat === "string" ? record.wechat : "",
    company: typeof record.company === "string" ? record.company : "",
    customerType:
      typeof record.customerType === "string" && Object.values(CustomerType).includes(record.customerType as CustomerType)
        ? (record.customerType as CustomerType)
        : CustomerType.OTHER,
    source:
      typeof record.source === "string" && Object.values(LeadSource).includes(record.source as LeadSource)
        ? (record.source as LeadSource)
        : LeadSource.imported,
    sourceAttribution: {
      sourceChannel: typeof sourceAttributionRecord?.sourceChannel === "string" ? sourceAttributionRecord.sourceChannel : "",
      sourceProject: typeof sourceAttributionRecord?.sourceProject === "string" ? sourceAttributionRecord.sourceProject : "",
      sourceCampaign: typeof sourceAttributionRecord?.sourceCampaign === "string" ? sourceAttributionRecord.sourceCampaign : "",
      sourceScene: typeof sourceAttributionRecord?.sourceScene === "string" ? sourceAttributionRecord.sourceScene : "",
      sourceTouchpoint: typeof sourceAttributionRecord?.sourceTouchpoint === "string" ? sourceAttributionRecord.sourceTouchpoint : "",
      sourceQrCode: typeof sourceAttributionRecord?.sourceQrCode === "string" ? sourceAttributionRecord.sourceQrCode : "",
      sourceStaffName: typeof sourceAttributionRecord?.sourceStaffName === "string" ? sourceAttributionRecord.sourceStaffName : "",
      sourceStaffId: typeof sourceAttributionRecord?.sourceStaffId === "string" ? sourceAttributionRecord.sourceStaffId : null,
      sourcePage: typeof sourceAttributionRecord?.sourcePage === "string" ? sourceAttributionRecord.sourcePage : "",
      sourceContent: typeof sourceAttributionRecord?.sourceContent === "string" ? sourceAttributionRecord.sourceContent : "",
      utmSource: typeof sourceAttributionRecord?.utmSource === "string" ? sourceAttributionRecord.utmSource : "",
      utmMedium: typeof sourceAttributionRecord?.utmMedium === "string" ? sourceAttributionRecord.utmMedium : "",
      utmCampaign: typeof sourceAttributionRecord?.utmCampaign === "string" ? sourceAttributionRecord.utmCampaign : "",
      utmContent: typeof sourceAttributionRecord?.utmContent === "string" ? sourceAttributionRecord.utmContent : "",
      utmTerm: typeof sourceAttributionRecord?.utmTerm === "string" ? sourceAttributionRecord.utmTerm : ""
    },
    needDescription: typeof record.needDescription === "string" ? record.needDescription : "",
    intentionLevel:
      typeof record.intentionLevel === "string" && Object.values(IntentionLevel).includes(record.intentionLevel as IntentionLevel)
        ? (record.intentionLevel as IntentionLevel)
        : IntentionLevel.MEDIUM,
    stage:
      typeof record.stage === "string" && Object.values(LeadStage).includes(record.stage as LeadStage)
        ? (record.stage as LeadStage)
        : LeadStage.NEW,
    note: typeof record.note === "string" ? record.note : "",
    ownerEmail: typeof record.ownerEmail === "string" ? record.ownerEmail : "",
    ownerId: typeof record.ownerId === "string" && record.ownerId ? record.ownerId : null,
    nextFollowAt: typeof record.nextFollowAt === "string" && record.nextFollowAt ? record.nextFollowAt : null,
    tags: Array.isArray(record.tags) ? record.tags.filter((item): item is string => typeof item === "string") : [],
    businessLineNames: Array.isArray(record.businessLineNames)
      ? record.businessLineNames.filter((item): item is string => typeof item === "string")
      : [],
    businessLineIds: Array.isArray(record.businessLineIds) ? record.businessLineIds.filter((item): item is string => typeof item === "string") : [],
    message: typeof record.message === "string" && record.message ? record.message : null
  };
}

async function ensureLeadTags(input: {
  prisma: {
    leadTag: {
      findMany: (args: Prisma.LeadTagFindManyArgs) => Promise<{ tagName: string; tagGroup: string }[]>;
      createMany: (args: Prisma.LeadTagCreateManyArgs) => Promise<Prisma.BatchPayload>;
    };
  };
  tenantId: string;
  leadId: string;
  normalizedData: NormalizedImportRowData;
}) {
  const existingTags = await input.prisma.leadTag.findMany({
    where: { tenantId: input.tenantId, leadId: input.leadId },
    select: { tagName: true, tagGroup: true }
  });
  const existingKeys = new Set(existingTags.map((tag) => `${tag.tagGroup}::${tag.tagName}`));
  const rows: { tenantId: string; leadId: string; tagName: string; tagGroup: "IMPORTED" | "BUSINESS_LINE" }[] = [];

  for (const tagName of input.normalizedData.tags) {
    const key = `IMPORTED::${tagName}`;
    if (!existingKeys.has(key)) {
      existingKeys.add(key);
      rows.push({ tenantId: input.tenantId, leadId: input.leadId, tagName, tagGroup: "IMPORTED" });
    }
  }

  for (const businessLineName of input.normalizedData.businessLineNames) {
    const key = `BUSINESS_LINE::${businessLineName}`;
    if (!existingKeys.has(key)) {
      existingKeys.add(key);
      rows.push({ tenantId: input.tenantId, leadId: input.leadId, tagName: businessLineName, tagGroup: "BUSINESS_LINE" });
    }
  }

  if (rows.length) {
    await input.prisma.leadTag.createMany({ data: rows });
  }
}

export async function completeImportBatch(input: {
  prisma: {
    importBatch: {
      findFirst: (args: Prisma.ImportBatchFindFirstArgs) => Promise<ImportBatch | null>;
      update: (args: Prisma.ImportBatchUpdateArgs) => Promise<ImportBatch>;
    };
    importRow: {
      findMany: (args: Prisma.ImportRowFindManyArgs) => Promise<ImportRow[]>;
      update: (args: Prisma.ImportRowUpdateArgs) => Promise<ImportRow>;
    };
    lead: {
      create: (args: Prisma.LeadCreateArgs) => Promise<{ id: string }>;
      findMany: (args: Prisma.LeadFindManyArgs) => Promise<ImportReferenceData["existingLeads"]>;
    };
    leadTag: {
      findMany: (args: Prisma.LeadTagFindManyArgs) => Promise<{ tagName: string; tagGroup: string }[]>;
      createMany: (args: Prisma.LeadTagCreateManyArgs) => Promise<Prisma.BatchPayload>;
    };
    user: {
      findMany: (args: Prisma.UserFindManyArgs) => Promise<{ id: string; email: string; name: string; role: UserRole }[]>;
      findFirst: (args: Prisma.UserFindFirstArgs) => Promise<{ id: string } | null>;
    };
    leadSourceAttribution: {
      findUnique: (args: Prisma.LeadSourceAttributionFindUniqueArgs) => Promise<LeadSourceAttribution | null>;
      create: (args: Prisma.LeadSourceAttributionCreateArgs) => Promise<LeadSourceAttribution>;
      update: (args: Prisma.LeadSourceAttributionUpdateArgs) => Promise<LeadSourceAttribution>;
    };
    businessLine: {
      findMany: (args: Prisma.BusinessLineFindManyArgs) => Promise<{ id: string; name: string; slug: string; status: string }[]>;
    };
  };
  tenantId: string;
  batchId: string;
  createdById: string;
}) {
  const batch = await input.prisma.importBatch.findFirst({
    where: { id: input.batchId, tenantId: input.tenantId }
  });
  if (!batch) {
    throw new Error("导入批次不存在。");
  }
  if (batch.status === ImportBatchStatus.COMPLETED) {
    return batch;
  }

  const mapping = parseImportBatchMapping(batch.mapping);
  const defaults = parseImportDefaultSettings(batch);
  const storedRows = await input.prisma.importRow.findMany({
    where: { batchId: batch.id, tenantId: input.tenantId },
    orderBy: { rowIndex: "asc" }
  });
  const rawRows = storedRows.map((row) => {
    const record = toRecord(row.rawData);
    return Object.fromEntries(
      Object.entries(record ?? {}).map(([key, value]) => [key, typeof value === "string" ? value : String(value ?? "")])
    );
  });
  const references = await loadImportReferenceData(input.prisma, input.tenantId);
  const previewRows = buildPreviewRows(rawRows, mapping.fieldMapping, defaults, references);
  const previewSummary = summarizePreviewRows(previewRows);

  let successRows = 0;
  let failedRows = 0;
  let duplicateRows = previewSummary.duplicateRows;
  let skippedRows = 0;
  let generatedTaskRows = 0;
  const runtimeErrors: { rowIndex: number; errorMessage: string }[] = [];

  for (let index = 0; index < storedRows.length; index += 1) {
    const storedRow = storedRows[index];
    const previewRow = previewRows[index];
    const normalizedData = previewRow.normalizedData ?? parseNormalizedRowData(storedRow.normalizedData);

    if (!normalizedData) {
      failedRows += 1;
      runtimeErrors.push({ rowIndex: previewRow.rowIndex, errorMessage: "标准化数据缺失。" });
      await input.prisma.importRow.update({
        where: { id: storedRow.id },
        data: {
          status: ImportRowStatus.FAILED,
          errorMessage: "标准化数据缺失。",
          normalizedData: Prisma.JsonNull
        }
      });
      continue;
    }

    if (previewRow.status === ImportRowStatus.FAILED) {
      failedRows += 1;
      await input.prisma.importRow.update({
        where: { id: storedRow.id },
        data: {
          status: ImportRowStatus.FAILED,
          errorMessage: previewRow.errorMessage,
          duplicateLeadId: previewRow.duplicateLeadId,
          normalizedData
        }
      });
      continue;
    }

    if (previewRow.status === ImportRowStatus.DUPLICATE) {
      const status = defaults.skipDuplicates ? ImportRowStatus.SKIPPED : ImportRowStatus.DUPLICATE;
      skippedRows += defaults.skipDuplicates ? 1 : 0;
      await input.prisma.importRow.update({
        where: { id: storedRow.id },
        data: {
          status,
          errorMessage: previewRow.errorMessage,
          duplicateLeadId: previewRow.duplicateLeadId,
          normalizedData
        }
      });
      continue;
    }

    try {
      const lead = await input.prisma.lead.create({
        data: {
          tenantId: input.tenantId,
          name: normalizedData.name || normalizedData.company || normalizedData.wechat || normalizedData.phone || `导入客户-${previewRow.rowIndex}`,
          phone: normalizedData.phone,
          wechat: normalizedData.wechat || null,
          company: normalizedData.company || null,
          source: normalizedData.source,
          customerType: normalizedData.customerType,
          needType: "OTHER",
          intentionLevel: normalizedData.intentionLevel,
          stage: normalizedData.stage,
          message: normalizedData.message,
          ownerId: normalizedData.ownerId,
          nextFollowAt: normalizedData.nextFollowAt ? new Date(normalizedData.nextFollowAt) : null
        }
      });

      await ensureLeadTags({
        prisma: input.prisma,
        tenantId: input.tenantId,
        leadId: lead.id,
        normalizedData
      });

      const sourceAttribution = buildSourceAttributionInputFromNormalizedData(normalizedData);
      if (sourceAttribution) {
        await upsertLeadSourceAttribution({
          db: input.prisma,
          tenantId: input.tenantId,
          leadId: lead.id,
          userId: input.createdById,
          attribution: sourceAttribution
        });
      }

      if (defaults.autoCreateFirstTask && normalizedData.ownerId) {
        const dueAt = new Date();
        dueAt.setDate(dueAt.getDate() + (normalizedData.intentionLevel === IntentionLevel.HIGH || normalizedData.intentionLevel === IntentionLevel.STRONG ? 0 : 1));
        dueAt.setHours(18, 0, 0, 0);
        await createTaskWithAudit({
          tenantId: input.tenantId,
          leadId: lead.id,
          ownerId: normalizedData.ownerId,
          createdById: input.createdById,
          title: "首次跟进导入客户",
          description: "客户由批量导入生成，请尽快完成首次沟通并补充客户画像。",
          type: FollowTaskType.FIRST_FOLLOW,
          priority:
            normalizedData.intentionLevel === IntentionLevel.HIGH || normalizedData.intentionLevel === IntentionLevel.STRONG
              ? FollowTaskPriority.HIGH
              : FollowTaskPriority.NORMAL,
          dueAt,
          auditAction: "task_created",
          auditMetadata: { source: "import_batch", batchId: batch.id, rowIndex: previewRow.rowIndex }
        });
        generatedTaskRows += 1;
      }

      successRows += 1;
      await input.prisma.importRow.update({
        where: { id: storedRow.id },
        data: {
          status: ImportRowStatus.IMPORTED,
          leadId: lead.id,
          errorMessage: null,
          duplicateLeadId: null,
          normalizedData
        }
      });
    } catch (error) {
      failedRows += 1;
      const errorMessage = error instanceof Error ? error.message : "导入时发生未知错误。";
      runtimeErrors.push({ rowIndex: previewRow.rowIndex, errorMessage });
      await input.prisma.importRow.update({
        where: { id: storedRow.id },
        data: {
          status: ImportRowStatus.FAILED,
          errorMessage,
          normalizedData
        }
      });
    }
  }

  const batchStatus = runtimeErrors.length && successRows === 0 ? ImportBatchStatus.FAILED : ImportBatchStatus.COMPLETED;

  return input.prisma.importBatch.update({
    where: { id: batch.id },
    data: {
      status: batchStatus,
      totalRows: previewSummary.totalRows,
      successRows,
      failedRows,
      duplicateRows,
      skippedRows,
      generatedTaskRows,
      completedAt: new Date(),
      errorSummary: runtimeErrors.length ? runtimeErrors.slice(0, 20) : previewSummary.errorSummary
    }
  });
}

export function buildImportMappingFromForm(headers: string[], formData: FormData, fallback?: ImportFieldMapping) {
  return parseRequestedMapping(headers, formData, fallback);
}

export function buildImportDefaultsFromForm(formData: FormData, fallback?: Partial<ImportDefaultSettings>) {
  return parseDefaultSettingsFromForm(formData, fallback);
}
