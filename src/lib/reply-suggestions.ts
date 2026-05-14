/*
 * 文件说明：该文件实现 V1.5 智能跟进助手的规则型建议生成。
 * 功能说明：根据客户类型、阶段、需求、策略库、资料包和客户问题，生成三种风格的建议回复与智能标签建议。
 *
 * 结构概览：
 *   第一部分：导入依赖与基础类型
 *   第二部分：问题分类、标签主题与展示文案
 *   第三部分：按客户类型配置回答方向
 *   第四部分：回复建议与标签建议生成
 *   第五部分：建议记录查询与 Json 解析
 */
import type {
  CustomerType,
  CustomerTypeStrategy,
  Lead,
  LeadStage,
  Material,
  NeedType,
  ReplySuggestion,
  ReplySuggestionStyle,
  TagGroup
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type QuestionType = "PRICE" | "COOPERATION" | "CASE" | "DELIVERY" | "SYSTEM_COMPARE" | "UNCLEAR";

export type TagSuggestionTopic =
  | "PRICE"
  | "COOPERATION"
  | "CASE"
  | "DELIVERY"
  | "GEO_AI"
  | "MEMBERSHIP"
  | "EVENT_RESOURCE"
  | "TRAINING"
  | "AFTERMARKET"
  | "UNCLEAR";

export type TagSuggestionConfidence = "LOW" | "MEDIUM" | "HIGH";

export type SuggestedTagGroup = "客户类型标签" | "需求标签" | "阶段标签" | "业务标签" | "风险标签";

export type SuggestedTag = {
  tagName: string;
  tagGroup: SuggestedTagGroup;
  reason: string;
  confidence: TagSuggestionConfidence;
};

type LeadContext = Pick<Lead, "customerType" | "stage" | "name" | "needType">;

type StrategyContext = Pick<
  CustomerTypeStrategy,
  "painPoints" | "firstMaterials" | "recommendedNextAction" | "welcomeScript" | "day3Script" | "day7Script" | "day15Script"
> | null;

type MaterialContext = Pick<Material, "id" | "title" | "description" | "customerType">;

type CustomerTypeConfig = {
  materialTitles: Record<QuestionType, string[]>;
  nextActions: Record<QuestionType, string>;
  answers: Record<QuestionType, string>;
  warnings: Record<QuestionType, string>;
};

export type GeneratedReplySuggestion = {
  style: ReplySuggestionStyle;
  suggestionText: string;
  recommendedMaterialIds: string[];
  recommendedNextAction: string;
  warning: string;
  questionType: QuestionType;
  suggestedTags: SuggestedTag[];
};

const questionKeywords: { type: QuestionType; keywords: string[] }[] = [
  { type: "PRICE", keywords: ["多少钱", "贵不贵", "费用", "价格", "报价"] },
  { type: "COOPERATION", keywords: ["合作", "加盟", "代理", "政策", "利润"] },
  { type: "CASE", keywords: ["案例", "效果", "样板", "落地"] },
  { type: "DELIVERY", keywords: ["交付", "安装", "售后", "周期", "能不能做好"] },
  { type: "SYSTEM_COMPARE", keywords: ["crm", "scrm", "企业微信", "代运营", "区别"] }
];

const tagTopicKeywords: { type: TagSuggestionTopic; keywords: string[] }[] = [
  { type: "PRICE", keywords: ["多少钱", "价格", "费用", "报价", "贵不贵", "怎么收费"] },
  { type: "COOPERATION", keywords: ["合作", "加盟", "代理", "政策", "利润", "区域", "扶持"] },
  { type: "CASE", keywords: ["案例", "效果", "样板", "落地", "有没有做过"] },
  { type: "DELIVERY", keywords: ["交付", "安装", "售后", "周期", "服务", "能不能做好", "环保"] },
  { type: "GEO_AI", keywords: ["geo", "ai", "ai搜索", "推荐", "收录", "关键词", "搜索", "seo"] },
  { type: "MEMBERSHIP", keywords: ["会员", "权益", "增信", "背书", "整木网", "联盟", "加入"] },
  { type: "EVENT_RESOURCE", keywords: ["乌镇", "活动", "峰会", "榜单", "白皮书", "露出", "奖项", "资源"] },
  { type: "TRAINING", keywords: ["课程", "培训", "学习", "报名", "课纲", "老师", "训练营"] },
  { type: "AFTERMARKET", keywords: ["一清一护", "后市场", "养护", "清洁", "门店合作", "上门服务"] }
];

const styleOrder: ReplySuggestionStyle[] = ["DIRECT", "WARM", "PROFESSIONAL"];

export const replySuggestionStyleLabels: Record<ReplySuggestionStyle, string> = {
  DIRECT: "直接型",
  WARM: "温和型",
  PROFESSIONAL: "专业型"
};

export const questionTypeLabels: Record<QuestionType, string> = {
  PRICE: "价格类",
  COOPERATION: "合作类",
  CASE: "案例类",
  DELIVERY: "交付类",
  SYSTEM_COMPARE: "系统对比类",
  UNCLEAR: "不明确类"
};

export const tagTopicLabels: Record<TagSuggestionTopic, string> = {
  PRICE: "价格类",
  COOPERATION: "合作类",
  CASE: "案例类",
  DELIVERY: "交付类",
  GEO_AI: "GEO／AI 推广类",
  MEMBERSHIP: "会员服务类",
  EVENT_RESOURCE: "活动／乌镇资源类",
  TRAINING: "培训课程类",
  AFTERMARKET: "一清一护后市场类",
  UNCLEAR: "不明确类"
};

export const suggestedTagConfidenceLabels: Record<TagSuggestionConfidence, string> = {
  LOW: "低",
  MEDIUM: "中",
  HIGH: "高"
};

const confidenceRank: Record<TagSuggestionConfidence, number> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3
};

function normalizeQuestion(question: string) {
  return question.trim().toLowerCase();
}

function matchesAnyKeyword(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword.toLowerCase()));
}

export function detectQuestionType(question: string): QuestionType {
  const normalized = normalizeQuestion(question);
  for (const item of questionKeywords) {
    if (matchesAnyKeyword(normalized, item.keywords)) {
      return item.type;
    }
  }
  return "UNCLEAR";
}

export function detectTagSuggestionTopic(question: string): TagSuggestionTopic {
  const normalized = normalizeQuestion(question);
  for (const item of tagTopicKeywords) {
    if (matchesAnyKeyword(normalized, item.keywords)) {
      return item.type;
    }
  }
  return "UNCLEAR";
}

function truncateText(value: string, maxLength = 150) {
  return value.length <= maxLength ? value : `${value.slice(0, Math.max(0, maxLength - 3))}...`;
}

function pickMaterials(materials: MaterialContext[], strategy: StrategyContext, preferredTitles: string[], fallbackCount = 2) {
  const picked: MaterialContext[] = [];
  const seen = new Set<string>();

  const pushMaterial = (material?: MaterialContext) => {
    if (!material || seen.has(material.id)) return;
    seen.add(material.id);
    picked.push(material);
  };

  for (const title of preferredTitles) {
    pushMaterial(materials.find((material) => material.title.includes(title)));
  }

  for (const title of strategy?.firstMaterials ?? []) {
    pushMaterial(materials.find((material) => material.title.includes(title)));
  }

  for (const material of materials) {
    if (picked.length >= fallbackCount) break;
    pushMaterial(material);
  }

  return picked.slice(0, Math.max(fallbackCount, preferredTitles.length || 1));
}

function getStageHint(stage: LeadStage) {
  switch (stage) {
    case "NEW":
      return "先把客户当前情况问清楚";
    case "MATERIAL_SENT":
      return "围绕已发资料继续追问";
    case "CONTACTED":
      return "推动客户给出更具体信息";
    case "DIAGNOSED":
      return "把问题收口到方案判断";
    case "QUOTED":
      return "围绕报价顾虑继续推进";
    case "PENDING_DEAL":
      return "聚焦临门一脚的顾虑";
    case "TO_REACTIVATE":
      return "先轻量激活再继续推进";
    case "DEAL_DONE":
      return "适合转介绍或复盘延伸";
    default:
      return "先确认客户真实顾虑";
  }
}

function buildDefaultConfig(): CustomerTypeConfig {
  return {
    materialTitles: {
      PRICE: [],
      COOPERATION: [],
      CASE: [],
      DELIVERY: [],
      SYSTEM_COMPARE: [],
      UNCLEAR: []
    },
    nextActions: {
      PRICE: "先确认客户真实需求和当前阶段",
      COOPERATION: "先确认对方更关心哪一块",
      CASE: "先判断对方想看什么案例",
      DELIVERY: "先确认对方最担心的交付点",
      SYSTEM_COMPARE: "先判断对方到底在比较什么",
      UNCLEAR: "先追问客户当前情况"
    },
    answers: {
      PRICE: "这类问题先结合实际情况判断，会比直接给结论更准。",
      COOPERATION: "先把对方当前需求摸清楚，再谈合作会更顺。",
      CASE: "可以先给对方看对应案例，再继续收口问题。",
      DELIVERY: "交付类问题要结合实际情况回答，先不要说满。",
      SYSTEM_COMPARE: "先讲清业务场景差异，比先比工具更有效。",
      UNCLEAR: "先追问客户背景，建议才会更像真人销售。"
    },
    warnings: {
      PRICE: "不要直接报死价。",
      COOPERATION: "不要先承诺合作结果。",
      CASE: "不要只发资料不追问。",
      DELIVERY: "不要提前做绝对承诺。",
      SYSTEM_COMPARE: "不要夸大系统能力。",
      UNCLEAR: "先追问，再判断。"
    }
  };
}

function getCustomerTypeConfig(customerType: CustomerType): CustomerTypeConfig {
  if (customerType === "OWNER_CLIENT") {
    return {
      materialTitles: {
        PRICE: ["整木定制避坑清单", "真实案例图册"],
        COOPERATION: ["真实案例图册", "交付流程说明"],
        CASE: ["真实案例图册", "整木定制避坑清单"],
        DELIVERY: ["交付流程说明", "环保与售后说明"],
        SYSTEM_COMPARE: ["真实案例图册", "环保与售后说明"],
        UNCLEAR: ["真实案例图册", "交付流程说明"]
      },
      nextActions: {
        PRICE: "了解房屋面积、装修阶段和预算区间",
        COOPERATION: "确认客户更关心方案、价格还是交付",
        CASE: "请客户发喜欢的风格或户型",
        DELIVERY: "确认装修进度并预约初步方案",
        SYSTEM_COMPARE: "确认客户是在比案例、报价还是交付",
        UNCLEAR: "先了解房屋情况和装修阶段"
      },
      answers: {
        PRICE: "价格会跟面积、材质和工艺做法一起看，现在不适合先报死价。",
        COOPERATION: "如果您现在更关心家里怎么做，我们先按实际需求把方向聊清楚。",
        CASE: "案例和落地效果这块可以先给您看真实项目，不先空讲。",
        DELIVERY: "交付和安装关键看前期深化、工艺和现场衔接，不只是看周期。",
        SYSTEM_COMPARE: "这类系统的价值不在记客户名字，而在帮销售把资料、跟进和节点串起来。",
        UNCLEAR: "这个问题先不用一句说满，先把您现在的情况对齐会更准。"
      },
      warnings: {
        PRICE: "不要先报死价，先确认面积、材质和阶段。",
        COOPERATION: "不要把业主沟通带成招商口径。",
        CASE: "不要只发图，记得追问偏好。",
        DELIVERY: "不要承诺绝对周期，先确认现场条件。",
        SYSTEM_COMPARE: "不要把系统说成自动成交工具。",
        UNCLEAR: "不要一次说太满，先追问。"
      }
    };
  }

  if (customerType === "DEALER_CLIENT") {
    return {
      materialTitles: {
        PRICE: ["合作政策说明", "招商手册"],
        COOPERATION: ["招商手册", "合作政策说明", "样板门店案例"],
        CASE: ["样板门店案例", "产品体系说明"],
        DELIVERY: ["产品体系说明", "样板门店案例"],
        SYSTEM_COMPARE: ["合作政策说明", "招商手册"],
        UNCLEAR: ["招商手册", "产品体系说明"]
      },
      nextActions: {
        PRICE: "了解城市、门店情况和经营品类",
        COOPERATION: "安排招商负责人沟通或到厂考察",
        CASE: "确认客户更想看样板门店还是产品体系",
        DELIVERY: "确认门店进度和总部支持需求",
        SYSTEM_COMPARE: "判断客户更关心政策、利润还是总部支持",
        UNCLEAR: "先问清所在城市和门店现状"
      },
      answers: {
        PRICE: "经销合作不只看一个价格，通常要结合城市、门店基础和合作方式一起判断。",
        COOPERATION: "如果您是在看合作，这边重点会先把利润、政策、区域保护和总部支持讲清楚。",
        CASE: "样板门店和实际落地案例可以先给您看，这样判断会更直观。",
        DELIVERY: "门店落地支持关键看样板、培训和总部协同，不只是发一份政策。",
        SYSTEM_COMPARE: "这不只是个 CRM 或群发工具，重点是把招商线索、资料和推进动作跑顺。",
        UNCLEAR: "先把您现在的门店阶段和合作目标摸清楚，后面建议才不会跑偏。"
      },
      warnings: {
        PRICE: "不要只聊低价，先讲清合作边界。",
        COOPERATION: "不要承诺区域或利润，先确认实际条件。",
        CASE: "不要只讲品牌，要落到门店和样板。",
        DELIVERY: "不要夸大总部支持，按现有能力说。",
        SYSTEM_COMPARE: "不要把系统说成代运营替代品。",
        UNCLEAR: "先问城市、门店和经营品类。"
      }
    };
  }

  if (customerType === "DESIGNER_CLIENT") {
    return {
      materialTitles: {
        PRICE: ["材料样册", "工艺节点说明"],
        COOPERATION: ["设计师合作机制", "项目配合流程"],
        CASE: ["高定案例图册", "工艺节点说明"],
        DELIVERY: ["工艺节点说明", "项目配合流程"],
        SYSTEM_COMPARE: ["设计师合作机制", "高定案例图册"],
        UNCLEAR: ["高定案例图册", "材料样册"]
      },
      nextActions: {
        PRICE: "了解项目类型、预算和落地要求",
        COOPERATION: "确认是否需要项目报价配合",
        CASE: "请设计师发项目风格方向或图纸",
        DELIVERY: "确认是否需要工艺节点和项目配合",
        SYSTEM_COMPARE: "判断对方更关心案例、工艺还是配合效率",
        UNCLEAR: "先了解当前项目类型和客户层级"
      },
      answers: {
        PRICE: "设计项目这块报价通常要结合体量、材料和工艺节点，不适合只看一个数字。",
        COOPERATION: "如果是合作，重点会先把案例质感、工艺落地和项目配合方式对齐。",
        CASE: "案例和落地细节这边可以先给您看真实高定项目，不先空讲概念。",
        DELIVERY: "设计落地关键在节点、材料和项目配合节奏，不只是后端安装。",
        SYSTEM_COMPARE: "这不是冷冰冰的客户表，更像帮销售把资料、节点和下一步动作理顺。",
        UNCLEAR: "先把您当前在做什么类型项目问清楚，建议会更贴近。"
      },
      warnings: {
        PRICE: "不要脱离项目体量直接报价。",
        COOPERATION: "不要把设计师沟通带成招商口径。",
        CASE: "不要只发图，记得追问项目类型。",
        DELIVERY: "不要直接承诺所有工艺都能做，先看图纸。",
        SYSTEM_COMPARE: "不要把系统说成自动化设计工具。",
        UNCLEAR: "先问项目类型和预算。"
      }
    };
  }

  if (customerType === "FACTORY_CLIENT") {
    return {
      materialTitles: {
        PRICE: ["业务增长中台合作建议", "整木企业增长诊断表"],
        COOPERATION: ["业务增长中台合作建议", "品牌增信方案"],
        CASE: ["品牌增信方案", "业务增长中台合作建议"],
        DELIVERY: ["企业微信承接自查表", "整木企业增长诊断表"],
        SYSTEM_COMPARE: ["业务增长中台合作建议", "企业微信承接自查表", "整木企业增长诊断表"],
        UNCLEAR: ["整木企业增长诊断表", "企业微信承接自查表"]
      },
      nextActions: {
        PRICE: "判断当前卡在获客、承接还是成交",
        COOPERATION: "安排一次深度诊断沟通",
        CASE: "确认更想看增长路径还是承接流程",
        DELIVERY: "确认当前企业微信承接和销售协作问题",
        SYSTEM_COMPARE: "先判断是 CRM、SCRM 还是承接流程的问题",
        UNCLEAR: "先问现在最卡的是线索、承接还是老板看板"
      },
      answers: {
        PRICE: "这类合作费用通常跟企业当前卡点、账号数量和服务深度一起看，不适合先报一个死价。",
        COOPERATION: "如果要合作，我们更看重先把获客、承接、跟进和老板看板这条线跑清楚。",
        CASE: "案例可以给您看，但更重要的是先判断您现在卡在获客、承接还是成交。",
        DELIVERY: "这类系统能不能用起来，关键在企微承接和销售跟进有没有接上，不只是把后台搭出来。",
        SYSTEM_COMPARE: "它不是 AI 客服，也不是单纯 CRM，更像把客户来源、承接、跟进和老板看板串起来。",
        UNCLEAR: "这个问题可以先不急着下结论，先把您现在最卡的环节摸清楚。"
      },
      warnings: {
        PRICE: "不要承诺固定报价，先做现状判断。",
        COOPERATION: "不要把合作说成一定有效。",
        CASE: "不要只讲案例，要回到客户当前卡点。",
        DELIVERY: "不要把系统说成上来就自动跑通。",
        SYSTEM_COMPARE: "不要说成 AI 客服或自动回复系统。",
        UNCLEAR: "先追问，再收口。"
      }
    };
  }

  return buildDefaultConfig();
}

function getStyleWrap(style: ReplySuggestionStyle, answer: string, nextQuestion: string, stageHint: string) {
  if (style === "DIRECT") {
    return `${answer} 您先说一下${nextQuestion}，我按这个方向给您发更贴近的资料。`;
  }

  if (style === "WARM") {
    return `${answer}${stageHint}。您方便先说一下${nextQuestion}吗？我把更贴近的资料一并发您。`;
  }

  return `${answer}${stageHint}。建议先确认${nextQuestion}，我再把对应资料和下一步建议发您。`;
}

function buildNextQuestion(customerType: CustomerType, questionType: QuestionType) {
  if (customerType === "OWNER_CLIENT") {
    if (questionType === "PRICE") return "房屋面积、装修阶段和预算区间";
    if (questionType === "CASE") return "喜欢的风格或户型";
    if (questionType === "DELIVERY") return "当前装修进度和计划交付时间";
    return "您现在最想先解决的是效果、价格还是交付";
  }

  if (customerType === "DEALER_CLIENT") {
    if (questionType === "COOPERATION") return "所在城市、门店情况和经营品类";
    if (questionType === "PRICE") return "城市和当前门店基础";
    return "您更想先看政策、利润还是样板门店";
  }

  if (customerType === "DESIGNER_CLIENT") {
    if (questionType === "CASE") return "项目风格方向或图纸";
    if (questionType === "PRICE") return "项目体量、预算和落地要求";
    return "您当前在做哪类项目";
  }

  if (customerType === "FACTORY_CLIENT") {
    if (questionType === "SYSTEM_COMPARE") return "现在更卡在线索承接、销售跟进还是老板看板";
    if (questionType === "PRICE") return "当前主要卡点和服务深度";
    return "您现在最卡在获客、承接还是成交";
  }

  return "您现在最关心的点";
}

function appendStageHint(reason: string, stage: LeadStage) {
  if (stage === "QUOTED") {
    return `${reason} 当前阶段已到报价相关沟通，更适合继续收口报价顾虑。`;
  }
  if (stage === "TO_REACTIVATE") {
    return `${reason} 当前客户处于待激活阶段，建议先轻量确认真实需求。`;
  }
  return reason;
}

function createSuggestedTagIndexKey(tagName: string, tagGroup: SuggestedTagGroup) {
  return `${tagGroup}::${tagName}`;
}

function upsertSuggestedTag(
  store: Map<string, SuggestedTag>,
  tag: SuggestedTag,
  stage: LeadStage
) {
  const key = createSuggestedTagIndexKey(tag.tagName, tag.tagGroup);
  const nextValue = {
    ...tag,
    reason: appendStageHint(tag.reason, stage)
  };
  const current = store.get(key);

  if (!current || confidenceRank[nextValue.confidence] > confidenceRank[current.confidence]) {
    store.set(key, nextValue);
  }
}

function buildSuggestedTags(lead: LeadContext, customerQuestion: string): SuggestedTag[] {
  const topic = detectTagSuggestionTopic(customerQuestion);
  const tags = new Map<string, SuggestedTag>();

  const addTag = (
    tagName: string,
    tagGroup: SuggestedTagGroup,
    reason: string,
    confidence: TagSuggestionConfidence
  ) => {
    upsertSuggestedTag(
      tags,
      {
        tagName,
        tagGroup,
        reason,
        confidence
      },
      lead.stage
    );
  };

  switch (topic) {
    case "PRICE":
      addTag("价格关注", "需求标签", "客户问题中出现价格、费用或报价相关表达，需要优先确认预算和报价节奏。", "HIGH");
      addTag("报价待跟进", "阶段标签", "客户已经开始关注价格，适合进入报价前沟通或报价后跟进。", lead.stage === "QUOTED" ? "HIGH" : "MEDIUM");
      break;
    case "COOPERATION":
      addTag("合作意向", "需求标签", "客户正在了解合作方向，后续需要继续判断合作深度。", "HIGH");
      addTag("招商意向", "业务标签", "客户问题涉及加盟、代理或区域合作，适合按招商路径推进。", "HIGH");
      addTag("政策关注", "业务标签", "客户正在关注政策、利润或扶持条件，建议补充政策资料。", "MEDIUM");
      break;
    case "CASE":
      addTag("案例关注", "需求标签", "客户想通过案例、效果或样板建立判断依据，适合优先发案例资料。", "HIGH");
      addTag("信任建立中", "阶段标签", "客户还在通过案例判断是否继续沟通，适合继续建立信任。", "MEDIUM");
      break;
    case "DELIVERY":
      addTag("交付关注", "需求标签", "客户关注交付、安装或周期，需要用流程和节点回应。", "HIGH");
      addTag("售后关注", "需求标签", "客户问题涉及售后或服务保障，建议补充售后说明。", "MEDIUM");
      addTag("风险顾虑", "风险标签", "客户对落地风险仍有顾虑，需要销售谨慎承诺。", "MEDIUM");
      break;
    case "GEO_AI":
      addTag("GEO意向", "业务标签", "客户正在关注 GEO、搜索可见性或 AI 搜索入口，适合引导做一次诊断。", "HIGH");
      addTag("AI推广关注", "需求标签", "客户在问 AI 推广或推荐曝光，适合补充推广思路说明。", "HIGH");
      addTag("待诊断", "阶段标签", "该类问题更适合先做现状诊断，再决定下一步合作方向。", "MEDIUM");
      break;
    case "MEMBERSHIP":
      addTag("会员意向", "业务标签", "客户正在了解会员或加入方式，适合补充会员服务说明。", "HIGH");
      addTag("品牌增信关注", "需求标签", "客户关心背书、增信或联盟价值，适合发送增信相关资料。", "MEDIUM");
      addTag("联盟合作意向", "业务标签", "客户对联盟或加入合作有兴趣，适合继续判断合作边界。", "MEDIUM");
      break;
    case "EVENT_RESOURCE":
      addTag("活动资源意向", "业务标签", "客户对活动资源和行业露出有兴趣，适合补充活动权益说明。", "HIGH");
      addTag("乌镇资源关注", "需求标签", "客户明确提到乌镇或峰会资源，适合补充对应资源内容。", "HIGH");
      addTag("品牌露出关注", "需求标签", "客户正在评估榜单、白皮书或奖项露出的价值。", "MEDIUM");
      break;
    case "TRAINING":
      addTag("培训意向", "业务标签", "客户正在了解培训或训练营，适合发送课程介绍。", "HIGH");
      addTag("课程报名关注", "需求标签", "客户已经在问报名、课纲或老师信息，适合继续推进报名沟通。", "MEDIUM");
      break;
    case "AFTERMARKET":
      addTag("后市场意向", "业务标签", "客户正在关注后市场服务方向，适合补充项目说明。", "HIGH");
      addTag("一清一护关注", "需求标签", "客户明确提到一清一护或养护服务，适合发送对应说明。", "HIGH");
      addTag("门店合作意向", "需求标签", "客户问题涉及门店合作或上门服务，适合继续判断合作条件。", "MEDIUM");
      break;
    default:
      addTag("待进一步判断", "阶段标签", "客户问题方向还不够明确，建议先继续追问最关心的点。", "HIGH");
      addTag("需补充需求", "阶段标签", "目前信息不足，适合先补充客户背景和真实目标。", "MEDIUM");
      break;
  }

  switch (lead.customerType) {
    case "OWNER_CLIENT":
      addTag("业主客户", "客户类型标签", "当前客户类型为业主客户，后续建议围绕效果、价格和交付推进。", "HIGH");
      addTag("效果关注", "需求标签", "业主客户普遍会关注案例效果和落地呈现，适合优先补充案例。", "MEDIUM");
      addTag("交付关注", "需求标签", "业主客户通常会问交付与安装保障，建议结合节点继续解释。", "MEDIUM");
      addTag("售后关注", "需求标签", "业主路径需要强调售后与安心感，适合提前铺垫保障说明。", "MEDIUM");
      break;
    case "DEALER_CLIENT":
      addTag("经销商客户", "客户类型标签", "当前客户类型为经销商客户，建议按招商与合作判断路径推进。", "HIGH");
      addTag("合作意向", "需求标签", "经销商路径核心是合作判断，适合继续收口合作条件。", "MEDIUM");
      addTag("招商意向", "业务标签", "经销商客户适合进入招商沟通或到厂考察路径。", "HIGH");
      addTag("政策关注", "业务标签", "经销商客户通常会重点看政策、利润和支持体系。", "MEDIUM");
      break;
    case "DESIGNER_CLIENT":
      addTag("设计师客户", "客户类型标签", "当前客户类型为设计师客户，后续建议围绕案例、工艺和项目配合沟通。", "HIGH");
      addTag("案例关注", "需求标签", "设计师更容易通过案例和质感建立兴趣。", "MEDIUM");
      addTag("工艺关注", "需求标签", "设计师路径需要更早补充工艺与材料节点。", "MEDIUM");
      addTag("项目合作意向", "业务标签", "设计师客户更适合按项目合作入口继续推进。", "MEDIUM");
      break;
    case "FACTORY_CLIENT":
      addTag("工厂客户", "客户类型标签", "当前客户类型为工厂客户，更适合围绕增长系统与承接问题推进。", "HIGH");
      addTag("增长诊断意向", "业务标签", "工厂客户更适合先做增长诊断，判断卡点所在。", "HIGH");
      addTag("GEO意向", "业务标签", "工厂客户常关注推广和搜索可见性，适合引导到 GEO 诊断。", "MEDIUM");
      addTag("品牌增信关注", "需求标签", "工厂客户通常会关注品牌信任与增信路径。", "MEDIUM");
      addTag("业务增长中台意向", "业务标签", "工厂客户与增长中台合作路径高度相关，适合继续做系统化判断。", "MEDIUM");
      break;
    default:
      break;
  }

  switch (lead.needType) {
    case "ASK_PRICE":
      addTag("价格关注", "需求标签", "当前需求类型已指向价格咨询，适合继续收口预算与报价节奏。", "MEDIUM");
      addTag("报价待跟进", "阶段标签", "当前需求与报价相关，适合继续推进报价前后动作。", "MEDIUM");
      break;
    case "COOPERATION":
    case "INVESTMENT_JOIN":
      addTag("合作意向", "需求标签", "当前需求类型已指向合作或招商，适合继续判断合作条件。", "MEDIUM");
      addTag("招商意向", "业务标签", "当前需求与招商路径匹配，适合继续推进合作判断。", "MEDIUM");
      break;
    case "GROWTH_SYSTEM":
      addTag("业务增长中台意向", "业务标签", "当前需求类型已指向增长系统，适合继续安排诊断或方案沟通。", "HIGH");
      addTag("待诊断", "阶段标签", "增长系统类需求更适合先做现状诊断。", "MEDIUM");
      break;
    case "AFTER_SALES":
      addTag("售后关注", "需求标签", "当前需求类型已指向售后，适合继续确认服务节点与保障方式。", "MEDIUM");
      break;
    case "GET_MATERIAL":
      addTag("案例关注", "需求标签", "当前需求类型是资料领取，适合先判断客户更想看哪类资料。", "LOW");
      break;
    default:
      break;
  }

  return [...tags.values()].sort((left, right) => {
    const confidenceDiff = confidenceRank[right.confidence] - confidenceRank[left.confidence];
    if (confidenceDiff !== 0) return confidenceDiff;
    if (left.tagGroup !== right.tagGroup) return left.tagGroup.localeCompare(right.tagGroup, "zh-CN");
    return left.tagName.localeCompare(right.tagName, "zh-CN");
  });
}

export function generateReplySuggestions(input: {
  lead: LeadContext;
  strategy: StrategyContext;
  materials: MaterialContext[];
  customerQuestion: string;
}): GeneratedReplySuggestion[] {
  const questionType = detectQuestionType(input.customerQuestion);
  const customerTypeConfig = getCustomerTypeConfig(input.lead.customerType);
  const materialMatches = pickMaterials(input.materials, input.strategy, customerTypeConfig.materialTitles[questionType], 2);
  const stageHint = getStageHint(input.lead.stage);
  const nextQuestion = buildNextQuestion(input.lead.customerType, questionType);
  const recommendedNextAction =
    customerTypeConfig.nextActions[questionType] || input.strategy?.recommendedNextAction || "继续确认客户真实需求";
  const answer = customerTypeConfig.answers[questionType];
  const warning = customerTypeConfig.warnings[questionType];
  const suggestedTags = buildSuggestedTags(input.lead, input.customerQuestion);

  return styleOrder.map((style) => ({
    style,
    questionType,
    suggestionText: truncateText(getStyleWrap(style, answer, nextQuestion, stageHint)),
    recommendedMaterialIds: materialMatches.map((material) => material.id),
    recommendedNextAction,
    warning,
    suggestedTags
  }));
}

export async function getLatestReplySuggestionBatch(tenantId: string, leadId: string, userId: string) {
  const latest = await prisma.replySuggestion.findFirst({
    where: { tenantId, leadId, userId },
    orderBy: { createdAt: "desc" }
  });

  if (!latest) return [];

  const suggestions = await prisma.replySuggestion.findMany({
    where: {
      tenantId,
      leadId,
      userId,
      createdAt: latest.createdAt
    }
  });

  return suggestions.sort((left, right) => styleOrder.indexOf(left.style) - styleOrder.indexOf(right.style));
}

export function parseRecommendedMaterialIds(value: ReplySuggestion["recommendedMaterialIds"]) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

export function parseSuggestedTags(value: ReplySuggestion["suggestedTags"]): SuggestedTag[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];

    const tagName = typeof item.tagName === "string" ? item.tagName : null;
    const tagGroup = typeof item.tagGroup === "string" ? item.tagGroup : null;
    const reason = typeof item.reason === "string" ? item.reason : null;
    const confidence = typeof item.confidence === "string" ? item.confidence : null;

    if (!tagName || !reason || !tagGroup || !confidence) return [];
    if (!["客户类型标签", "需求标签", "阶段标签", "业务标签", "风险标签"].includes(tagGroup)) return [];
    if (!["LOW", "MEDIUM", "HIGH"].includes(confidence)) return [];

    return [
      {
        tagName,
        tagGroup: tagGroup as SuggestedTagGroup,
        reason,
        confidence: confidence as TagSuggestionConfidence
      }
    ];
  });
}

export function mapSuggestedTagGroupToLeadTagGroup(group: SuggestedTagGroup): TagGroup {
  switch (group) {
    case "客户类型标签":
      return "CUSTOMER_TYPE";
    case "需求标签":
      return "NEED";
    case "阶段标签":
      return "STAGE";
    default:
      return "CUSTOM";
  }
}

export function getSuggestedTagKey(tag: Pick<SuggestedTag, "tagName" | "tagGroup">) {
  return createSuggestedTagIndexKey(tag.tagName, tag.tagGroup);
}
