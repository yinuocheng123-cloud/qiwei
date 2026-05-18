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
  MarketClawIngestionSourceType,
  MarketClawIngestionStatus,
  MarketClawKnowledgeCandidateReviewStatus,
  MarketClawKnowledgeItem,
  MarketClawKnowledgeReviewStatus,
  MarketClawKnowledgeScopeLevel,
  MarketClawKnowledgeStatus,
  MarketClawKnowledgeType,
  MarketClawKnowledgeVisibility,
  MarketClawReplyRiskLevel,
  MarketClawReplySourceScope,
  MarketClawReviewResult,
  MarketClawSendMode,
  MarketClawTrainingReviewStatus,
  MarketClawTrainingScope,
  Material,
  TagGroup,
  UserRole
} from "@prisma/client";
import { parseBusinessLineIdList } from "@/lib/business-lines";
import { prisma } from "@/lib/prisma";

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
  | "createdById"
  | "departmentName"
  | "title"
  | "content"
  | "knowledgeType"
  | "scopeLevel"
  | "visibility"
  | "reviewStatus"
  | "status"
  | "keywords"
  | "recommendedMaterialIds"
  | "forbiddenPhrases"
  | "riskNotes"
  | "replyRiskLevel"
  | "sendMode"
  | "riskReason"
  | "requiresReview"
  | "internalOnlyNote"
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
  replyRiskLevel: MarketClawReplyRiskLevel;
  sendMode: MarketClawSendMode;
  riskReason: string | null;
  requiresReview: boolean;
  internalOnlyNote: string | null;
  highRiskKnowledgeIds: string[];
  internalAdviceKnowledgeIds: string[];
  riskKeywordHits: string[];
  matchedKnowledgeIds: string[];
  suggestedTags: MarketClawSuggestedTag[];
  suggestedMaterialIds: string[];
  suggestedTask: MarketClawSuggestedTask | null;
};

export type MarketClawReplyPolicy = {
  replyRiskLevel: MarketClawReplyRiskLevel;
  sendMode: MarketClawSendMode;
  riskReason: string | null;
  requiresReview: boolean;
  internalOnlyNote: string | null;
  highRiskKnowledgeIds: string[];
  internalAdviceKnowledgeIds: string[];
  riskKeywordHits: string[];
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

export type MarketClawKnowledgeCandidateDraft = {
  title: string;
  content: string;
  knowledgeType: MarketClawKnowledgeType;
  suggestedScopeLevel: MarketClawKnowledgeScopeLevel;
  suggestedKeywords: string[];
  suggestedForbiddenPhrases: string[];
  suggestedRiskNotes: string | null;
  suggestedReplyRiskLevel: MarketClawReplyRiskLevel;
  suggestedSendMode: MarketClawSendMode;
  suggestedRiskReason: string | null;
  requiresReview: boolean;
  internalOnlyNote: string | null;
  suggestedReplyShort: string;
  suggestedReplyProfessional: string;
  suggestedReplyClosing: string;
};

export type MarketClawKnowledgeCandidateMergeAction =
  | "ADOPT_AS_NEW"
  | "MERGE_INTO_EXISTING"
  | "APPEND_TO_EXISTING"
  | "REJECT_AS_DUPLICATE";

export type MarketClawKnowledgeSimilarityLevel = "HIGH" | "MEDIUM" | "LOW";

export type MarketClawKnowledgeSimilarityHint = {
  knowledgeItemId: string;
  title: string;
  knowledgeType: MarketClawKnowledgeType;
  similarityLevel: MarketClawKnowledgeSimilarityLevel;
  reasons: string[];
  matchedKeywords: string[];
  contentPreview: string;
  businessLineId: string | null;
};

export type MarketClawInsightsRoleView = "GLOBAL" | "PERSONAL";

export type MarketClawInsightsSummaryMetrics = {
  trainingTotal: number;
  myTrainingCount: number;
  pendingTrainingCount: number;
  adoptedTrainingCount: number;
  rejectedTrainingCount: number;
  personalScriptCount: number;
  ingestionBatchCount: number;
  candidateCount: number;
  adoptedCandidateCount: number;
  mergedCandidateCount: number;
  rejectedCandidateCount: number;
  enterpriseKnowledgeCount: number;
  teamKnowledgeCount: number;
  businessLineKnowledgeCount: number;
  personalKnowledgeCount: number;
};

export type MarketClawFrequentQuestionStat = {
  topic: string;
  count: number;
  businessLines: string[];
  lastSeenAt: Date;
  hasStandardKnowledge: boolean;
  suggestedAction: string;
};

export type MarketClawRiskQuestionStat = {
  riskType: string;
  count: number;
  businessLines: string[];
  hasRiskNotice: boolean;
  hasForbiddenCommitment: boolean;
  suggestedAction: string;
};

export type MarketClawKnowledgeGap = {
  businessLine: string;
  gapType: string;
  currentSnapshot: string;
  suggestedContent: string;
  nextAction: string;
};

export type MarketClawCandidateActivity = {
  title: string;
  businessLine: string;
  knowledgeType: string;
  occurredAt: Date;
  operatorName: string;
  reviewStatus: string;
};

export type MarketClawTrainingContributionStat = {
  userName: string;
  adoptedCount: number;
  latestAt: Date;
};

export type MarketClawMergeInsight = {
  title: string;
  businessLine: string;
  sourceCandidateCount: number;
  sourceBatchCount: number;
  lastMergedAt: Date | null;
};

export type MarketClawKnowledgeTypeCount = {
  knowledgeType: string;
  count: number;
};

export type MarketClawMaturityStage = {
  stage: "初始阶段" | "启动阶段" | "成长期" | "标准化阶段" | "成熟运营阶段";
  rationale: string[];
  nextActions: string[];
};

export type MarketClawTrainingReviewProgress = {
  question: string;
  reviewStatus: string;
  updatedAt: Date;
  reviewComment: string | null;
  promotedScope: string | null;
};

export type MarketClawTrainingInsights = {
  roleView: MarketClawInsightsRoleView;
  summaryMetrics: MarketClawInsightsSummaryMetrics;
  frequentQuestions: MarketClawFrequentQuestionStat[];
  riskQuestionStats: MarketClawRiskQuestionStat[];
  knowledgeGaps: MarketClawKnowledgeGap[];
  adoptionStats: {
    recentAdoptions: MarketClawCandidateActivity[];
    topContributors: MarketClawTrainingContributionStat[];
  };
  mergeStats: {
    recentMerges: MarketClawCandidateActivity[];
    mostMergedKnowledgeItems: MarketClawMergeInsight[];
    duplicateRejectedTypes: MarketClawKnowledgeTypeCount[];
  };
  maturityStage: MarketClawMaturityStage | null;
  personalReviewProgress: MarketClawTrainingReviewProgress[];
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

export const marketClawKnowledgeScopeOptions: { value: MarketClawKnowledgeScopeLevel; label: string }[] = [
  { value: "ENTERPRISE", label: "企业标准" },
  { value: "DEPARTMENT", label: "部门知识" },
  { value: "BUSINESS_LINE", label: "业务线知识" },
  { value: "PERSONAL", label: "个人话术" },
  { value: "PLATFORM_TEMPLATE", label: "平台模板预留" }
];

export const marketClawKnowledgeVisibilityOptions: { value: MarketClawKnowledgeVisibility; label: string }[] = [
  { value: "PRIVATE", label: "仅自己可见" },
  { value: "DEPARTMENT", label: "部门可见" },
  { value: "TENANT", label: "租户内可见" }
];

export const marketClawKnowledgeReviewStatusOptions: { value: MarketClawKnowledgeReviewStatus; label: string }[] = [
  { value: "DRAFT", label: "草稿" },
  { value: "PENDING_REVIEW", label: "待审核" },
  { value: "APPROVED", label: "已通过" },
  { value: "REJECTED", label: "已驳回" },
  { value: "PAUSED", label: "已停用" },
  { value: "ARCHIVED", label: "已归档" }
];

export const marketClawReplyTypeOptions = [
  { value: "ALL", label: "全部生成" },
  { value: "SHORT", label: "简短微信版" },
  { value: "PROFESSIONAL", label: "专业说明版" },
  { value: "CLOSING", label: "推进成交版" }
] as const;

export const marketClawTrainingScopeOptions: { value: MarketClawTrainingScope; label: string }[] = [
  { value: "ENTERPRISE_TRAINING", label: "企业训练" },
  { value: "DEPARTMENT_TRAINING", label: "部门训练" },
  { value: "BUSINESS_LINE_TRAINING", label: "业务线训练" },
  { value: "SALES_SELF_TRAINING", label: "我的训练" }
];

export const marketClawTrainingReviewStatusOptions: { value: MarketClawTrainingReviewStatus; label: string }[] = [
  { value: "DRAFT", label: "个人草稿" },
  { value: "GENERATED", label: "已生成" },
  { value: "PERSONAL_SAVED", label: "个人常用" },
  { value: "PENDING_REVIEW", label: "待审核" },
  { value: "TEAM_APPROVED", label: "团队可用" },
  { value: "ENTERPRISE_APPROVED", label: "企业标准" },
  { value: "REJECTED", label: "已驳回" },
  { value: "DISMISSED", label: "已停用" }
];

export const marketClawReplySourceScopeOptions: { value: MarketClawReplySourceScope; label: string }[] = [
  { value: "CUSTOMER_REPLY", label: "客户详情页" },
  { value: "TRAINING", label: "训练场" },
  { value: "PERSONAL_LIBRARY", label: "个人话术库" }
];

export const marketClawFeedbackOptions = [
  { value: "USEFUL", label: "好用" },
  { value: "NEEDS_EDIT", label: "需要修改" },
  { value: "NOT_USEFUL", label: "不好用" }
] as const;

export const marketClawReviewResultOptions: { value: MarketClawReviewResult; label: string }[] = [
  { value: "NONE", label: "未审核" },
  { value: "ADOPT_AS_PERSONAL", label: "采纳为个人常用" },
  { value: "ADOPT_AS_TEAM", label: "采纳为团队标准" },
  { value: "ADOPT_AS_ENTERPRISE", label: "采纳为企业标准" },
  { value: "REJECTED", label: "已驳回" }
];

export const marketClawIngestionSourceTypeOptions: { value: MarketClawIngestionSourceType; label: string }[] = [
  { value: "PASTED_TEXT", label: "粘贴文本" },
  { value: "TXT", label: "TXT 文本" },
  { value: "MARKDOWN", label: "Markdown" },
  { value: "CSV", label: "CSV" },
  { value: "MANUAL", label: "人工整理" }
];

export const marketClawIngestionStatusOptions: { value: MarketClawIngestionStatus; label: string }[] = [
  { value: "DRAFT", label: "草稿" },
  { value: "PROCESSING", label: "处理中" },
  { value: "CANDIDATES_GENERATED", label: "已生成候选知识" },
  { value: "REVIEWING", label: "审核中" },
  { value: "COMPLETED", label: "已完成" },
  { value: "FAILED", label: "处理失败" }
];

export const marketClawKnowledgeCandidateReviewStatusOptions: {
  value: MarketClawKnowledgeCandidateReviewStatus;
  label: string;
}[] = [
  { value: "PENDING_REVIEW", label: "待审核" },
  { value: "ADOPTED", label: "已采纳" },
  { value: "ADOPTED_WITH_EDIT", label: "修改后采纳" },
  { value: "REJECTED", label: "已驳回" },
  { value: "MERGED", label: "已合并" }
];

export const marketClawKnowledgeCandidateMergeActionOptions: {
  value: MarketClawKnowledgeCandidateMergeAction;
  label: string;
}[] = [
  { value: "ADOPT_AS_NEW", label: "采纳为新知识" },
  { value: "MERGE_INTO_EXISTING", label: "合并到已有知识" },
  { value: "APPEND_TO_EXISTING", label: "作为补充追加" },
  { value: "REJECT_AS_DUPLICATE", label: "标记重复并驳回" }
];

export const marketClawReplyRiskLevelOptions: { value: MarketClawReplyRiskLevel; label: string }[] = [
  { value: "LOW", label: "低风险承接" },
  { value: "MEDIUM", label: "销售确认" },
  { value: "HIGH", label: "风险边界确认" },
  { value: "BLOCKED", label: "仅内部建议" }
];

export const marketClawSendModeOptions: { value: MarketClawSendMode; label: string }[] = [
  { value: "AUTO_ALLOWED", label: "可低风险承接" },
  { value: "SALES_CONFIRM_REQUIRED", label: "需销售确认" },
  { value: "RISK_CONFIRM_REQUIRED", label: "风险边界确认后使用" },
  { value: "INTERNAL_ADVICE_ONLY", label: "仅内部建议" }
];

export const marketClawReplyRiskLevelLabels: Record<MarketClawReplyRiskLevel, string> = {
  LOW: "低风险承接",
  MEDIUM: "销售确认",
  HIGH: "风险边界确认",
  BLOCKED: "仅内部建议"
};

export const marketClawSendModeLabels: Record<MarketClawSendMode, string> = {
  AUTO_ALLOWED: "可低风险承接",
  SALES_CONFIRM_REQUIRED: "需销售确认",
  RISK_CONFIRM_REQUIRED: "风险边界确认后使用",
  INTERNAL_ADVICE_ONLY: "仅内部建议"
};

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
const processKeywords = ["流程", "步骤", "周期", "准备", "交付", "启动", "推进"];
const objectionKeywords = ["太贵", "没预算", "先了解", "再看看", "别人也能做", "没效果"];
const forbiddenCommitmentKeywords = ["保证", "一定", "肯定", "包过", "包推荐", "名额", "排名", "奖项", "效果"];
const autoAllowedKeywords = ["收到", "已收到", "我先看看", "补充资料", "发你资料", "稍后跟进", "安排时间", "先了解"];
const contractKeywords = ["合同", "责任", "赔付", "违约", "法务", "争议", "条款"];
const blockedKeywords = ["保证", "一定", "肯定", "包过", "包推荐", "必上", "绝对", "稳赚", "100%"];
const riskLevelPriority: MarketClawReplyRiskLevel[] = ["LOW", "MEDIUM", "HIGH", "BLOCKED"];
const marketClawKnowledgeTypeLabelMap = new Map(marketClawKnowledgeTypeOptions.map((item) => [item.value, item.label]));

const marketClawInsightQuestionThemes = [
  {
    label: "怎么收费",
    keywords: ["怎么收费", "收费", "价格", "报价", "多少钱", "预算", "费用"],
    suggestedAction: "建议补充价格边界、报价前置条件和标准回复。"
  },
  {
    label: "能不能保证效果",
    keywords: ["保证", "效果", "排名", "推荐", "通过", "结果"],
    suggestedAction: "建议补充效果边界、风险提醒和不能承诺事项。"
  },
  {
    label: "有没有案例",
    keywords: ["案例", "客户", "样板", "落地", "合作"],
    suggestedAction: "建议补充更贴近业务线的案例资料和标准说法。"
  },
  {
    label: "多久见效",
    keywords: ["多久", "周期", "见效", "什么时候", "多长时间"],
    suggestedAction: "建议补充周期边界、交付节奏和推进预期。"
  },
  {
    label: "和别人有什么区别",
    keywords: ["区别", "优势", "差异", "为什么选", "对比", "竞品"],
    suggestedAction: "建议补充标准回复、案例对比和价值表达。"
  },
  {
    label: "我只是先了解",
    keywords: ["先了解", "再看看", "以后再说", "先看看", "暂时不用"],
    suggestedAction: "建议补充低打扰培育话术和下一步动作建议。"
  },
  {
    label: "预算不够",
    keywords: ["预算不够", "太贵", "没预算", "价格高"],
    suggestedAction: "建议补充异议处理、价格边界和价值解释。"
  },
  {
    label: "能不能先发资料",
    keywords: ["发资料", "先发", "资料", "介绍", "方案"],
    suggestedAction: "建议补充资料投喂、服务说明和发送前说明口径。"
  }
] as const;

const marketClawInsightRiskThemes = [
  {
    label: "价格边界",
    keywords: ["价格", "费用", "报价", "多少钱", "预算", "收费"],
    suggestedAction: "建议补充价格边界和报价前置条件。"
  },
  {
    label: "效果边界",
    keywords: ["效果", "保证", "一定", "排名", "推荐", "通过"],
    suggestedAction: "建议补充效果边界和不能承诺事项。"
  },
  {
    label: "周期边界",
    keywords: ["周期", "多久", "时间", "多长时间", "见效"],
    suggestedAction: "建议补充周期边界和交付节奏说明。"
  },
  {
    label: "名额边界",
    keywords: ["名额", "奖项", "榜单", "资源位", "独家"],
    suggestedAction: "建议补充资源边界和审核说明。"
  },
  {
    label: "服务边界",
    keywords: ["服务", "包含", "负责", "售后", "范围"],
    suggestedAction: "建议补充服务范围、售后责任和交付边界。"
  },
  {
    label: "交付边界",
    keywords: ["交付", "流程", "步骤", "准备", "启动"],
    suggestedAction: "建议补充交付流程与项目节奏说明。"
  },
  {
    label: "案例真实性",
    keywords: ["案例", "客户", "真实", "样板", "落地"],
    suggestedAction: "建议补充案例使用边界和真实性说明。"
  },
  {
    label: "竞品比较",
    keywords: ["别人也能做", "竞品", "对比", "区别", "优势"],
    suggestedAction: "建议补充竞品比较话术和价值解释。"
  },
  {
    label: "合同前承诺",
    keywords: ["合同", "承诺", "赔付", "保证", "包过"],
    suggestedAction: "建议补充合同前承诺边界和风险提醒。"
  },
  {
    label: "售后责任",
    keywords: ["售后", "负责", "维护", "持续", "后续"],
    suggestedAction: "建议补充售后责任和服务边界说明。"
  }
] as const;

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

function dedupeStrings(values: string[]) {
  return [...new Set(values.map((item) => item.trim()).filter(Boolean))];
}

export function parseMarketClawTextArray(value: unknown) {
  return toStringArray(value);
}

export function parseMarketClawSimilarityHints(value: unknown) {
  if (!Array.isArray(value)) return [] as MarketClawKnowledgeSimilarityHint[];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const record = item as Record<string, unknown>;
    const knowledgeItemId = typeof record.knowledgeItemId === "string" ? record.knowledgeItemId : "";
    const title = typeof record.title === "string" ? record.title : "";
    const knowledgeType = typeof record.knowledgeType === "string" ? record.knowledgeType : "";
    const similarityLevel = typeof record.similarityLevel === "string" ? record.similarityLevel : "";
    const reasons = toStringArray(record.reasons);
    const matchedKeywords = toStringArray(record.matchedKeywords);
    const contentPreview = typeof record.contentPreview === "string" ? record.contentPreview : "";
    const businessLineId =
      typeof record.businessLineId === "string" && record.businessLineId.trim().length ? record.businessLineId : null;

    if (!knowledgeItemId || !title) return [];
    if (!marketClawKnowledgeTypeOptions.some((option) => option.value === knowledgeType)) return [];
    if (!["HIGH", "MEDIUM", "LOW"].includes(similarityLevel)) return [];

    return [
      {
        knowledgeItemId,
        title,
        knowledgeType: knowledgeType as MarketClawKnowledgeType,
        similarityLevel: similarityLevel as MarketClawKnowledgeSimilarityLevel,
        reasons,
        matchedKeywords,
        contentPreview,
        businessLineId
      }
    ];
  });
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

function riskLevelWeight(level: MarketClawReplyRiskLevel) {
  return riskLevelPriority.indexOf(level);
}

function sendModeWeight(mode: MarketClawSendMode) {
  switch (mode) {
    case "AUTO_ALLOWED":
      return 0;
    case "SALES_CONFIRM_REQUIRED":
      return 1;
    case "RISK_CONFIRM_REQUIRED":
      return 2;
    case "INTERNAL_ADVICE_ONLY":
      return 3;
    default:
      return 0;
  }
}

function defaultSendModeForRiskLevel(level: MarketClawReplyRiskLevel) {
  switch (level) {
    case "LOW":
      return "AUTO_ALLOWED" satisfies MarketClawSendMode;
    case "MEDIUM":
      return "SALES_CONFIRM_REQUIRED" satisfies MarketClawSendMode;
    case "HIGH":
      return "RISK_CONFIRM_REQUIRED" satisfies MarketClawSendMode;
    case "BLOCKED":
      return "INTERNAL_ADVICE_ONLY" satisfies MarketClawSendMode;
    default:
      return "SALES_CONFIRM_REQUIRED" satisfies MarketClawSendMode;
  }
}

function clampSendMode(level: MarketClawReplyRiskLevel, preferred?: MarketClawSendMode | null) {
  const baseline = defaultSendModeForRiskLevel(level);
  if (!preferred) return baseline;
  return sendModeWeight(preferred) >= sendModeWeight(baseline) ? preferred : baseline;
}

function summarizeRiskReasons(reasons: Array<string | null | undefined>) {
  const values = dedupeStrings(reasons.filter((item): item is string => Boolean(item?.trim())).map((item) => item.trim()));
  return values.length ? values.join("；") : null;
}

function pickRiskKeywordHits(text: string) {
  const normalized = normalizeText(text);
  const keywordGroups = [
    ...priceKeywords,
    ...effectKeywords,
    ...riskKeywords,
    ...contractKeywords,
    ...blockedKeywords,
    ...autoAllowedKeywords
  ];
  return dedupeStrings(keywordGroups.filter((keyword) => normalized.includes(keyword.toLowerCase())));
}

function baseRiskLevelByKnowledgeType(type?: MarketClawKnowledgeType | null) {
  switch (type) {
    case "FORBIDDEN_COMMITMENT":
      return "BLOCKED" satisfies MarketClawReplyRiskLevel;
    case "PRICE_BOUNDARY":
      return "HIGH" satisfies MarketClawReplyRiskLevel;
    case "RISK_NOTICE":
      return "HIGH" satisfies MarketClawReplyRiskLevel;
    case "FAQ":
    case "STANDARD_REPLY":
    case "SERVICE_INTRO":
    case "CASE_STUDY":
    case "DELIVERY_PROCESS":
    case "OBJECTION_HANDLING":
    case "SALES_SCRIPT":
      return "MEDIUM" satisfies MarketClawReplyRiskLevel;
    default:
      return "MEDIUM" satisfies MarketClawReplyRiskLevel;
  }
}

function nextHigherRiskLevel(current: MarketClawReplyRiskLevel, next: MarketClawReplyRiskLevel) {
  return riskLevelWeight(next) > riskLevelWeight(current) ? next : current;
}

export function inferMarketClawPolicy(input: {
  knowledgeType?: MarketClawKnowledgeType | null;
  content: string;
  forbiddenPhrases?: string[];
  riskNotes?: string | null;
  replyRiskLevel?: MarketClawReplyRiskLevel | null;
  sendMode?: MarketClawSendMode | null;
  riskReason?: string | null;
  internalOnlyNote?: string | null;
  allowLowRisk?: boolean;
  personalScope?: boolean;
}) {
  const combinedText = [input.content, input.riskNotes, ...(input.forbiddenPhrases ?? [])].filter(Boolean).join("\n");
  const normalized = normalizeText(combinedText);
  const riskKeywordHits = pickRiskKeywordHits(combinedText);
  let replyRiskLevel = input.replyRiskLevel ?? baseRiskLevelByKnowledgeType(input.knowledgeType);
  const reasons: string[] = [];
  let internalOnlyNote = input.internalOnlyNote?.trim() || null;

  switch (input.knowledgeType) {
    case "FORBIDDEN_COMMITMENT":
      replyRiskLevel = "BLOCKED";
      reasons.push("命中不能承诺事项");
      internalOnlyNote = internalOnlyNote ?? "这类内容只能提醒内部边界，不能直接发给客户。";
      break;
    case "PRICE_BOUNDARY":
      replyRiskLevel = nextHigherRiskLevel(replyRiskLevel, "HIGH");
      reasons.push("涉及价格、费用或报价边界");
      break;
    case "RISK_NOTICE":
      replyRiskLevel = nextHigherRiskLevel(replyRiskLevel, "HIGH");
      reasons.push("属于风险边界提醒");
      break;
    case "FAQ":
    case "STANDARD_REPLY":
      reasons.push("默认作为业务回复参考，使用前需销售确认");
      break;
    default:
      break;
  }

  if ((input.forbiddenPhrases ?? []).length > 0) {
    replyRiskLevel = nextHigherRiskLevel(replyRiskLevel, "BLOCKED");
    reasons.push("包含不能承诺事项");
    internalOnlyNote = internalOnlyNote ?? "命中不能承诺表达，只能作为内部提醒或审核参考。";
  }

  if (includesKeyword(normalized, blockedKeywords)) {
    replyRiskLevel = nextHigherRiskLevel(replyRiskLevel, "BLOCKED");
    reasons.push("命中绝对承诺或保证类词汇");
    internalOnlyNote = internalOnlyNote ?? "含有绝对承诺表达，不应直接用于对外回复。";
  } else if (includesKeyword(normalized, contractKeywords)) {
    replyRiskLevel = nextHigherRiskLevel(replyRiskLevel, "HIGH");
    reasons.push("涉及合同、责任或赔付边界");
  } else if (includesKeyword(normalized, priceKeywords) || includesKeyword(normalized, effectKeywords) || includesKeyword(normalized, riskKeywords)) {
    replyRiskLevel = nextHigherRiskLevel(replyRiskLevel, "HIGH");
    reasons.push("涉及价格、效果、周期或服务边界");
  } else if (input.allowLowRisk && includesKeyword(normalized, autoAllowedKeywords)) {
    replyRiskLevel = "LOW";
    reasons.push("属于低风险承接或资料引导表达");
  }

  if (input.personalScope && replyRiskLevel === "LOW") {
    replyRiskLevel = "MEDIUM";
    reasons.push("个人话术默认不能直接设为低风险承接");
  }

  const sendMode = clampSendMode(replyRiskLevel, input.sendMode ?? null);
  const requiresReview = replyRiskLevel === "HIGH" || sendMode === "RISK_CONFIRM_REQUIRED";
  const riskReason = summarizeRiskReasons([input.riskReason, ...reasons]);

  return {
    replyRiskLevel,
    sendMode,
    riskReason,
    requiresReview,
    internalOnlyNote: replyRiskLevel === "BLOCKED" ? internalOnlyNote ?? "仅内部建议，不应直接发给客户。" : internalOnlyNote,
    highRiskKnowledgeIds: [] as string[],
    internalAdviceKnowledgeIds: [] as string[],
    riskKeywordHits
  } satisfies MarketClawReplyPolicy;
}

export function resolveMarketClawKnowledgePolicy(item: {
  knowledgeType: MarketClawKnowledgeType;
  content: string;
  forbiddenPhrases?: unknown;
  riskNotes?: string | null;
  replyRiskLevel?: MarketClawReplyRiskLevel | null;
  sendMode?: MarketClawSendMode | null;
  riskReason?: string | null;
  internalOnlyNote?: string | null;
}) {
  return inferMarketClawPolicy({
    knowledgeType: item.knowledgeType,
    content: item.content,
    forbiddenPhrases: parseMarketClawTextArray(item.forbiddenPhrases),
    riskNotes: item.riskNotes,
    replyRiskLevel: item.replyRiskLevel,
    sendMode: item.sendMode,
    riskReason: item.riskReason,
    internalOnlyNote: item.internalOnlyNote
  });
}

export function buildMarketClawReplyPolicy(input: { question: string; matchedKnowledge: KnowledgeLike[] }) {
  const questionPolicy = inferMarketClawPolicy({
    content: input.question,
    knowledgeType: "OTHER",
    allowLowRisk: true
  });
  const matchedPolicies = input.matchedKnowledge.map((item) => ({
    item,
    policy: resolveMarketClawKnowledgePolicy(item)
  }));
  const topLevel = matchedPolicies.reduce(
    (current, entry) =>
      riskLevelWeight(entry.policy.replyRiskLevel) > riskLevelWeight(current.replyRiskLevel) ? entry.policy : current,
    questionPolicy
  );
  const highRiskKnowledgeIds = matchedPolicies
    .filter((entry) => ["HIGH", "BLOCKED"].includes(entry.policy.replyRiskLevel))
    .map((entry) => entry.item.id);
  const internalAdviceKnowledgeIds = matchedPolicies
    .filter((entry) => entry.policy.sendMode === "INTERNAL_ADVICE_ONLY" || entry.policy.replyRiskLevel === "BLOCKED")
    .map((entry) => entry.item.id);
  const matchedReasons = matchedPolicies
    .filter((entry) => riskLevelWeight(entry.policy.replyRiskLevel) >= riskLevelWeight(topLevel.replyRiskLevel) - 1)
    .map((entry) => entry.policy.riskReason);
  const riskReason = summarizeRiskReasons([topLevel.riskReason, ...matchedReasons]);

  return {
    replyRiskLevel: topLevel.replyRiskLevel,
    sendMode: clampSendMode(topLevel.replyRiskLevel, topLevel.sendMode),
    riskReason,
    requiresReview:
      topLevel.requiresReview ||
      matchedPolicies.some((entry) => entry.policy.requiresReview || entry.policy.sendMode === "RISK_CONFIRM_REQUIRED"),
    internalOnlyNote:
      topLevel.replyRiskLevel === "BLOCKED"
        ? summarizeRiskReasons([
            topLevel.internalOnlyNote,
            ...matchedPolicies.map((entry) => entry.policy.internalOnlyNote)
          ]) ?? "仅内部建议，不应直接发给客户。"
        : topLevel.internalOnlyNote,
    highRiskKnowledgeIds,
    internalAdviceKnowledgeIds,
    riskKeywordHits: dedupeStrings([
      ...questionPolicy.riskKeywordHits,
      ...matchedPolicies.flatMap((entry) => entry.policy.riskKeywordHits)
    ])
  } satisfies MarketClawReplyPolicy;
}

function extractCandidateKeywords(...values: string[]) {
  const tokens = values
    .flatMap((value) =>
      value
        .split(/[\s,，。！？；：:\n\r、()（）【】\[\]\-_/]+/)
        .map((item) => item.trim())
        .filter((item) => item.length >= 2)
    )
    .slice(0, 16);
  return dedupeStrings(tokens).slice(0, 8);
}

function detectForbiddenPhrases(text: string) {
  const normalized = normalizeText(text);
  return dedupeStrings(forbiddenCommitmentKeywords.filter((keyword) => normalized.includes(keyword.toLowerCase())));
}

function buildCandidateRiskNotes(type: MarketClawKnowledgeType, content: string) {
  if (type === "FORBIDDEN_COMMITMENT") {
    return "涉及效果、名额、推荐或结果保证时，必须先收紧边界，不能把候选内容直接当作对外承诺。";
  }
  if (type === "PRICE_BOUNDARY") {
    return "价格相关内容只能作为报价边界参考，正式报价前仍需结合客户场景、业务线和服务范围确认。";
  }
  if (type === "OBJECTION_HANDLING") {
    return "异议处理更适合先缓和情绪、再补事实和下一步动作，不要为了推进而追加未经确认的承诺。";
  }
  if (type === "CASE_STUDY") {
    return "案例类内容只适合作为参考样本，不能把别人的结果直接承诺给当前客户。";
  }
  if (includesKeyword(normalizeText(content), effectKeywords)) {
    return "涉及效果、排名、通过率或资源承诺时，需要先加风险边界。";
  }
  return null;
}

function buildCandidateReplies(title: string, content: string, knowledgeType: MarketClawKnowledgeType) {
  const shortReply =
    knowledgeType === "PRICE_BOUNDARY"
      ? "这块我先不给你空口报死价，先按当前客户情况把范围收清楚，再给你更准确的边界。"
      : knowledgeType === "FORBIDDEN_COMMITMENT"
        ? "这类问题我建议先把边界说清楚，避免把结果、名额或推荐说成绝对保证。"
        : knowledgeType === "OBJECTION_HANDLING"
          ? "我先按你现在最在意的点给你一个稳妥说法，再决定下一步怎么推进。"
          : `这条资料更适合整理成“${title}”这类标准说法，先给你一个可直接用的版本。`;
  const professionalReply =
    knowledgeType === "FORBIDDEN_COMMITMENT"
      ? `${content}\n\n使用时请优先保留风险边界，不要把候选知识直接变成绝对承诺。`
      : `${content}\n\n这条候选知识更适合先作为人工审核素材，再决定是否进入正式知识库。`;
  const closingReply =
    knowledgeType === "PRICE_BOUNDARY"
      ? "如果你愿意，我下一步先把客户场景、业务线和预算范围收紧，再把可讲的价格边界整理给你。"
      : knowledgeType === "CASE_STUDY"
        ? "如果要继续推进，建议再补一个更接近当前客户场景的案例，避免只停留在泛化展示。"
        : "如果这条候选内容方向对，我们可以先人工审核，再决定是沉淀为标准回复、风险提醒还是异议处理话术。";

  return { shortReply, professionalReply, closingReply };
}

function tokenizeKnowledgeText(...values: string[]) {
  return dedupeStrings(
    values.flatMap((value) =>
      value
        .toLowerCase()
        .split(/[\s,，。！？；：、\n\r:"'“”‘’（）()【】[\]{}<>《》\-_/|]+/)
        .map((item) => item.trim())
        .filter((item) => item.length >= 2)
    )
  );
}

function intersectStrings(left: string[], right: string[]) {
  const rightSet = new Set(right);
  return left.filter((item) => rightSet.has(item));
}

function buildKnowledgePreview(value: string, maxLength = 96) {
  const text = value.trim();
  return text.length <= maxLength ? text : `${text.slice(0, maxLength)}...`;
}

function areKnowledgeTypesClose(left: MarketClawKnowledgeType, right: MarketClawKnowledgeType) {
  if (left === right) return true;
  const groups: MarketClawKnowledgeType[][] = [
    ["PRICE_BOUNDARY", "RISK_NOTICE", "FORBIDDEN_COMMITMENT"],
    ["FAQ", "STANDARD_REPLY", "OBJECTION_HANDLING"],
    ["SERVICE_INTRO", "DELIVERY_PROCESS", "CASE_STUDY"]
  ];
  return groups.some((group) => group.includes(left) && group.includes(right));
}

function splitIngestionBlocks(rawText: string) {
  return rawText
    .split(/\r?\n\s*\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseFaqCandidates(rawText: string) {
  const results: { question: string; answer: string }[] = [];
  const pattern =
    /(?:^|\n)\s*(?:问|问题|Q)\s*[：:]\s*(.+?)\s*(?:\r?\n)+(?:答|回答|A)\s*[：:]\s*([\s\S]*?)(?=(?:\r?\n){2,}\s*(?:问|问题|Q)\s*[：:]|$)/gim;

  for (const match of rawText.matchAll(pattern)) {
    const question = match[1]?.trim();
    const answer = match[2]?.trim();
    if (question && answer) {
      results.push({ question, answer });
    }
  }

  return results;
}

function pushCandidate(
  candidates: MarketClawKnowledgeCandidateDraft[],
  seenKeys: Set<string>,
  draft: Omit<
    MarketClawKnowledgeCandidateDraft,
    | "suggestedReplyShort"
    | "suggestedReplyProfessional"
    | "suggestedReplyClosing"
    | "suggestedReplyRiskLevel"
    | "suggestedSendMode"
    | "suggestedRiskReason"
    | "requiresReview"
    | "internalOnlyNote"
  >
) {
  const content = draft.content.trim();
  if (!draft.title.trim() || !content) return;
  const uniqueKey = `${draft.knowledgeType}::${draft.title.trim()}::${content}`;
  if (seenKeys.has(uniqueKey)) return;
  seenKeys.add(uniqueKey);
  const replies = buildCandidateReplies(draft.title.trim(), content, draft.knowledgeType);
  const policy = inferMarketClawPolicy({
    knowledgeType: draft.knowledgeType,
    content,
    forbiddenPhrases: draft.suggestedForbiddenPhrases,
    riskNotes: draft.suggestedRiskNotes,
    allowLowRisk: true
  });
  candidates.push({
    ...draft,
    title: draft.title.trim(),
    content,
    suggestedKeywords: dedupeStrings(draft.suggestedKeywords),
    suggestedForbiddenPhrases: dedupeStrings(draft.suggestedForbiddenPhrases),
    suggestedReplyRiskLevel: policy.replyRiskLevel,
    suggestedSendMode: policy.sendMode,
    suggestedRiskReason: policy.riskReason,
    requiresReview: policy.requiresReview,
    internalOnlyNote: policy.internalOnlyNote,
    suggestedReplyShort: replies.shortReply,
    suggestedReplyProfessional: replies.professionalReply,
    suggestedReplyClosing: replies.closingReply
  });
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

function knowledgeScopeWeight(
  item: KnowledgeLike,
  input: { businessLineId?: string | null; departmentName?: string | null; currentUserId?: string | null }
) {
  const businessLineMatch = Boolean(input.businessLineId && item.businessLineId === input.businessLineId);
  const departmentMatch = Boolean(input.departmentName && item.departmentName && item.departmentName === input.departmentName);

  if (item.knowledgeType === "FORBIDDEN_COMMITMENT") {
    if (item.scopeLevel === "ENTERPRISE") return 30;
    if (item.scopeLevel === "BUSINESS_LINE" && businessLineMatch) return 28;
    if (item.scopeLevel === "DEPARTMENT" && departmentMatch) return 24;
  }

  if (item.scopeLevel === "BUSINESS_LINE" && businessLineMatch) return 20;
  if (item.scopeLevel === "DEPARTMENT" && departmentMatch) return 16;
  if (item.scopeLevel === "ENTERPRISE") return 12;
  if (item.scopeLevel === "PERSONAL" && item.createdById === input.currentUserId) return 8;
  return 1;
}

function canUseKnowledgeItem(
  item: KnowledgeLike,
  input: { departmentName?: string | null; currentUserId?: string | null }
) {
  if (item.status !== "ACTIVE" || item.reviewStatus !== "APPROVED") return false;

  if (item.visibility === "PRIVATE") {
    return item.createdById === input.currentUserId;
  }

  if (item.visibility === "DEPARTMENT") {
    if (!item.departmentName) return false;
    return item.departmentName === input.departmentName;
  }

  return true;
}

export function pickMarketClawKnowledge(input: {
  question: string;
  businessLineId?: string | null;
  departmentName?: string | null;
  currentUserId?: string | null;
  knowledgeItems: KnowledgeLike[];
}) {
  const normalized = normalizeText(input.question);
  const signals = buildSignals(input.question);
  return input.knowledgeItems
    .filter((item) => canUseKnowledgeItem(item, input))
    .filter((item) => {
      if (item.scopeLevel === "BUSINESS_LINE") {
        return !item.businessLineId || item.businessLineId === input.businessLineId;
      }
      if (item.scopeLevel === "DEPARTMENT") {
        return !item.businessLineId || item.businessLineId === input.businessLineId;
      }
      if (item.scopeLevel === "PERSONAL") {
        return item.createdById === input.currentUserId;
      }
      return true;
    })
    .map((item) => {
      const matchedKeywordCount = parseKnowledgeKeywords(item).filter((keyword) => normalized.includes(normalizeText(keyword))).length;
      const score =
        matchedKeywordCount * 5 +
        knowledgeTypeWeight(item.knowledgeType) +
        detectKnowledgeTypeBoost(item.knowledgeType, signals) +
        knowledgeScopeWeight(item, input) -
        item.sortOrder / 100;
      return { item, score, matchedKeywordCount };
    })
    .filter((entry) => entry.matchedKeywordCount > 0 || entry.score >= 5)
    .sort((left, right) => right.score - left.score)
    .slice(0, 6)
    .map((entry) => entry.item);
}

export function splitKnowledgeIdsByScope(knowledgeItems: KnowledgeLike[]) {
  return knowledgeItems.reduce(
    (acc, item) => {
      if (item.scopeLevel === "PERSONAL") {
        acc.personal.push(item.id);
      } else if (item.scopeLevel === "DEPARTMENT") {
        acc.department.push(item.id);
      } else {
        acc.enterprise.push(item.id);
      }
      return acc;
    },
    { personal: [] as string[], department: [] as string[], enterprise: [] as string[] }
  );
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

function buildRiskWarnings(question: string, knowledgeItems: KnowledgeLike[], policy: MarketClawReplyPolicy) {
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

  if (policy.replyRiskLevel === "MEDIUM") {
    warnings.add("本次回复属于业务表达，建议销售确认后再使用。");
  }
  if (policy.replyRiskLevel === "HIGH") {
    warnings.add("本次回复涉及高风险边界，建议先确认条件和边界，必要时请负责人介入。");
  }
  if (policy.replyRiskLevel === "BLOCKED") {
    warnings.add(policy.internalOnlyNote ?? "本次内容只能作为内部建议，不能直接发给客户。");
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
  departmentName?: string | null;
  currentUserId?: string | null;
  knowledgeItems: KnowledgeLike[];
}) {
  const signals = buildSignals(input.question);
  const matchedKnowledge = pickMarketClawKnowledge({
    question: input.question,
    businessLineId: input.businessLine?.id,
    departmentName: input.departmentName,
    currentUserId: input.currentUserId,
    knowledgeItems: input.knowledgeItems
  });
  const replyPolicy = buildMarketClawReplyPolicy({
    question: input.question,
    matchedKnowledge
  });
  const suggestedTask = buildSuggestedTask(signals, input.businessLine);

  return {
    shortReply: buildShortReply(input.lead, input.question, matchedKnowledge, signals, input.businessLine),
    professionalReply: buildProfessionalReply(input.lead, matchedKnowledge, signals, input.businessLine),
    closingReply: buildClosingReply(signals, suggestedTask),
    riskWarnings: buildRiskWarnings(input.question, matchedKnowledge, replyPolicy),
    replyRiskLevel: replyPolicy.replyRiskLevel,
    sendMode: replyPolicy.sendMode,
    riskReason: replyPolicy.riskReason,
    requiresReview: replyPolicy.requiresReview,
    internalOnlyNote: replyPolicy.internalOnlyNote,
    highRiskKnowledgeIds: replyPolicy.highRiskKnowledgeIds,
    internalAdviceKnowledgeIds: replyPolicy.internalAdviceKnowledgeIds,
    riskKeywordHits: replyPolicy.riskKeywordHits,
    matchedKnowledgeIds: matchedKnowledge.map((item) => item.id),
    suggestedTags: buildSuggestedTags(signals),
    suggestedMaterialIds: pickSuggestedMaterials(input.businessLine, matchedKnowledge),
    suggestedTask
  } satisfies MarketClawReplyResult;
}

export function generateMarketClawKnowledgeCandidates(input: {
  title: string;
  rawText: string;
  businessLineName?: string | null;
  defaultScopeLevel: MarketClawKnowledgeScopeLevel;
}) {
  const rawText = input.rawText.trim();
  if (!rawText) return [] as MarketClawKnowledgeCandidateDraft[];

  const candidates: MarketClawKnowledgeCandidateDraft[] = [];
  const seenKeys = new Set<string>();
  const faqEntries = parseFaqCandidates(rawText);

  for (const entry of faqEntries) {
    const combined = `${entry.question}\n${entry.answer}`;
    pushCandidate(candidates, seenKeys, {
      title: `FAQ：${entry.question.slice(0, 32)}`,
      content: `问题：${entry.question}\n回答：${entry.answer}`,
      knowledgeType: "FAQ",
      suggestedScopeLevel: input.defaultScopeLevel,
      suggestedKeywords: extractCandidateKeywords(entry.question, entry.answer, input.businessLineName ?? ""),
      suggestedForbiddenPhrases: detectForbiddenPhrases(combined),
      suggestedRiskNotes: buildCandidateRiskNotes("FAQ", combined)
    });
  }

  const blocks = splitIngestionBlocks(rawText);
  for (const block of blocks) {
    const normalized = normalizeText(block);
    const keywords = extractCandidateKeywords(block, input.title, input.businessLineName ?? "");
    const forbiddenPhrases = detectForbiddenPhrases(block);

    if (includesKeyword(normalized, priceKeywords)) {
      pushCandidate(candidates, seenKeys, {
        title: `价格边界：${block.slice(0, 28)}`,
        content: block,
        knowledgeType: "PRICE_BOUNDARY",
        suggestedScopeLevel: input.defaultScopeLevel,
        suggestedKeywords: keywords,
        suggestedForbiddenPhrases: forbiddenPhrases,
        suggestedRiskNotes: buildCandidateRiskNotes("PRICE_BOUNDARY", block)
      });
    }

    if (includesKeyword(normalized, effectKeywords) || forbiddenPhrases.length) {
      pushCandidate(candidates, seenKeys, {
        title: `风险提醒：${block.slice(0, 28)}`,
        content: block,
        knowledgeType: "FORBIDDEN_COMMITMENT",
        suggestedScopeLevel: input.defaultScopeLevel,
        suggestedKeywords: keywords,
        suggestedForbiddenPhrases: forbiddenPhrases.length ? forbiddenPhrases : ["保证", "一定", "效果承诺"],
        suggestedRiskNotes: buildCandidateRiskNotes("FORBIDDEN_COMMITMENT", block)
      });
    }

    if (includesKeyword(normalized, caseKeywords)) {
      pushCandidate(candidates, seenKeys, {
        title: `案例素材：${block.slice(0, 28)}`,
        content: block,
        knowledgeType: "CASE_STUDY",
        suggestedScopeLevel: input.defaultScopeLevel,
        suggestedKeywords: keywords,
        suggestedForbiddenPhrases: forbiddenPhrases,
        suggestedRiskNotes: buildCandidateRiskNotes("CASE_STUDY", block)
      });
    }

    if (includesKeyword(normalized, processKeywords)) {
      pushCandidate(candidates, seenKeys, {
        title: `交付流程：${block.slice(0, 28)}`,
        content: block,
        knowledgeType: "DELIVERY_PROCESS",
        suggestedScopeLevel: input.defaultScopeLevel,
        suggestedKeywords: keywords,
        suggestedForbiddenPhrases: forbiddenPhrases,
        suggestedRiskNotes: buildCandidateRiskNotes("DELIVERY_PROCESS", block)
      });
    }

    if (includesKeyword(normalized, objectionKeywords)) {
      pushCandidate(candidates, seenKeys, {
        title: `异议处理：${block.slice(0, 28)}`,
        content: block,
        knowledgeType: "OBJECTION_HANDLING",
        suggestedScopeLevel: input.defaultScopeLevel,
        suggestedKeywords: keywords,
        suggestedForbiddenPhrases: forbiddenPhrases,
        suggestedRiskNotes: buildCandidateRiskNotes("OBJECTION_HANDLING", block)
      });
    }
  }

  if (!candidates.length) {
    pushCandidate(candidates, seenKeys, {
      title: `候选知识：${input.title.slice(0, 28)}`,
      content: rawText,
      knowledgeType: "OTHER",
      suggestedScopeLevel: input.defaultScopeLevel,
      suggestedKeywords: extractCandidateKeywords(input.title, rawText, input.businessLineName ?? ""),
      suggestedForbiddenPhrases: detectForbiddenPhrases(rawText),
      suggestedRiskNotes: "当前资料未命中明确的 FAQ、价格边界或风险提醒规则，建议人工拆成更清晰的知识条目后再入库。"
    });
  }

  return candidates.slice(0, 24);
}

type SimilarKnowledgeLike = Pick<
  MarketClawKnowledgeItem,
  "id" | "businessLineId" | "title" | "content" | "knowledgeType" | "keywords" | "riskNotes" | "status" | "reviewStatus"
>;

export function findSimilarKnowledgeItems(input: {
  businessLineId?: string | null;
  knowledgeType: MarketClawKnowledgeType;
  title: string;
  content: string;
  suggestedKeywords?: string[];
  suggestedRiskNotes?: string | null;
  knowledgeItems: SimilarKnowledgeLike[];
}) {
  const titleTokens = tokenizeKnowledgeText(input.title);
  const contentTokens = tokenizeKnowledgeText(input.content);
  const keywordTokens = dedupeStrings([
    ...titleTokens,
    ...contentTokens.slice(0, 8),
    ...(input.suggestedKeywords ?? []).map((item) => item.toLowerCase())
  ]);
  const riskTokens = tokenizeKnowledgeText(input.suggestedRiskNotes ?? "");

  return input.knowledgeItems
    .filter((item) => item.status === "ACTIVE" && item.reviewStatus === "APPROVED")
    .map((item) => {
      const reasons = new Set<string>();
      const matchedKeywords = new Set<string>();
      let score = 0;

      if (input.businessLineId && item.businessLineId === input.businessLineId) {
        reasons.add("业务线相同");
        score += 3;
      }

      if (item.knowledgeType === input.knowledgeType) {
        reasons.add("类型相同");
        score += 3;
      } else if (areKnowledgeTypesClose(item.knowledgeType, input.knowledgeType)) {
        reasons.add("类型接近");
        score += 1;
      }

      const itemTitleTokens = tokenizeKnowledgeText(item.title);
      const itemContentTokens = tokenizeKnowledgeText(item.content);
      const itemKeywordTokens = dedupeStrings([
        ...itemTitleTokens,
        ...itemContentTokens.slice(0, 8),
        ...toStringArray(item.keywords).map((keyword) => keyword.toLowerCase())
      ]);
      const itemRiskTokens = tokenizeKnowledgeText(item.riskNotes ?? "");

      const titleOverlap = intersectStrings(titleTokens, itemTitleTokens);
      const contentOverlap = intersectStrings(contentTokens, itemContentTokens);
      const keywordOverlap = intersectStrings(keywordTokens, itemKeywordTokens);
      const riskOverlap = intersectStrings(riskTokens, itemRiskTokens);

      if (titleOverlap.length) {
        reasons.add("标题关键词重合");
        titleOverlap.slice(0, 4).forEach((item) => matchedKeywords.add(item));
        score += Math.min(4, titleOverlap.length * 2);
      }

      if (contentOverlap.length) {
        reasons.add("正文关键词重合");
        contentOverlap.slice(0, 4).forEach((item) => matchedKeywords.add(item));
        score += Math.min(3, contentOverlap.length);
      }

      if (keywordOverlap.length) {
        reasons.add("建议关键词重合");
        keywordOverlap.slice(0, 4).forEach((item) => matchedKeywords.add(item));
        score += Math.min(3, keywordOverlap.length);
      }

      if (riskOverlap.length) {
        reasons.add("风险提醒相似");
        riskOverlap.slice(0, 3).forEach((item) => matchedKeywords.add(item));
        score += 2;
      }

      if (normalizeText(item.title) === normalizeText(input.title)) {
        score += 3;
      }

      const similarityLevel: MarketClawKnowledgeSimilarityLevel | null =
        score >= 9 ? "HIGH" : score >= 6 ? "MEDIUM" : score >= 4 ? "LOW" : null;
      if (!similarityLevel) return null;

      return {
        knowledgeItemId: item.id,
        title: item.title,
        knowledgeType: item.knowledgeType,
        similarityLevel,
        reasons: [...reasons],
        matchedKeywords: [...matchedKeywords].slice(0, 6),
        contentPreview: buildKnowledgePreview(item.content),
        businessLineId: item.businessLineId ?? null,
        score
      };
    })
    .filter((item): item is MarketClawKnowledgeSimilarityHint & { score: number } => Boolean(item))
    .sort((left, right) => right.score - left.score)
    .slice(0, 5)
    .map(({ score: _score, ...item }) => item);
}

export function buildMarketClawMergedKnowledgeContent(input: {
  action: MarketClawKnowledgeCandidateMergeAction;
  targetTitle: string;
  targetContent: string;
  candidateTitle: string;
  candidateContent: string;
}) {
  if (input.action === "APPEND_TO_EXISTING") {
    return `${input.targetContent.trim()}\n\n补充说明（来自候选知识：${input.candidateTitle}）\n${input.candidateContent.trim()}`.trim();
  }

  if (input.action === "MERGE_INTO_EXISTING") {
    return `${input.targetContent.trim()}\n\n整合候选补充：\n${input.candidateContent.trim()}`.trim();
  }

  return input.candidateContent.trim();
}

type MarketClawInsightSourceRecord = {
  text: string;
  businessLineName: string | null;
  createdAt: Date;
};

function cleanInsightText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function trimInsightLabel(value: string, maxLength = 24) {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength)}...`;
}

function extractInsightSubject(value: string) {
  const normalized = cleanInsightText(value)
    .replace(/^(faq|问题|问|q|价格边界|风险提醒|异议处理|案例素材|交付流程|候选知识)[：:]\s*/i, "")
    .replace(/^(回答|答|a)[：:]\s*/i, "");
  const questionMatch = normalized.match(/(?:问题|问|q)[：:]\s*([^。！？\n]+)/i);
  const firstLine = questionMatch?.[1] ?? normalized.split(/(?:回答|答|a)[：:]/i)[0] ?? normalized;
  return trimInsightLabel(firstLine.trim() || normalized);
}

function matchInsightQuestionTheme(text: string) {
  const normalized = normalizeText(text);
  return marketClawInsightQuestionThemes.find((theme) =>
    theme.keywords.some((keyword) => normalized.includes(keyword.toLowerCase()))
  );
}

function matchInsightRiskTheme(text: string) {
  const normalized = normalizeText(text);
  return marketClawInsightRiskThemes.find((theme) =>
    theme.keywords.some((keyword) => normalized.includes(keyword.toLowerCase()))
  );
}

function hasKnowledgeCoverage(
  knowledgeItems: {
    title: string;
    content: string;
    riskNotes: string | null;
    knowledgeType: MarketClawKnowledgeType;
    scopeLevel: MarketClawKnowledgeScopeLevel;
    status: MarketClawKnowledgeStatus;
    reviewStatus: MarketClawKnowledgeReviewStatus;
  }[],
  keywords: string[],
  allowedTypes?: MarketClawKnowledgeType[]
) {
  const normalizedKeywords = dedupeStrings(keywords.map((keyword) => normalizeText(keyword))).filter(Boolean);
  if (!normalizedKeywords.length) return false;

  return knowledgeItems.some((item) => {
    if (item.status !== "ACTIVE" || item.reviewStatus !== "APPROVED") return false;
    if (item.scopeLevel === "PERSONAL") return false;
    if (allowedTypes?.length && !allowedTypes.includes(item.knowledgeType)) return false;

    const searchable = normalizeText([item.title, item.content, item.riskNotes ?? ""].join("\n"));
    return normalizedKeywords.some((keyword) => searchable.includes(keyword));
  });
}

function buildFrequentQuestionStats(
  sources: MarketClawInsightSourceRecord[],
  knowledgeItems: {
    title: string;
    content: string;
    riskNotes: string | null;
    knowledgeType: MarketClawKnowledgeType;
    scopeLevel: MarketClawKnowledgeScopeLevel;
    status: MarketClawKnowledgeStatus;
    reviewStatus: MarketClawKnowledgeReviewStatus;
  }[]
) {
  const aggregate = new Map<
    string,
    {
      count: number;
      businessLines: Set<string>;
      lastSeenAt: Date;
      keywords: string[];
      suggestedAction: string;
    }
  >();

  for (const source of sources) {
    const theme = matchInsightQuestionTheme(source.text);
    const topic = theme?.label ?? extractInsightSubject(source.text);
    const existing = aggregate.get(topic) ?? {
      count: 0,
      businessLines: new Set<string>(),
      lastSeenAt: source.createdAt,
      keywords: theme?.keywords ? [...theme.keywords] : tokenizeKnowledgeText(topic, source.text).slice(0, 6),
      suggestedAction: theme?.suggestedAction ?? "建议补充 FAQ、标准回复或异议处理口径。"
    };

    existing.count += 1;
    if (source.businessLineName) {
      existing.businessLines.add(source.businessLineName);
    }
    if (source.createdAt > existing.lastSeenAt) {
      existing.lastSeenAt = source.createdAt;
    }
    aggregate.set(topic, existing);
  }

  return [...aggregate.entries()]
    .map(([topic, item]) => {
      const hasStandardKnowledge = hasKnowledgeCoverage(knowledgeItems, item.keywords, [
        "FAQ",
        "STANDARD_REPLY",
        "OBJECTION_HANDLING",
        "PRICE_BOUNDARY",
        "FORBIDDEN_COMMITMENT"
      ]);

      return {
        topic,
        count: item.count,
        businessLines: [...item.businessLines],
        lastSeenAt: item.lastSeenAt,
        hasStandardKnowledge,
        suggestedAction: hasStandardKnowledge ? "已有标准知识覆盖，建议继续复盘真实使用反馈。" : item.suggestedAction
      } satisfies MarketClawFrequentQuestionStat;
    })
    .sort((left, right) => right.count - left.count || right.lastSeenAt.getTime() - left.lastSeenAt.getTime())
    .slice(0, 8);
}

function buildRiskQuestionStats(
  sources: MarketClawInsightSourceRecord[],
  knowledgeItems: {
    title: string;
    content: string;
    riskNotes: string | null;
    knowledgeType: MarketClawKnowledgeType;
    scopeLevel: MarketClawKnowledgeScopeLevel;
    status: MarketClawKnowledgeStatus;
    reviewStatus: MarketClawKnowledgeReviewStatus;
  }[]
) {
  const aggregate = new Map<
    string,
    {
      count: number;
      businessLines: Set<string>;
      keywords: string[];
      suggestedAction: string;
    }
  >();

  for (const source of sources) {
    const theme = matchInsightRiskTheme(source.text);
    if (!theme) continue;

    const existing = aggregate.get(theme.label) ?? {
      count: 0,
      businessLines: new Set<string>(),
      keywords: [...theme.keywords],
      suggestedAction: theme.suggestedAction
    };
    existing.count += 1;
    if (source.businessLineName) {
      existing.businessLines.add(source.businessLineName);
    }
    aggregate.set(theme.label, existing);
  }

  return [...aggregate.entries()]
    .map(([riskType, item]) => {
      const hasRiskNotice = hasKnowledgeCoverage(knowledgeItems, item.keywords, ["RISK_NOTICE", "PRICE_BOUNDARY", "FORBIDDEN_COMMITMENT"]);
      const hasForbiddenCommitment = hasKnowledgeCoverage(knowledgeItems, item.keywords, ["FORBIDDEN_COMMITMENT"]);

      return {
        riskType,
        count: item.count,
        businessLines: [...item.businessLines],
        hasRiskNotice,
        hasForbiddenCommitment,
        suggestedAction:
          hasRiskNotice && hasForbiddenCommitment ? "当前已有边界知识，可继续复盘是否需要升级为更稳的标准回复。" : item.suggestedAction
      } satisfies MarketClawRiskQuestionStat;
    })
    .sort((left, right) => right.count - left.count || left.riskType.localeCompare(right.riskType, "zh-CN"))
    .slice(0, 10);
}

function buildKnowledgeGapStats(input: {
  businessLineNames: string[];
  trainingCases: { customerQuestion: string; businessLineName: string }[];
  replyDrafts: { customerQuestion: string; businessLineName: string }[];
  candidates: { reviewStatus: MarketClawKnowledgeCandidateReviewStatus; mergeAction: string | null; businessLineName: string }[];
  knowledgeItems: {
    knowledgeType: MarketClawKnowledgeType;
    scopeLevel: MarketClawKnowledgeScopeLevel;
    businessLineName: string;
    status: MarketClawKnowledgeStatus;
    reviewStatus: MarketClawKnowledgeReviewStatus;
  }[];
}) {
  const statsMap = new Map<
    string,
    {
      trainingCount: number;
      faqCount: number;
      candidateCount: number;
      adoptedCandidateCount: number;
      mergedCandidateCount: number;
      rejectedCandidateCount: number;
      priceQuestionCount: number;
      priceBoundaryCount: number;
      riskQuestionCount: number;
      riskNoticeCount: number;
      personalScriptCount: number;
      teamKnowledgeCount: number;
    }
  >();

  const getStats = (businessLine: string) => {
    const key = businessLine || "通用资料";
    const existing =
      statsMap.get(key) ??
      {
        trainingCount: 0,
        faqCount: 0,
        candidateCount: 0,
        adoptedCandidateCount: 0,
        mergedCandidateCount: 0,
        rejectedCandidateCount: 0,
        priceQuestionCount: 0,
        priceBoundaryCount: 0,
        riskQuestionCount: 0,
        riskNoticeCount: 0,
        personalScriptCount: 0,
        teamKnowledgeCount: 0
      };
    statsMap.set(key, existing);
    return existing;
  };

  for (const businessLine of input.businessLineNames) {
    getStats(businessLine);
  }

  for (const item of [...input.trainingCases, ...input.replyDrafts]) {
    const stats = getStats(item.businessLineName);
    stats.trainingCount += 1;
    const normalized = normalizeText(item.customerQuestion);
    if (includesKeyword(normalized, priceKeywords)) {
      stats.priceQuestionCount += 1;
    }
    if (includesKeyword(normalized, riskKeywords)) {
      stats.riskQuestionCount += 1;
    }
  }

  for (const candidate of input.candidates) {
    const stats = getStats(candidate.businessLineName);
    stats.candidateCount += 1;
    if (candidate.reviewStatus === "ADOPTED" || candidate.reviewStatus === "ADOPTED_WITH_EDIT") {
      stats.adoptedCandidateCount += 1;
    }
    if (candidate.reviewStatus === "MERGED") {
      stats.mergedCandidateCount += 1;
    }
    if (candidate.reviewStatus === "REJECTED") {
      stats.rejectedCandidateCount += 1;
    }
  }

  for (const item of input.knowledgeItems) {
    if (item.status !== "ACTIVE" || item.reviewStatus !== "APPROVED") continue;
    const stats = getStats(item.businessLineName);
    if (["FAQ", "STANDARD_REPLY", "OBJECTION_HANDLING"].includes(item.knowledgeType)) {
      stats.faqCount += 1;
    }
    if (item.knowledgeType === "PRICE_BOUNDARY") {
      stats.priceBoundaryCount += 1;
    }
    if (item.knowledgeType === "RISK_NOTICE" || item.knowledgeType === "FORBIDDEN_COMMITMENT") {
      stats.riskNoticeCount += 1;
    }
    if (item.scopeLevel === "PERSONAL") {
      stats.personalScriptCount += 1;
    }
    if (item.scopeLevel === "DEPARTMENT" || item.scopeLevel === "BUSINESS_LINE") {
      stats.teamKnowledgeCount += 1;
    }
  }

  const gaps: MarketClawKnowledgeGap[] = [];
  for (const [businessLine, stats] of statsMap.entries()) {
    if (stats.trainingCount >= 3 && stats.faqCount <= 1) {
      gaps.push({
        businessLine,
        gapType: "高频问题多但 FAQ 偏少",
        currentSnapshot: `${stats.trainingCount} 条训练 / ${stats.faqCount} 条 FAQ`,
        suggestedContent: "补充 FAQ、标准回复和异议处理。",
        nextAction: "先整理该业务线最常见的 10~20 个客户问题。"
      });
    }

    if (stats.candidateCount >= 3 && stats.adoptedCandidateCount === 0) {
      gaps.push({
        businessLine,
        gapType: "候选知识多但采纳偏少",
        currentSnapshot: `${stats.candidateCount} 条候选 / ${stats.adoptedCandidateCount} 条采纳`,
        suggestedContent: "补充更清晰的候选标题、标准回复和审核说明。",
        nextAction: "复盘资料投喂质量，优先提升候选可采纳率。"
      });
    }

    if (stats.priceQuestionCount >= 2 && stats.priceBoundaryCount === 0) {
      gaps.push({
        businessLine,
        gapType: "价格边界不足",
        currentSnapshot: `${stats.priceQuestionCount} 个价格问题 / ${stats.priceBoundaryCount} 条价格边界`,
        suggestedContent: "补充价格边界、报价条件和报价前问法。",
        nextAction: "优先把价格敏感问题整理成标准边界。"
      });
    }

    if (stats.riskQuestionCount >= 2 && stats.riskNoticeCount === 0) {
      gaps.push({
        businessLine,
        gapType: "风险提醒不足",
        currentSnapshot: `${stats.riskQuestionCount} 个风险问题 / ${stats.riskNoticeCount} 条风险提醒`,
        suggestedContent: "补充不能承诺事项、效果边界和风险提醒。",
        nextAction: "由管理员复审该业务线的高风险问题。"
      });
    }

    if (stats.personalScriptCount >= 3 && stats.teamKnowledgeCount <= 1) {
      gaps.push({
        businessLine,
        gapType: "个人话术较多但团队标准偏少",
        currentSnapshot: `${stats.personalScriptCount} 条个人话术 / ${stats.teamKnowledgeCount} 条团队标准`,
        suggestedContent: "把高质量个人话术升级为团队标准。",
        nextAction: "优先挑选已被多次采用的话术进入训练审核。"
      });
    }

    if (stats.rejectedCandidateCount >= 3 && stats.rejectedCandidateCount >= stats.adoptedCandidateCount + 2) {
      gaps.push({
        businessLine,
        gapType: "候选驳回偏多",
        currentSnapshot: `${stats.rejectedCandidateCount} 条驳回 / ${stats.adoptedCandidateCount} 条采纳`,
        suggestedContent: "补充更稳定的资料投喂模板和拆解规则。",
        nextAction: "先复盘素材质量，再决定是否继续扩大投喂量。"
      });
    }

    if (stats.mergedCandidateCount >= 3) {
      gaps.push({
        businessLine,
        gapType: "重复候选偏多",
        currentSnapshot: `${stats.mergedCandidateCount} 条合并候选`,
        suggestedContent: "补充统一标题规则和来源整理。",
        nextAction: "优先清理该业务线重复知识，避免知识库越用越散。"
      });
    }
  }

  return gaps.slice(0, 12);
}

function buildMaturityStage(input: {
  summaryMetrics: MarketClawInsightsSummaryMetrics;
  knowledgeGaps: MarketClawKnowledgeGap[];
  approvedKnowledgeItems: { knowledgeType: MarketClawKnowledgeType; scopeLevel: MarketClawKnowledgeScopeLevel }[];
}) {
  const priceBoundaryCount = input.approvedKnowledgeItems.filter((item) => item.knowledgeType === "PRICE_BOUNDARY").length;
  const riskNoticeCount = input.approvedKnowledgeItems.filter((item) =>
    item.knowledgeType === "RISK_NOTICE" || item.knowledgeType === "FORBIDDEN_COMMITMENT"
  ).length;
  const enterpriseStandardCount =
    input.summaryMetrics.enterpriseKnowledgeCount +
    input.summaryMetrics.teamKnowledgeCount +
    input.summaryMetrics.businessLineKnowledgeCount;

  if (
    enterpriseStandardCount >= 24 &&
    input.summaryMetrics.trainingTotal >= 30 &&
    input.summaryMetrics.ingestionBatchCount >= 4 &&
    input.summaryMetrics.mergedCandidateCount >= 4 &&
    priceBoundaryCount >= 3 &&
    riskNoticeCount >= 3
  ) {
    return {
      stage: "成熟运营阶段",
      rationale: [
        `标准知识 ${enterpriseStandardCount} 条，训练样本 ${input.summaryMetrics.trainingTotal} 条。`,
        `资料投喂 ${input.summaryMetrics.ingestionBatchCount} 批，合并候选 ${input.summaryMetrics.mergedCandidateCount} 条。`,
        `价格边界 ${priceBoundaryCount} 条，风险提醒 ${riskNoticeCount} 条。`
      ],
      nextActions: ["做月度知识治理。", "按业务线评估知识质量。", "建立优秀话术榜和复审节奏。"] 
    } satisfies MarketClawMaturityStage;
  }

  if (
    input.summaryMetrics.enterpriseKnowledgeCount >= 10 &&
    input.summaryMetrics.teamKnowledgeCount >= 6 &&
    input.summaryMetrics.businessLineKnowledgeCount >= 6 &&
    input.summaryMetrics.pendingTrainingCount <= 5 &&
    input.summaryMetrics.adoptedCandidateCount >= 8
  ) {
    return {
      stage: "标准化阶段",
      rationale: [
        `企业标准 ${input.summaryMetrics.enterpriseKnowledgeCount} 条，团队标准 ${input.summaryMetrics.teamKnowledgeCount} 条。`,
        `业务线知识 ${input.summaryMetrics.businessLineKnowledgeCount} 条，待审核训练 ${input.summaryMetrics.pendingTrainingCount} 条。`,
        `候选采纳 ${input.summaryMetrics.adoptedCandidateCount} 条。`
      ],
      nextActions: ["定期复审企业标准知识。", "继续识别知识缺口。", "复盘销售贡献并优化训练质量。"] 
    } satisfies MarketClawMaturityStage;
  }

  if (
    input.summaryMetrics.trainingTotal >= 10 &&
    input.summaryMetrics.candidateCount >= 10 &&
    (input.summaryMetrics.mergedCandidateCount >= 2 || input.knowledgeGaps.length >= 2)
  ) {
    return {
      stage: "成长期",
      rationale: [
        `训练样本 ${input.summaryMetrics.trainingTotal} 条，候选知识 ${input.summaryMetrics.candidateCount} 条。`,
        `已合并候选 ${input.summaryMetrics.mergedCandidateCount} 条，当前知识缺口 ${input.knowledgeGaps.length} 项。`
      ],
      nextActions: ["优先做候选去重和合并。", "按业务线补齐 FAQ、案例、价格边界与异议处理。", "开始固定复盘高频客户问题。"] 
    } satisfies MarketClawMaturityStage;
  }

  if (input.summaryMetrics.ingestionBatchCount > 0 && input.summaryMetrics.candidateCount > 0) {
    return {
      stage: "启动阶段",
      rationale: [
        `资料投喂 ${input.summaryMetrics.ingestionBatchCount} 批，候选知识 ${input.summaryMetrics.candidateCount} 条。`,
        `已采纳候选 ${input.summaryMetrics.adoptedCandidateCount} 条，训练样本 ${input.summaryMetrics.trainingTotal} 条。`
      ],
      nextActions: ["优先完善核心业务线知识。", "建立标准回复与风险提醒。", "让销售稳定使用“我的训练”。"] 
    } satisfies MarketClawMaturityStage;
  }

  return {
    stage: "初始阶段",
    rationale: [
      `训练样本 ${input.summaryMetrics.trainingTotal} 条，企业标准 ${input.summaryMetrics.enterpriseKnowledgeCount} 条。`,
      `个人话术 ${input.summaryMetrics.personalKnowledgeCount} 条，候选知识 ${input.summaryMetrics.candidateCount} 条。`
    ],
    nextActions: ["先补企业介绍、服务介绍、基础 FAQ、价格边界和不能承诺事项。", "优先整理客户常问的 20 个问题。", "暂时不要急着追求复杂复盘。"] 
  } satisfies MarketClawMaturityStage;
}

export async function getMarketClawTrainingInsights(input: {
  tenantId: string;
  role: UserRole;
  userId: string;
}) {
  const isPersonalView = input.role === "SALES";

  const [businessLines, users, trainingCases, replyDrafts, ingestionBatches, candidates, knowledgeItems] = await Promise.all([
    prisma.businessLine.findMany({
      where: { tenantId: input.tenantId, status: "ACTIVE" },
      select: { id: true, name: true },
      orderBy: [{ priority: "asc" }, { updatedAt: "desc" }]
    }),
    prisma.user.findMany({
      where: { tenantId: input.tenantId },
      select: { id: true, name: true }
    }),
    prisma.marketClawTrainingCase.findMany({
      where: {
        tenantId: input.tenantId,
        ...(isPersonalView
          ? {
              OR: [{ ownerUserId: input.userId }, { createdById: input.userId }]
            }
          : {})
      },
      select: {
        customerQuestion: true,
        reviewStatus: true,
        createdAt: true,
        updatedAt: true,
        ownerUserId: true,
        createdById: true,
        reviewComment: true,
        promotedKnowledgeItemId: true,
        createdBy: { select: { name: true } },
        businessLine: { select: { name: true } },
        promotedKnowledgeItem: { select: { scopeLevel: true } }
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }]
    }),
    prisma.marketClawReplyDraft.findMany({
      where: {
        tenantId: input.tenantId,
        ...(isPersonalView ? { createdById: input.userId } : {})
      },
      select: {
        customerQuestion: true,
        createdAt: true,
        businessLine: { select: { name: true } }
      },
      orderBy: { createdAt: "desc" }
    }),
    isPersonalView
      ? Promise.resolve([])
      : prisma.marketClawIngestionBatch.findMany({
          where: { tenantId: input.tenantId },
          select: { id: true }
        }),
    isPersonalView
      ? Promise.resolve([])
      : prisma.marketClawKnowledgeCandidate.findMany({
          where: { tenantId: input.tenantId },
          select: {
            id: true,
            title: true,
            content: true,
            knowledgeType: true,
            reviewStatus: true,
            mergeAction: true,
            mergeReason: true,
            mergedAt: true,
            updatedAt: true,
            mergedById: true,
            createdBy: { select: { name: true } },
            businessLine: { select: { name: true } },
            adoptedKnowledgeItemId: true
          },
          orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }]
        }),
    prisma.marketClawKnowledgeItem.findMany({
      where: {
        tenantId: input.tenantId,
        ...(isPersonalView
          ? {
              OR: [
                { ownerUserId: input.userId },
                { createdById: input.userId, scopeLevel: "PERSONAL" }
              ]
            }
          : {})
      },
      select: {
        id: true,
        title: true,
        content: true,
        knowledgeType: true,
        scopeLevel: true,
        status: true,
        reviewStatus: true,
        riskNotes: true,
        sourceCandidateIds: true,
        sourceBatchIds: true,
        lastMergedAt: true,
        createdById: true,
        ownerUserId: true,
        updatedBy: { select: { name: true } },
        businessLine: { select: { name: true } }
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }]
    })
  ]);

  const userNameMap = new Map(users.map((user) => [user.id, user.name]));
  const businessLineNames = businessLines.map((item) => item.name);
  const approvedKnowledgeItems = knowledgeItems.filter((item) => item.status === "ACTIVE" && item.reviewStatus === "APPROVED");

  const questionSources: MarketClawInsightSourceRecord[] = [
    ...trainingCases.map((item) => ({
      text: item.customerQuestion,
      businessLineName: item.businessLine?.name ?? null,
      createdAt: item.updatedAt
    })),
    ...replyDrafts.map((item) => ({
      text: item.customerQuestion,
      businessLineName: item.businessLine?.name ?? null,
      createdAt: item.createdAt
    })),
    ...candidates.flatMap((item) => [
      {
        text: item.title,
        businessLineName: item.businessLine?.name ?? null,
        createdAt: item.updatedAt
      },
      {
        text: item.content,
        businessLineName: item.businessLine?.name ?? null,
        createdAt: item.updatedAt
      }
    ]),
    ...approvedKnowledgeItems
      .filter((item) => ["FAQ", "STANDARD_REPLY", "OBJECTION_HANDLING"].includes(item.knowledgeType))
      .flatMap((item) => [
        {
          text: item.title,
          businessLineName: item.businessLine?.name ?? null,
          createdAt: item.lastMergedAt ?? new Date()
        },
        {
          text: item.content,
          businessLineName: item.businessLine?.name ?? null,
          createdAt: item.lastMergedAt ?? new Date()
        }
      ])
  ];

  const myTrainingCount = trainingCases.filter((item) => item.ownerUserId === input.userId || item.createdById === input.userId).length;
  const personalKnowledgeCount = knowledgeItems.filter((item) => item.scopeLevel === "PERSONAL").length;
  const approvedTrainingStatuses = ["TEAM_APPROVED", "ENTERPRISE_APPROVED"];
  const summaryMetrics: MarketClawInsightsSummaryMetrics = {
    trainingTotal: trainingCases.length,
    myTrainingCount,
    pendingTrainingCount: trainingCases.filter((item) => item.reviewStatus === "PENDING_REVIEW").length,
    adoptedTrainingCount: trainingCases.filter((item) => approvedTrainingStatuses.includes(item.reviewStatus)).length,
    rejectedTrainingCount: trainingCases.filter((item) => item.reviewStatus === "REJECTED").length,
    personalScriptCount: personalKnowledgeCount,
    ingestionBatchCount: ingestionBatches.length,
    candidateCount: candidates.length,
    adoptedCandidateCount: candidates.filter((item) => item.reviewStatus === "ADOPTED" || item.reviewStatus === "ADOPTED_WITH_EDIT").length,
    mergedCandidateCount: candidates.filter((item) => item.reviewStatus === "MERGED").length,
    rejectedCandidateCount: candidates.filter((item) => item.reviewStatus === "REJECTED").length,
    enterpriseKnowledgeCount: approvedKnowledgeItems.filter((item) => item.scopeLevel === "ENTERPRISE").length,
    teamKnowledgeCount: approvedKnowledgeItems.filter((item) => item.scopeLevel === "DEPARTMENT").length,
    businessLineKnowledgeCount: approvedKnowledgeItems.filter((item) => item.scopeLevel === "BUSINESS_LINE").length,
    personalKnowledgeCount
  };

  const frequentQuestions = buildFrequentQuestionStats(questionSources, approvedKnowledgeItems);
  const riskQuestionStats = isPersonalView ? [] : buildRiskQuestionStats(questionSources, approvedKnowledgeItems);
  const knowledgeGaps = isPersonalView
    ? []
    : buildKnowledgeGapStats({
        businessLineNames,
        trainingCases: trainingCases.map((item) => ({
          customerQuestion: item.customerQuestion,
          businessLineName: item.businessLine?.name ?? "通用资料"
        })),
        replyDrafts: replyDrafts.map((item) => ({
          customerQuestion: item.customerQuestion,
          businessLineName: item.businessLine?.name ?? "通用资料"
        })),
        candidates: candidates.map((item) => ({
          reviewStatus: item.reviewStatus,
          mergeAction: item.mergeAction,
          businessLineName: item.businessLine?.name ?? "通用资料"
        })),
        knowledgeItems: approvedKnowledgeItems.map((item) => ({
          knowledgeType: item.knowledgeType,
          scopeLevel: item.scopeLevel,
          businessLineName: item.businessLine?.name ?? "通用资料",
          status: item.status,
          reviewStatus: item.reviewStatus
        }))
      });

  const recentAdoptions = candidates
    .filter((item) => item.reviewStatus === "ADOPTED" || item.reviewStatus === "ADOPTED_WITH_EDIT")
    .slice(0, 6)
    .map((item) => ({
      title: item.title,
      businessLine: item.businessLine?.name ?? "通用资料",
      knowledgeType: marketClawKnowledgeTypeLabelMap.get(item.knowledgeType) ?? item.knowledgeType,
      occurredAt: item.updatedAt,
      operatorName: item.createdBy.name,
      reviewStatus: item.reviewStatus === "ADOPTED_WITH_EDIT" ? "修改后采纳" : "已采纳"
    }));

  const recentMerges = candidates
    .filter((item) => item.reviewStatus === "MERGED")
    .slice(0, 6)
    .map((item) => ({
      title: item.title,
      businessLine: item.businessLine?.name ?? "通用资料",
      knowledgeType: marketClawKnowledgeTypeLabelMap.get(item.knowledgeType) ?? item.knowledgeType,
      occurredAt: item.mergedAt ?? item.updatedAt,
      operatorName: userNameMap.get(item.mergedById ?? "") ?? item.createdBy.name,
      reviewStatus: item.mergeAction === "APPEND_TO_EXISTING" ? "补充追加" : "已合并"
    }));

  const contributorMap = new Map<string, { adoptedCount: number; latestAt: Date }>();
  for (const item of trainingCases) {
    if (!item.promotedKnowledgeItemId && !approvedTrainingStatuses.includes(item.reviewStatus)) continue;
    const key = item.createdBy.name;
    const existing = contributorMap.get(key) ?? { adoptedCount: 0, latestAt: item.updatedAt };
    existing.adoptedCount += 1;
    if (item.updatedAt > existing.latestAt) {
      existing.latestAt = item.updatedAt;
    }
    contributorMap.set(key, existing);
  }

  const topContributors = [...contributorMap.entries()]
    .map(([userName, item]) => ({
      userName,
      adoptedCount: item.adoptedCount,
      latestAt: item.latestAt
    }))
    .sort((left, right) => right.adoptedCount - left.adoptedCount || right.latestAt.getTime() - left.latestAt.getTime())
    .slice(0, 6);

  const mostMergedKnowledgeItems = approvedKnowledgeItems
    .map((item) => ({
      title: item.title,
      businessLine: item.businessLine?.name ?? "通用资料",
      sourceCandidateCount: parseMarketClawTextArray(item.sourceCandidateIds).length,
      sourceBatchCount: parseMarketClawTextArray(item.sourceBatchIds).length,
      lastMergedAt: item.lastMergedAt
    }))
    .filter((item) => item.sourceCandidateCount > 0)
    .sort((left, right) => right.sourceCandidateCount - left.sourceCandidateCount || (right.lastMergedAt?.getTime() ?? 0) - (left.lastMergedAt?.getTime() ?? 0))
    .slice(0, 6);

  const duplicateRejectedTypeMap = new Map<string, number>();
  for (const item of candidates) {
    if (item.reviewStatus !== "REJECTED" || item.mergeAction !== "REJECT_AS_DUPLICATE") continue;
    duplicateRejectedTypeMap.set(item.knowledgeType, (duplicateRejectedTypeMap.get(item.knowledgeType) ?? 0) + 1);
  }
  const duplicateRejectedTypes = [...duplicateRejectedTypeMap.entries()]
    .map(([knowledgeType, count]) => ({
      knowledgeType: marketClawKnowledgeTypeLabelMap.get(knowledgeType as MarketClawKnowledgeType) ?? knowledgeType,
      count
    }))
    .sort((left, right) => right.count - left.count)
    .slice(0, 6);

  const personalReviewProgress = trainingCases
    .filter((item) => item.ownerUserId === input.userId || item.createdById === input.userId)
    .slice(0, 8)
    .map((item) => ({
      question: item.customerQuestion,
      reviewStatus:
        marketClawTrainingReviewStatusOptions.find((option) => option.value === item.reviewStatus)?.label ?? item.reviewStatus,
      updatedAt: item.updatedAt,
      reviewComment: item.reviewComment,
      promotedScope: item.promotedKnowledgeItem?.scopeLevel ?? null
    }));

  return {
    roleView: isPersonalView ? "PERSONAL" : "GLOBAL",
    summaryMetrics,
    frequentQuestions,
    riskQuestionStats,
    knowledgeGaps,
    adoptionStats: {
      recentAdoptions,
      topContributors
    },
    mergeStats: {
      recentMerges,
      mostMergedKnowledgeItems,
      duplicateRejectedTypes
    },
    maturityStage: isPersonalView ? null : buildMaturityStage({ summaryMetrics, knowledgeGaps, approvedKnowledgeItems }),
    personalReviewProgress
  } satisfies MarketClawTrainingInsights;
}

export function materialTitlesFromIds(materials: MaterialLike[], ids: string[]) {
  const byId = new Map(materials.map((material) => [material.id, material.title]));
  return ids.map((id) => byId.get(id)).filter((title): title is string => Boolean(title));
}
