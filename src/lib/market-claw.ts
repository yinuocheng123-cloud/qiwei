/*
 * 文件说明：该文件实现 V2.0 麻虾 Market Claw 的规则引擎与数据解析工具。
 * 功能说明：统一处理知识关键词、命中逻辑、风险提醒、回复草稿生成，以及标签/资料/任务建议。
 *
 * 结构概览：
 *   第一部分：类型、标签与通用解析
 *   第二部分：规则检测与知识命中
 *   第三部分：麻虾回复、标签和任务建议生成
 *   第四部分：页面展示所需的 Json 解析工具
 */
import type {
  BusinessLine,
  CustomerType,
  LeadStage,
  MarketClawKnowledgeItem,
  MarketClawKnowledgeStatus,
  MarketClawKnowledgeType,
  Material,
  TagGroup
} from "@prisma/client";
import { parseBusinessLineIdList } from "@/lib/business-lines";

type LeadLike = {
  name: string;
  customerType: CustomerType;
  stage: LeadStage;
};

type BusinessLineLike = Pick<
  BusinessLine,
  "id" | "name" | "description" | "recommendedMaterialIds" | "recommendedTagNames" | "defaultNextAction"
>;

type MaterialLike = Pick<Material, "id" | "title" | "description">;

type KnowledgeLike = Pick<
  MarketClawKnowledgeItem,
  | "id"
  | "businessLineId"
  | "title"
  | "content"
  | "knowledgeType"
  | "status"
  | "keywords"
  | "recommendedMaterialIds"
  | "forbiddenPhrases"
  | "riskNotes"
  | "sortOrder"
>;

export type MarketClawSuggestedTag = {
  tagName: string;
  tagGroup: TagGroup;
  reason: string;
};

export type MarketClawSuggestedTask = {
  title: string;
  description: string;
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  dueDays: number;
};

export type MarketClawReplyResult = {
  shortReply: string;
  professionalReply: string;
  closingReply: string;
  riskWarnings: string[];
  matchedKnowledgeIds: string[];
  suggestedTags: MarketClawSuggestedTag[];
  suggestedMaterialIds: string[];
  suggestedTask: MarketClawSuggestedTask | null;
};

type MarketClawSignal = {
  price: boolean;
  effectPromise: boolean;
  caseStudy: boolean;
  geo: boolean;
  membership: boolean;
  wuzhen: boolean;
  cnas: boolean;
  highIntent: boolean;
  lowIntent: boolean;
};

export const marketClawKnowledgeTypeOptions: { value: MarketClawKnowledgeType; label: string }[] = [
  { value: "SERVICE_INTRO", label: "服务介绍" },
  { value: "FAQ", label: "常见问题" },
  { value: "STANDARD_REPLY", label: "标准回复" },
  { value: "CASE_STUDY", label: "客户案例" },
  { value: "PRICE_BOUNDARY", label: "价格边界" },
  { value: "DELIVERY_PROCESS", label: "交付流程" },
  { value: "OBJECTION_HANDLING", label: "异议处理" },
  { value: "FORBIDDEN_COMMITMENT", label: "不能承诺事项" },
  { value: "RISK_NOTICE", label: "风险提醒" },
  { value: "SALES_SCRIPT", label: "销售话术" },
  { value: "OTHER", label: "其他" }
];

export const marketClawKnowledgeStatusOptions: { value: MarketClawKnowledgeStatus; label: string }[] = [
  { value: "ACTIVE", label: "启用中" },
  { value: "PAUSED", label: "已暂停" },
  { value: "ARCHIVED", label: "已归档" }
];

export const marketClawReplyTypeOptions = [
  { value: "ALL", label: "全部生成" },
  { value: "SHORT", label: "简短微信版" },
  { value: "PROFESSIONAL", label: "专业说明版" },
  { value: "CLOSING", label: "推进成交版" }
] as const;

export const marketClawFeedbackOptions = [
  { value: "USEFUL", label: "好用" },
  { value: "NEEDS_EDIT", label: "需要修改" },
  { value: "NOT_USEFUL", label: "不好用" }
] as const;

export const marketClawTagGroupLabels: Record<TagGroup, string> = {
  SOURCE: "来源标签",
  CUSTOMER_TYPE: "客户类型标签",
  NEED: "需求标签",
  INTENTION: "意向标签",
  STAGE: "阶段标签",
  BUSINESS_LINE: "业务标签",
  IMPORTED: "导入标签",
  CUSTOM: "自定义标签"
};

const priceKeywords = ["价格", "费用", "多少钱", "报价", "贵不贵", "怎么收费"];
const effectKeywords = ["保证", "一定", "肯定", "效果", "排名", "推荐", "通过"];
const caseKeywords = ["案例", "有没有做过", "样板", "落地", "客户"];
const geoKeywords = ["geo", "ai", "ai搜索", "推荐", "收录", "关键词", "seo"];
const membershipKeywords = ["会员", "整木网", "增信", "背书", "联盟", "加入", "行业露出"];
const wuzhenKeywords = ["乌镇", "活动", "峰会", "榜单", "白皮书", "奖项", "露出"];
const cnasKeywords = ["cnas", "认可", "实验室", "评审", "体系文件", "整改", "人员设备", "认可范围"];
const highIntentKeywords = ["什么时候开始", "能不能尽快", "今天聊", "明天聊", "发合同", "怎么付款", "报价发我", "约时间"];
const lowIntentKeywords = ["先了解", "不着急", "以后再说", "暂时不用", "没有预算"];
const riskKeywords = ["价格", "周期", "保证", "通过", "奖项", "名额", "独家", "合同", "赔付", "投放效果", "资源承诺"];

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

function includesKeyword(question: string, keywords: string[]) {
  return keywords.some((keyword) => question.includes(keyword.toLowerCase()));
}

function splitTextList(value?: string | null) {
  return value
    ? value
        .split(/\r?\n|,|，|、/)
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
}

function toStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

export function parseMarketClawTextArray(value: unknown) {
  return toStringArray(value);
}

export function parseMarketClawSuggestedTags(value: unknown) {
  if (!Array.isArray(value)) return [] as MarketClawSuggestedTag[];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const tagName = typeof item.tagName === "string" ? item.tagName : "";
    const tagGroup = typeof item.tagGroup === "string" ? item.tagGroup : "";
    const reason = typeof item.reason === "string" ? item.reason : "";
    if (!tagName || !reason) return [];
    if (!Object.keys(marketClawTagGroupLabels).includes(tagGroup)) return [];
    return [{ tagName, tagGroup: tagGroup as TagGroup, reason }];
  });
}

export function parseMarketClawSuggestedTask(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const title = typeof record.title === "string" ? record.title : "";
  const description = typeof record.description === "string" ? record.description : "";
  const priority = typeof record.priority === "string" ? record.priority : "";
  const dueDays = typeof record.dueDays === "number" ? record.dueDays : Number(record.dueDays ?? NaN);
  if (!title || !description || !["LOW", "NORMAL", "HIGH", "URGENT"].includes(priority) || !Number.isFinite(dueDays)) {
    return null;
  }
  return { title, description, priority: priority as MarketClawSuggestedTask["priority"], dueDays };
}

function buildSignals(question: string): MarketClawSignal {
  const normalized = normalizeText(question);
  return {
    price: includesKeyword(normalized, priceKeywords),
    effectPromise: includesKeyword(normalized, effectKeywords),
    caseStudy: includesKeyword(normalized, caseKeywords),
    geo: includesKeyword(normalized, geoKeywords),
    membership: includesKeyword(normalized, membershipKeywords),
    wuzhen: includesKeyword(normalized, wuzhenKeywords),
    cnas: includesKeyword(normalized, cnasKeywords),
    highIntent: includesKeyword(normalized, highIntentKeywords),
    lowIntent: includesKeyword(normalized, lowIntentKeywords)
  };
}

function parseKnowledgeKeywords(item: KnowledgeLike) {
  const storedKeywords = toStringArray(item.keywords);
  if (storedKeywords.length) return storedKeywords;
  return splitTextList(item.title).concat(splitTextList(item.content)).slice(0, 12);
}

function knowledgeTypeWeight(type: KnowledgeLike["knowledgeType"]) {
  switch (type) {
    case "FORBIDDEN_COMMITMENT":
      return 6;
    case "PRICE_BOUNDARY":
      return 5;
    case "FAQ":
      return 4;
    case "CASE_STUDY":
      return 3;
    case "SERVICE_INTRO":
      return 2;
    default:
      return 1;
  }
}

function detectKnowledgeTypeBoost(type: KnowledgeLike["knowledgeType"], signals: MarketClawSignal) {
  if (signals.price && type === "PRICE_BOUNDARY") return 8;
  if (signals.effectPromise && (type === "FORBIDDEN_COMMITMENT" || type === "RISK_NOTICE")) return 8;
  if (signals.caseStudy && type === "CASE_STUDY") return 6;
  if ((signals.geo || signals.membership || signals.wuzhen || signals.cnas) && type === "FAQ") return 4;
  return 0;
}

export function pickMarketClawKnowledge(input: {
  question: string;
  businessLineId?: string | null;
  knowledgeItems: KnowledgeLike[];
}) {
  const normalized = normalizeText(input.question);
  const signals = buildSignals(input.question);
  return input.knowledgeItems
    .filter((item) => item.status === "ACTIVE")
    .filter((item) => !input.businessLineId || item.businessLineId === input.businessLineId)
    .map((item) => {
      const matchedKeywordCount = parseKnowledgeKeywords(item).filter((keyword) => normalized.includes(normalizeText(keyword))).length;
      const score =
        matchedKeywordCount * 5 + knowledgeTypeWeight(item.knowledgeType) + detectKnowledgeTypeBoost(item.knowledgeType, signals) - item.sortOrder / 100;
      return { item, score, matchedKeywordCount };
    })
    .filter((entry) => entry.matchedKeywordCount > 0 || entry.score >= 5)
    .sort((left, right) => right.score - left.score)
    .slice(0, 6)
    .map((entry) => entry.item);
}

function appendUniqueTag(tags: MarketClawSuggestedTag[], next: MarketClawSuggestedTag) {
  if (tags.some((tag) => tag.tagName === next.tagName && tag.tagGroup === next.tagGroup)) return;
  tags.push(next);
}

function buildSuggestedTags(signals: MarketClawSignal) {
  const tags: MarketClawSuggestedTag[] = [];

  if (signals.geo) {
    appendUniqueTag(tags, { tagName: "GEO意向", tagGroup: "CUSTOM", reason: "客户问题涉及 GEO、AI 搜索或品牌可见性。" });
    appendUniqueTag(tags, { tagName: "AI推广关注", tagGroup: "NEED", reason: "客户正在关注 AI 搜索与推荐入口。" });
    appendUniqueTag(tags, { tagName: "待诊断", tagGroup: "STAGE", reason: "建议先做一轮 AI 可见性诊断。" });
  }

  if (signals.membership) {
    appendUniqueTag(tags, { tagName: "会员意向", tagGroup: "CUSTOM", reason: "客户正在了解会员、增信或行业背书。" });
    appendUniqueTag(tags, { tagName: "品牌增信关注", tagGroup: "NEED", reason: "客户对品牌背书和增信价值有明显兴趣。" });
  }

  if (signals.wuzhen) {
    appendUniqueTag(tags, { tagName: "乌镇资源关注", tagGroup: "NEED", reason: "客户问题涉及乌镇、活动资源或行业露出。" });
    appendUniqueTag(tags, { tagName: "活动资源意向", tagGroup: "CUSTOM", reason: "适合继续判断活动资源合作边界。" });
  }

  if (signals.cnas) {
    appendUniqueTag(tags, { tagName: "CNAS认可指南", tagGroup: "CUSTOM", reason: "客户问题涉及 CNAS 认可路径或评审准备。" });
    appendUniqueTag(tags, { tagName: "CNAS线索", tagGroup: "CUSTOM", reason: "建议进入 CNAS 路径梳理或问卷判断。" });
  }

  if (signals.highIntent) {
    appendUniqueTag(tags, { tagName: "高意向", tagGroup: "INTENTION", reason: "客户已经出现约时间、发合同或尽快推进信号。" });
  }

  if (signals.lowIntent) {
    appendUniqueTag(tags, { tagName: "待培育", tagGroup: "STAGE", reason: "客户表达先了解或暂时不急，适合内容培育。" });
    appendUniqueTag(tags, { tagName: "低意向", tagGroup: "INTENTION", reason: "当前更适合低打扰跟进节奏。" });
  }

  return tags;
}

function buildSuggestedTask(signals: MarketClawSignal, businessLine?: BusinessLineLike | null): MarketClawSuggestedTask | null {
  if (signals.highIntent) {
    return {
      title: `高意向跟进：${businessLine?.name ?? "当前客户"}`,
      description: "客户已经出现强推进信号，建议今天或明天完成一轮高优先级沟通。",
      priority: "HIGH",
      dueDays: 1
    } satisfies MarketClawSuggestedTask;
  }

  if (signals.geo || signals.cnas) {
    return {
      title: `安排诊断沟通：${businessLine?.name ?? "当前客户"}`,
      description: signals.cnas ? "建议约 30 分钟 CNAS 路径梳理。" : "建议约一次 AI 可见性诊断，先看品牌当前搜索可见性。",
      priority: "HIGH",
      dueDays: 1
    } satisfies MarketClawSuggestedTask;
  }

  if (signals.lowIntent) {
    return {
      title: `内容培育跟进：${businessLine?.name ?? "当前客户"}`,
      description: "客户当前更适合低打扰跟进，建议 7 天后继续发内容培育。",
      priority: "LOW",
      dueDays: 7
    } satisfies MarketClawSuggestedTask;
  }

  return businessLine?.defaultNextAction
    ? {
        title: `下一步跟进：${businessLine.name}`,
        description: businessLine.defaultNextAction,
        priority: "NORMAL",
        dueDays: 2
      }
    : null;
}

function buildRiskWarnings(question: string, knowledgeItems: KnowledgeLike[]) {
  const normalized = normalizeText(question);
  const warnings = new Set<string>();

  if (includesKeyword(normalized, riskKeywords)) {
    warnings.add("该回复涉及价格、周期或效果承诺，请人工确认后再使用。不要承诺绝对结果。");
  }

  if (includesKeyword(normalized, effectKeywords)) {
    warnings.add("当前问题涉及结果或保证表述，不能承诺绝对效果、绝对通过或必然推荐。");
  }

  for (const item of knowledgeItems) {
    if (item.riskNotes?.trim()) {
      warnings.add(item.riskNotes.trim());
    }
    for (const forbiddenPhrase of toStringArray(item.forbiddenPhrases)) {
      warnings.add(`避免使用“${forbiddenPhrase}”这类绝对承诺表达。`);
    }
  }

  return [...warnings];
}

function summarizeKnowledge(item: KnowledgeLike) {
  return item.content.length <= 72 ? item.content : `${item.content.slice(0, 72)}...`;
}

function pickSuggestedMaterials(businessLine: BusinessLineLike | null | undefined, knowledgeItems: KnowledgeLike[]) {
  const orderedIds: string[] = [];

  for (const item of businessLine ? parseBusinessLineIdList(businessLine.recommendedMaterialIds) : []) {
    if (!orderedIds.includes(item)) orderedIds.push(item);
  }

  for (const knowledge of knowledgeItems) {
    for (const item of toStringArray(knowledge.recommendedMaterialIds)) {
      if (!orderedIds.includes(item)) orderedIds.push(item);
    }
  }

  return orderedIds;
}

function buildBaseSummary(lead: LeadLike, question: string, knowledgeItems: KnowledgeLike[], signals: MarketClawSignal) {
  const knowledgeSummary = knowledgeItems.length
    ? `这次优先参考了：${knowledgeItems.slice(0, 3).map((item) => item.title).join("、")}。`
    : "这次没有命中特定知识条目，我会按当前业务规则给出保守建议。";

  if (signals.price) {
    return `${knowledgeSummary} 价格类问题不能空口报价，需要先判断客户情况、业务线和服务范围。`;
  }
  if (signals.effectPromise) {
    return `${knowledgeSummary} 效果类问题不能承诺绝对结果，尤其不能承诺 AI 推荐、保证通过或保证奖项。`;
  }
  if (signals.caseStudy) {
    return `${knowledgeSummary} 案例类问题建议先给相近案例，再收口客户场景和下一步。`;
  }
  return `${knowledgeSummary} 当前客户阶段为${lead.stage}，建议围绕真实需求、边界和下一步动作继续沟通。`;
}

function buildShortReply(lead: LeadLike, question: string, knowledgeItems: KnowledgeLike[], signals: MarketClawSignal, businessLine?: BusinessLineLike | null) {
  if (signals.geo) {
    return "这个问题可以先不用急着承诺结果，我们通常会先看品牌现在在 AI 搜索里的可见性，再判断是先补关键词和内容底座，还是直接进入 GEO 方案。";
  }
  if (signals.cnas) {
    return "CNAS 这类问题不建议一上来先做材料，先判断你现在处在了解、建设、体系文件还是准备申请阶段，会更省时间。";
  }
  if (signals.membership) {
    return "整木网会员不是单纯买展示位，更核心的是增信、链接和增长协同，先看你现在更需要哪一块。";
  }
  if (signals.wuzhen) {
    return "乌镇和活动资源这类合作更适合先判断你是要露出、背书还是资源链接，不建议先把结果说满。";
  }
  if (signals.price) {
    return "价格这类问题我建议先不空口报死价，先结合你的业务线、服务范围和当前情况判断，给到你的信息会更准。";
  }
  return `${buildBaseSummary(lead, question, knowledgeItems, signals)}${businessLine?.defaultNextAction ? ` 建议下一步先${businessLine.defaultNextAction}。` : ""}`;
}

function buildProfessionalReply(
  lead: LeadLike,
  knowledgeItems: KnowledgeLike[],
  signals: MarketClawSignal,
  businessLine?: BusinessLineLike | null
) {
  const references = knowledgeItems.slice(0, 2).map((item) => summarizeKnowledge(item)).join(" ");

  if (signals.effectPromise) {
    return `这类问题我们会先把边界讲清楚：不能承诺绝对效果，也不能承诺保证 AI 推荐、保证通过或保证资源结果。${references || "建议先结合现状做判断。"}${businessLine?.description ? ` 当前更适合先按“${businessLine.name}”这条业务线判断是否匹配。` : ""}`;
  }

  if (signals.caseStudy) {
    return `这类问题更适合先发相近案例，再确认客户目前的场景、预算和目标。${references || "如果你愿意，我可以先按相近场景给你一版参考说法。"}${businessLine?.description ? ` 这条线当前主要承接的是：${businessLine.description}` : ""}`;
  }

  return `${buildBaseSummary(lead, "", knowledgeItems, signals)} ${references}`.trim();
}

function buildClosingReply(signals: MarketClawSignal, suggestedTask: MarketClawSuggestedTask | null) {
  if (signals.geo) {
    return "如果你愿意，我们下一步可以直接约一次 AI 可见性诊断，把品牌关键词、现有内容和搜索入口先看清楚，我再给你更具体的建议。";
  }
  if (signals.cnas) {
    return "如果方便，我建议你先填写一次 CNAS 认可路径判断问卷，或者直接约 30 分钟路径梳理，这样我们能更快判断要不要正式启动。";
  }
  if (signals.highIntent) {
    return "你这边如果准备推进，我们可以直接把下一步时间定下来，我按你的实际情况把资料和沟通顺序一起给你收好。";
  }
  if (signals.lowIntent) {
    return "你可以先把这轮资料看一下，我这边不急着追着推，过几天再按你关心的点继续补一轮更有用。";
  }
  return suggestedTask ? `如果方便，我们下一步先按“${suggestedTask.title}”来推进，这样会比继续泛聊更高效。` : "如果方便，我建议我们先把最关键的一个问题收口，再决定下一步怎么推进。";
}

export function generateMarketClawReply(input: {
  lead: LeadLike;
  question: string;
  businessLine?: BusinessLineLike | null;
  knowledgeItems: KnowledgeLike[];
}) {
  const signals = buildSignals(input.question);
  const matchedKnowledge = pickMarketClawKnowledge({
    question: input.question,
    businessLineId: input.businessLine?.id,
    knowledgeItems: input.knowledgeItems
  });
  const suggestedTask = buildSuggestedTask(signals, input.businessLine);

  return {
    shortReply: buildShortReply(input.lead, input.question, matchedKnowledge, signals, input.businessLine),
    professionalReply: buildProfessionalReply(input.lead, matchedKnowledge, signals, input.businessLine),
    closingReply: buildClosingReply(signals, suggestedTask),
    riskWarnings: buildRiskWarnings(input.question, matchedKnowledge),
    matchedKnowledgeIds: matchedKnowledge.map((item) => item.id),
    suggestedTags: buildSuggestedTags(signals),
    suggestedMaterialIds: pickSuggestedMaterials(input.businessLine, matchedKnowledge),
    suggestedTask
  } satisfies MarketClawReplyResult;
}

export function materialTitlesFromIds(materials: MaterialLike[], ids: string[]) {
  const byId = new Map(materials.map((material) => [material.id, material.title]));
  return ids.map((id) => byId.get(id)).filter((title): title is string => Boolean(title));
}
