/*
 * 文件说明：该文件实现 Market Claw AI 测试沙盒的专家视角、阶段映射与结构化结果工具。
 * 功能说明：负责统一管理专家视角定义、页面可选项、提示词拼装输入结构、MOCK 结果类型与训练草稿映射辅助函数。
 *
 * 结构概览：
 *   第一部分：类型定义与选项常量
 *   第二部分：专家视角配置
 *   第三部分：阶段映射与结果规范化辅助
 */
import type { AiCallStatus, AiProvider, LeadStage, MarketClawReplyRiskLevel, MarketClawSendMode } from "@prisma/client";

export type MarketClawSandboxAgentId =
  | "sales_coach"
  | "deal_strategist"
  | "discovery_coach"
  | "proposal_advisor"
  | "risk_boundary_guardian"
  | "knowledge_governance_advisor"
  | "comprehensive_advisor";

export type MarketClawSandboxStage = "NEW" | "INTERESTED" | "QUALIFIED" | "NEGOTIATING" | "NURTURING";

export type MarketClawSandboxKnowledgeType =
  | "FAQ"
  | "STANDARD_REPLY"
  | "PRICE_BOUNDARY"
  | "RISK_REMINDER"
  | "OBJECTION_HANDLING"
  | "CASE"
  | "PROCESS"
  | "INTERNAL_NOTE";

export type MarketClawSandboxKnowledgeSuggestion = {
  shouldSave: boolean;
  type: MarketClawSandboxKnowledgeType;
  title: string;
  reason: string;
};

export type MarketClawSandboxAdvice = {
  agentId: MarketClawSandboxAgentId;
  agentName: string;
  customerQuestion: string;
  businessLineId: string | null;
  summary: string;
  suggestedReply: string;
  wechatShortReply: string;
  followUpQuestions: string[];
  riskLevel: MarketClawReplyRiskLevel;
  sendMode: MarketClawSendMode;
  riskReasons: string[];
  nextActions: string[];
  knowledgeSuggestion: MarketClawSandboxKnowledgeSuggestion;
  internalNotes: string[];
  status: AiCallStatus;
  latencyMs: number | null;
  provider: AiProvider;
  model: string;
  businessLineName: string | null;
  customerStage: MarketClawSandboxStage;
  callStatusText: string;
  rawSummary?: string | null;
};

export type MarketClawSandboxActionState = {
  status: "idle" | "success" | "error";
  message: string | null;
  result: MarketClawSandboxAdvice | null;
  savedTrainingCaseId: string | null;
};

export type MarketClawSandboxAgentProfile = {
  id: MarketClawSandboxAgentId;
  name: string;
  description: string;
  focus: string[];
  outputSections: string[];
  systemPrompt: string;
};

export const marketClawSandboxInitialState: MarketClawSandboxActionState = {
  status: "idle",
  message: null,
  result: null,
  savedTrainingCaseId: null
};

export const marketClawSandboxStageOptions: { value: MarketClawSandboxStage; label: string }[] = [
  { value: "NEW", label: "新线索" },
  { value: "INTERESTED", label: "有兴趣" },
  { value: "QUALIFIED", label: "已初步判断" },
  { value: "NEGOTIATING", label: "沟通推进中" },
  { value: "NURTURING", label: "待培育" }
];

export const marketClawSandboxAgentProfiles: MarketClawSandboxAgentProfile[] = [
  {
    id: "sales_coach",
    name: "销售教练",
    description: "让回复更像真人销售表达，既自然又能推进下一步。",
    focus: ["自然表达", "真实微信语气", "推进下一步", "避免客服腔"],
    outputSections: ["销售回复建议", "表达优化建议", "微信沟通版本", "下一步动作"],
    systemPrompt:
      "你是 Market Claw 的销售教练。你只提供内部建议，不替销售直接回复客户。你的重点是让销售表达自然、有温度、像真人沟通，并且能把对话往下一步推进。"
  },
  {
    id: "deal_strategist",
    name: "成交策略顾问",
    description: "判断客户阶段，给出推进动作和资料/诊断节奏建议。",
    focus: ["阶段判断", "推进动作", "资料节奏", "是否约诊断"],
    outputSections: ["客户阶段判断", "推进建议", "是否适合发资料", "是否适合约诊断", "是否继续培育"],
    systemPrompt:
      "你是 Market Claw 的成交策略顾问。你只提供内部推进建议，帮助销售判断这位客户现在更适合继续解释、发资料、约诊断还是继续培育。"
  },
  {
    id: "discovery_coach",
    name: "客户发现顾问",
    description: "帮助销售补追问，避免一上来报价或承诺。",
    focus: ["追问问题", "需求确认", "信息缺口", "真实意图"],
    outputSections: ["建议追问", "需要补充的信息", "客户真实需求判断", "下一步确认问题"],
    systemPrompt:
      "你是 Market Claw 的客户发现顾问。你要帮助销售先判断客户真实需求和缺失信息，不要急着报价，不要急着承诺。"
  },
  {
    id: "proposal_advisor",
    name: "方案表达顾问",
    description: "帮助销售把价值讲清楚，用人话解释产品或服务。",
    focus: ["价值表达", "专业解释", "口语化版本", "降低理解门槛"],
    outputSections: ["专业说明版", "简短口语版", "老板能听懂的版本", "价值表达建议"],
    systemPrompt:
      "你是 Market Claw 的方案表达顾问。你要把复杂业务讲成人话，既专业又易懂，适合销售在微信、语音转文字或现场沟通中参考。"
  },
  {
    id: "risk_boundary_guardian",
    name: "风险边界顾问",
    description: "识别价格、效果、周期、责任、承诺等高风险边界。",
    focus: ["风险识别", "边界提醒", "禁止承诺", "替代表达"],
    outputSections: ["风险等级建议", "不能说的话", "需要确认的边界", "替代表达", "是否仅内部建议"],
    systemPrompt:
      "你是 Market Claw 的风险边界顾问。你必须优先保护系统边界，不能降低高风险或 BLOCKED 风险，不能给出绝对化承诺，不能绕过人工确认。"
  },
  {
    id: "knowledge_governance_advisor",
    name: "知识治理顾问",
    description: "判断客户问题是否值得沉淀为知识，以及适合沉淀成什么。",
    focus: ["知识沉淀", "标题建议", "分类建议", "补资料建议"],
    outputSections: ["是否建议沉淀", "适合沉淀类型", "建议知识标题", "建议知识分类", "是否需要补充资料"],
    systemPrompt:
      "你是 Market Claw 的知识治理顾问。你要判断这次问题和建议是否值得进入训练或知识治理流程，但不能直接写入正式知识库。"
  },
  {
    id: "comprehensive_advisor",
    name: "综合建议",
    description: "综合六个专家视角，输出统一的销售建议、风险提醒和知识沉淀建议。",
    focus: ["统一建议", "多视角综合", "风险边界", "下一步动作"],
    outputSections: ["综合摘要", "推荐回复", "建议追问", "风险提醒", "下一步动作", "知识沉淀建议"],
    systemPrompt:
      "你是 Market Claw 的综合顾问，需要综合销售教练、成交策略顾问、客户发现顾问、方案表达顾问、风险边界顾问和知识治理顾问的角度，输出统一建议。"
  }
];

const marketClawSandboxAgentProfileMap = new Map(
  marketClawSandboxAgentProfiles.map((item) => [item.id, item])
);

export function getMarketClawSandboxAgentProfile(agentId: string | null | undefined) {
  return marketClawSandboxAgentProfileMap.get((agentId ?? "") as MarketClawSandboxAgentId) ?? marketClawSandboxAgentProfiles[0];
}

export function mapSandboxStageToLeadStage(stage: MarketClawSandboxStage): LeadStage {
  switch (stage) {
    case "INTERESTED":
      return "CONTACTED";
    case "QUALIFIED":
      return "DIAGNOSED";
    case "NEGOTIATING":
      return "QUOTED";
    case "NURTURING":
      return "TO_REACTIVATE";
    case "NEW":
    default:
      return "NEW";
  }
}

export function getSandboxStageLabel(stage: MarketClawSandboxStage) {
  return marketClawSandboxStageOptions.find((item) => item.value === stage)?.label ?? stage;
}

export function parseSandboxStage(value: string | null | undefined): MarketClawSandboxStage {
  return marketClawSandboxStageOptions.some((item) => item.value === value) ? (value as MarketClawSandboxStage) : "NEW";
}

export function parseSandboxAgentId(value: string | null | undefined): MarketClawSandboxAgentId {
  return marketClawSandboxAgentProfiles.some((item) => item.id === value)
    ? (value as MarketClawSandboxAgentId)
    : "sales_coach";
}
