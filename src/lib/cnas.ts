/*
 * 文件说明：该文件集中维护 CNAS 认可指南项目接入所需的问卷选项、诊断规则和结构化结果工具。
 * 功能说明：负责公开问卷字段配置、A/B/C 初步诊断、意向等级判断、标签映射、来源归类和扩展数据解析。
 *
 * 结构概览：
 *   第一部分：基础常量与公开问卷选项
 *   第二部分：诊断规则与标签映射
 *   第三部分：来源、任务与扩展数据工具
 *   第四部分：公共结果读取与展示辅助
 */
import { FollowTaskPriority, LeadSource, type IntentionLevel, type Prisma } from "@prisma/client";

export const CNAS_TARGET_TENANT_SLUG = "zhengmu-platform";
export const CNAS_BUSINESS_LINE_SLUG = "cnas-guide";
export const CNAS_BUSINESS_LINE_NAME = "CNAS认可指南";
export const CNAS_SOURCE_PAGE = "/forms/cnas-path-check";

export type CnasDiagnosisType = "A" | "B" | "C";
export type CnasIntentionBand = "高意向" | "中意向" | "低意向";

export type CnasFormValues = {
  company: string;
  contactName: string;
  phone: string;
  labType: string;
  currentStage: string;
  scopeClarity: string;
  readiness: string;
  primaryConcern: string;
  startPlan: string;
  wecomAdded: string;
  note?: string;
  sourcePage: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  submittedAt: string;
};

export type CnasDiagnosisResult = {
  diagnosisType: CnasDiagnosisType;
  title: string;
  summary: string;
  nextAction: string;
  taskTitle: string;
  taskDescription: string;
  taskPriority: FollowTaskPriority;
  dueInMinutes: number;
  intentionLevel: IntentionLevel;
  intentionTag: CnasIntentionBand;
  labTypeTag: string;
  stageTag: string;
  riskTag: string;
  sourceTag: string;
  sourceLabel: string;
  leadSource: LeadSource;
};

type Option = {
  value: string;
  label: string;
};

type CnasExtraData = {
  cnas?: {
    businessLineName: string;
    businessLineSlug: string;
    diagnosisType: CnasDiagnosisType;
    diagnosisTitle: string;
    diagnosisSummary: string;
    nextAction: string;
    taskTitle: string;
    taskDescription: string;
    intentionLevel: IntentionLevel;
    intentionTag: CnasIntentionBand;
    labTypeTag: string;
    stageTag: string;
    riskTag: string;
    sourceTag: string;
    sourceLabel: string;
    sourcePage: string;
    wecomAdded: string;
    questionnaire: Omit<CnasFormValues, "sourcePage" | "submittedAt">;
    utm: {
      utm_source?: string;
      utm_medium?: string;
      utm_campaign?: string;
      utm_content?: string;
      utm_term?: string;
    };
    submittedAt: string;
  };
};

export const cnasLabTypeOptions: Option[] = [
  { value: "检测实验室", label: "检测实验室" },
  { value: "校准实验室", label: "校准实验室" },
  { value: "企业内检实验室", label: "企业内检实验室" },
  { value: "第三方实验室", label: "第三方实验室" },
  { value: "暂不确定", label: "暂不确定" }
];

export const cnasCurrentStageOptions: Option[] = [
  { value: "刚开始了解", label: "刚开始了解" },
  { value: "已准备建设", label: "已准备建设" },
  { value: "已做体系文件", label: "已做体系文件" },
  { value: "准备申请", label: "准备申请" },
  { value: "评审后整改", label: "评审后整改" }
];

export const cnasScopeClarityOptions: Option[] = [
  { value: "已明确", label: "已明确" },
  { value: "大致明确", label: "大致明确" },
  { value: "还不清楚", label: "还不清楚" }
];

export const cnasReadinessOptions: Option[] = [
  { value: "基本具备", label: "基本具备" },
  { value: "部分具备", label: "部分具备" },
  { value: "不确定", label: "不确定" },
  { value: "明显不足", label: "明显不足" }
];

export const cnasPrimaryConcernOptions: Option[] = [
  { value: "周期太长", label: "周期太长" },
  { value: "费用不清楚", label: "费用不清楚" },
  { value: "不知道从哪开始", label: "不知道从哪开始" },
  { value: "体系文件不会做", label: "体系文件不会做" },
  { value: "人员设备不清楚", label: "人员设备不清楚" },
  { value: "担心评审不过", label: "担心评审不过" },
  { value: "已经返工过", label: "已经返工过" }
];

export const cnasStartPlanOptions: Option[] = [
  { value: "立即启动", label: "立即启动" },
  { value: "1个月内", label: "1个月内" },
  { value: "3个月内", label: "3个月内" },
  { value: "只是先了解", label: "只是先了解" }
];

export const cnasWeComAddedOptions: Option[] = [
  { value: "是", label: "是" },
  { value: "否", label: "否" }
];

export const cnasWelcomeTemplateText = `你好，我是CNAS认可指南的顾问。

如果你已经确定要做CNAS认可，建议不要急着先做材料，而是先判断当前是否适合启动，并提前做好认可路径设计。

你可以先填写这份《CNAS认可路径判断问卷》，系统会根据你的实验室类型、当前阶段和主要担心问题，给出一份初步判断结果。

填写入口：
${CNAS_SOURCE_PAGE}`;

function hasAny(value: string, matches: string[]) {
  return matches.includes(value);
}

function resolveLabTypeTag(labType: string) {
  if (labType === "检测实验室") return "检测";
  if (labType === "校准实验室") return "校准";
  if (labType === "企业内检实验室") return "企业内检";
  if (labType === "第三方实验室") return "第三方";
  return "不确定";
}

function resolveStageTag(currentStage: string) {
  if (currentStage === "刚开始了解") return "了解";
  if (currentStage === "已准备建设") return "建设";
  if (currentStage === "已做体系文件") return "体系文件";
  if (currentStage === "准备申请") return "准备申请";
  if (currentStage === "评审后整改") return "评审整改";
  return "了解";
}

function resolveRiskTag(primaryConcern: string) {
  if (primaryConcern === "周期太长") return "周期";
  if (primaryConcern === "费用不清楚") return "费用";
  if (hasAny(primaryConcern, ["不知道从哪开始", "体系文件不会做"])) return "材料";
  if (primaryConcern === "人员设备不清楚") return "人员设备";
  if (primaryConcern === "担心评审不过") return "评审";
  if (primaryConcern === "已经返工过") return "返工";
  return "材料";
}

function resolveSourceLabel(utmSource?: string, sourcePage?: string) {
  const normalized = `${utmSource ?? ""} ${sourcePage ?? ""}`.toLowerCase();
  if (/(gongzhonghao|公众号|wechat|weixin)/.test(normalized)) {
    return { tag: "公众号", sourceLabel: "公众号", leadSource: LeadSource.gongzhonghao };
  }
  if (/(shipinhao|视频号|video)/.test(normalized)) {
    return { tag: "视频号", sourceLabel: "视频号", leadSource: LeadSource.shipinhao };
  }
  if (/(douyin|抖音)/.test(normalized)) {
    return { tag: "抖音", sourceLabel: "抖音", leadSource: LeadSource.douyin };
  }
  if (/(xiaohongshu|小红书|rednote)/.test(normalized)) {
    return { tag: "小红书", sourceLabel: "小红书", leadSource: LeadSource.xiaohongshu };
  }
  if (/(zhihu|知乎)/.test(normalized)) {
    return { tag: "知乎", sourceLabel: "知乎", leadSource: LeadSource.other };
  }
  if (/(search|seo|sem|baidu|google|bing|搜索)/.test(normalized)) {
    return { tag: "搜索", sourceLabel: "搜索", leadSource: LeadSource.website };
  }
  if (/(ads|ad|投流|cpc|ocpc|information_flow)/.test(normalized)) {
    return { tag: "投流", sourceLabel: "投流", leadSource: LeadSource.other };
  }
  return { tag: "其他", sourceLabel: "其他", leadSource: LeadSource.other };
}

function resolveIntention(values: CnasFormValues) {
  const high = [
    values.startPlan === "立即启动",
    values.startPlan === "1个月内",
    values.currentStage === "准备申请",
    values.currentStage === "评审后整改",
    values.primaryConcern === "已经返工过"
  ].some(Boolean);
  if (high) {
    return { intentionLevel: "HIGH" as IntentionLevel, intentionTag: "高意向" as CnasIntentionBand };
  }

  const medium = [
    values.currentStage === "已准备建设",
    values.currentStage === "已做体系文件",
    values.startPlan === "3个月内",
    values.readiness === "部分具备"
  ].some(Boolean);
  if (medium) {
    return { intentionLevel: "MEDIUM" as IntentionLevel, intentionTag: "中意向" as CnasIntentionBand };
  }

  return { intentionLevel: "LOW" as IntentionLevel, intentionTag: "低意向" as CnasIntentionBand };
}

export function getCnasDiagnosisResult(values: CnasFormValues): CnasDiagnosisResult {
  const sourceInfo = resolveSourceLabel(values.utmSource, values.sourcePage);
  const intention = resolveIntention(values);
  const shared = {
    ...intention,
    labTypeTag: resolveLabTypeTag(values.labType),
    stageTag: resolveStageTag(values.currentStage),
    riskTag: resolveRiskTag(values.primaryConcern),
    sourceTag: sourceInfo.tag,
    sourceLabel: sourceInfo.sourceLabel,
    leadSource: sourceInfo.leadSource
  };

  const isA = [
    values.currentStage === "准备申请",
    values.currentStage === "评审后整改",
    values.startPlan === "立即启动",
    values.startPlan === "1个月内",
    values.primaryConcern === "已经返工过"
  ].some(Boolean);
  if (isA) {
    return {
      diagnosisType: "A",
      title: "适合进入认可路径设计阶段",
      summary:
        "你目前已经接近申请、整改或明确启动阶段，不建议再零散准备材料。更适合先做一次认可路径梳理，把认可范围、人员设备、体系运行、申请节奏和评审风险先判断清楚。",
      nextAction: "优先约 30 分钟路径梳理。",
      taskTitle: "CNAS高意向路径梳理",
      taskDescription: "客户适合进入认可路径设计阶段，建议 15 分钟内联系，目标是约 30 分钟路径梳理。",
      taskPriority: FollowTaskPriority.URGENT,
      dueInMinutes: 15,
      ...shared
    };
  }

  const isB = [
    values.currentStage === "已准备建设",
    values.currentStage === "已做体系文件",
    values.startPlan === "3个月内",
    values.readiness === "部分具备"
  ].some(Boolean);
  if (isB) {
    return {
      diagnosisType: "B",
      title: "适合先准备基础条件",
      summary:
        "你目前已经进入准备阶段，但还不一定适合马上提交申请。建议先核对人员、设备、环境、方法标准、体系文件和真实运行记录，避免后期因为基础条件不清楚而返工。",
      nextAction: "先做基础条件核对，补齐人员、设备、环境、方法标准和运行记录。",
      taskTitle: "CNAS基础条件核对",
      taskDescription: "客户适合先准备基础条件，建议 24 小时内发送资料并判断是否可转高意向。",
      taskPriority: FollowTaskPriority.HIGH,
      dueInMinutes: 24 * 60,
      ...shared
    };
  }

  return {
    diagnosisType: "C",
    title: "暂不适合直接启动申请",
    summary:
      "你目前更适合先把认可目标、实验室类型、认可范围、人员设备和投入边界判断清楚，不建议一开始就急着做体系文件或找模板套用。",
    nextAction: "先判断实验室类型、认可目标和投入边界，不要急着做体系文件。",
    taskTitle: "CNAS内容培育跟进",
    taskDescription: "客户暂不适合直接启动申请，建议进入内容培育池，后续推送流程、费用、周期和准备清单等内容。",
    taskPriority: FollowTaskPriority.NORMAL,
    dueInMinutes: 3 * 24 * 60,
    ...shared
  };
}

export function buildCnasExtraData(values: CnasFormValues, result: CnasDiagnosisResult): CnasExtraData {
  return {
    cnas: {
      businessLineName: CNAS_BUSINESS_LINE_NAME,
      businessLineSlug: CNAS_BUSINESS_LINE_SLUG,
      diagnosisType: result.diagnosisType,
      diagnosisTitle: result.title,
      diagnosisSummary: result.summary,
      nextAction: result.nextAction,
      taskTitle: result.taskTitle,
      taskDescription: result.taskDescription,
      intentionLevel: result.intentionLevel,
      intentionTag: result.intentionTag,
      labTypeTag: result.labTypeTag,
      stageTag: result.stageTag,
      riskTag: result.riskTag,
      sourceTag: result.sourceTag,
      sourceLabel: result.sourceLabel,
      sourcePage: values.sourcePage,
      wecomAdded: values.wecomAdded,
      questionnaire: {
        company: values.company,
        contactName: values.contactName,
        phone: values.phone,
        labType: values.labType,
        currentStage: values.currentStage,
        scopeClarity: values.scopeClarity,
        readiness: values.readiness,
        primaryConcern: values.primaryConcern,
        startPlan: values.startPlan,
        wecomAdded: values.wecomAdded,
        note: values.note,
        utmSource: values.utmSource,
        utmMedium: values.utmMedium,
        utmCampaign: values.utmCampaign,
        utmContent: values.utmContent,
        utmTerm: values.utmTerm
      },
      utm: {
        utm_source: values.utmSource,
        utm_medium: values.utmMedium,
        utm_campaign: values.utmCampaign,
        utm_content: values.utmContent,
        utm_term: values.utmTerm
      },
      submittedAt: values.submittedAt
    }
  };
}

export function buildCnasLeadMessage(values: CnasFormValues, result: CnasDiagnosisResult) {
  const noteText = values.note ? `；补充说明：${values.note}` : "";
  return `CNAS路径判断：${values.labType} / ${values.currentStage} / 主要顾虑：${values.primaryConcern} / 初步判断：${result.title}${noteText}`;
}

export function getCnasStructuredTags(result: CnasDiagnosisResult) {
  return [
    { tagName: CNAS_BUSINESS_LINE_NAME, tagGroup: "BUSINESS_LINE" as const },
    { tagName: result.labTypeTag, tagGroup: "CUSTOM" as const },
    { tagName: result.stageTag, tagGroup: "CUSTOM" as const },
    { tagName: result.riskTag, tagGroup: "CUSTOM" as const },
    { tagName: result.intentionTag, tagGroup: "CUSTOM" as const },
    { tagName: result.sourceTag, tagGroup: "CUSTOM" as const }
  ];
}

export function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

export function getCnasResultHref(result: CnasDiagnosisResult) {
  const params = new URLSearchParams({
    diagnosis: result.diagnosisType
  });
  return `${CNAS_SOURCE_PAGE}/result?${params.toString()}`;
}

export function readCnasExtraData(value: Prisma.JsonValue | null | undefined) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const cnas = record.cnas;
  if (!cnas || typeof cnas !== "object" || Array.isArray(cnas)) return null;
  return cnas as NonNullable<CnasExtraData["cnas"]>;
}

export function getCnasDiagnosisPresentation(diagnosisType: string | undefined) {
  if (diagnosisType === "A") {
    return {
      badge: "A 类",
      title: "适合进入认可路径设计阶段",
      summary:
        "建议不要急着先做材料，而是先把认可范围、人员设备、体系运行和申请节奏判断清楚，再进入 30 分钟路径梳理。",
      nextAction: "顾问会优先联系你，进一步确认认可范围、评审风险和启动节奏。"
    };
  }
  if (diagnosisType === "B") {
    return {
      badge: "B 类",
      title: "适合先准备基础条件",
      summary:
        "你已经进入准备阶段，但更适合先核对人员、设备、环境、方法标准、体系文件和运行记录，再决定何时申请。",
      nextAction: "顾问会结合你的准备情况，先帮你判断哪些基础条件需要优先补齐。"
    };
  }
  return {
    badge: "C 类",
    title: "暂不适合直接启动申请",
    summary:
      "你当前更适合先把实验室类型、认可目标、认可范围和投入边界判断清楚，不建议一开始就急着套模板或做体系文件。",
    nextAction: "顾问会根据你的目标，先帮你判断是不是应该先做路径设计或基础条件梳理。"
  };
}
