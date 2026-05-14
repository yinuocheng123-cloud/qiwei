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
  BusinessLine,
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
import {
  matchBusinessLinesForQuestion,
  parseBusinessLineIdList,
  parseBusinessLineRecommendedTags,
  type BusinessLineRecord
} from "@/lib/business-lines";
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
type BusinessLineContext = Pick<
  BusinessLine,
  | "id"
  | "name"
  | "slug"
  | "description"
  | "status"
  | "priority"
  | "targetCustomerTypes"
  | "recommendedTagNames"
  | "recommendedMaterialIds"
  | "recommendedTaskTemplateIds"
  | "defaultNextAction"
  | "notes"
>;

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

function normalizeSuggestedTagGroup(value: string): SuggestedTagGroup | null {
  return ["客户类型标签", "需求标签", "阶段标签", "业务标签", "风险标签"].includes(value)
    ? (value as SuggestedTagGroup)
    : null;
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

  if (customerType === "PLATFORM_FACTORY_OWNER") {
    return {
      materialTitles: {
        PRICE: ["整木企业增长诊断表", "企业微信业务增长中台说明"],
        COOPERATION: ["整木企业品牌增信方案", "整木高定产业增长联盟说明"],
        CASE: ["整木企业品牌增信方案", "整木企业增长诊断表"],
        DELIVERY: ["企业微信业务增长中台说明", "整木企业增长诊断表"],
        SYSTEM_COMPARE: ["企业微信业务增长中台说明", "GEO 推广服务说明"],
        UNCLEAR: ["整木企业增长诊断表", "整木企业品牌增信方案"]
      },
      nextActions: {
        PRICE: "先判断企业当前卡在获客、承接还是成交",
        COOPERATION: "安排一次增长诊断沟通",
        CASE: "确认更想看品牌增信还是增长协同案例",
        DELIVERY: "先问清企微承接和销售协作现状",
        SYSTEM_COMPARE: "先判断更想解决 GEO、企微承接还是老板看板",
        UNCLEAR: "先追问企业当前最卡的业务环节"
      },
      answers: {
        PRICE: "这类合作通常要先看企业现在卡在哪个环节，再判断适合的投入和节奏。",
        COOPERATION: "如果要推进合作，我们会先把获客、承接、跟进和老板看板这条线看清楚。",
        CASE: "案例可以先给您看，但更重要的是先判断您现在最想补的是品牌信任还是转化承接。",
        DELIVERY: "能不能用起来，关键不只是搭后台，而是企微承接、销售动作和老板视角有没有接上。",
        SYSTEM_COMPARE: "它不是 AI 客服，也不是普通代运营，重点是把增长过程和销售推进跑清楚。",
        UNCLEAR: "这个问题先不急着一句说满，先把您现在的真实卡点摸清楚会更准。"
      },
      warnings: {
        PRICE: "不要先报死价，先判断企业卡点。",
        COOPERATION: "不要承诺一定增长，先做诊断。",
        CASE: "不要只讲案例，要回到企业现状。",
        DELIVERY: "不要把系统说成自动跑通。",
        SYSTEM_COMPARE: "不要说成 AI 客服或自动回复。",
        UNCLEAR: "先追问现状，再收口建议。"
      }
    };
  }

  if (customerType === "PLATFORM_MEMBERSHIP_CLIENT") {
    return {
      materialTitles: {
        PRICE: ["整木网会员服务说明", "会员权益说明"],
        COOPERATION: ["整木网会员服务说明", "整木网行业增信价值说明"],
        CASE: ["整木网行业增信价值说明", "基础增信服务清单"],
        DELIVERY: ["会员权益说明", "声望增长服务清单"],
        SYSTEM_COMPARE: ["整木网会员服务说明", "整木网行业增信价值说明"],
        UNCLEAR: ["整木网会员服务说明", "会员权益说明"]
      },
      nextActions: {
        PRICE: "先判断更适合基础增信、声望增长还是高阶服务",
        COOPERATION: "推动进入会员沟通",
        CASE: "确认更想看露出、增信还是客户转化价值",
        DELIVERY: "确认当前品牌最缺背书、露出还是客户承接",
        SYSTEM_COMPARE: "先判断是在比较广告投放、会员服务还是增信合作",
        UNCLEAR: "先问清最想获得哪类会员价值"
      },
      answers: {
        PRICE: "会员服务不是只看一个费用，更要看您现在最需要的是增信、露出还是转化配合。",
        COOPERATION: "如果您是在看会员，建议先把权益边界和适合的服务层级讲清楚。",
        CASE: "这块可以先给您看会员价值和增信路径，再判断哪一类更适合您现在的阶段。",
        DELIVERY: "会员服务能不能发挥作用，关键还是要看您现在最缺的是背书、资源还是转化支持。",
        SYSTEM_COMPARE: "它和普通广告不一样，更偏长期增信、行业露出和业务协同，不是买一次曝光就结束。",
        UNCLEAR: "这个问题可以先不急着定，先把您现在最想补的价值点对齐。"
      },
      warnings: {
        PRICE: "不要先报固定套餐，先分层判断。",
        COOPERATION: "不要把会员说成万能方案。",
        CASE: "不要只讲资源，记得回到客户阶段。",
        DELIVERY: "不要承诺立刻转化，先讲适配度。",
        SYSTEM_COMPARE: "不要把会员等同于投流。",
        UNCLEAR: "先问当前目标，再给建议。"
      }
    };
  }

  if (customerType === "PLATFORM_GEO_AI_CLIENT") {
    return {
      materialTitles: {
        PRICE: ["GEO 推广服务说明", "整木企业 AI 搜索可见性自查表"],
        COOPERATION: ["GEO 推广服务说明", "AI 时代品牌增信方案"],
        CASE: ["AI 时代品牌增信方案", "关键词与内容底座建设说明"],
        DELIVERY: ["整木企业 AI 搜索可见性自查表", "关键词与内容底座建设说明"],
        SYSTEM_COMPARE: ["GEO 推广服务说明", "AI 时代品牌增信方案"],
        UNCLEAR: ["整木企业 AI 搜索可见性自查表", "GEO 推广服务说明"]
      },
      nextActions: {
        PRICE: "先做一次 AI 可见性诊断",
        COOPERATION: "梳理品牌关键词并判断是否启动 GEO 服务",
        CASE: "确认更关心收录、推荐还是品牌信任",
        DELIVERY: "先判断内容底座、关键词还是品牌资料在卡点",
        SYSTEM_COMPARE: "先讲清 GEO 和 SEO、代运营的边界",
        UNCLEAR: "先问当前最想提升哪类搜索可见性"
      },
      answers: {
        PRICE: "GEO 这类服务通常要先看品牌关键词、内容底座和当前可见性，再判断投入更准确。",
        COOPERATION: "如果要推进，通常先做一轮可见性诊断，再看适不适合直接启动 GEO。",
        CASE: "这块不只是看有没有案例，更要先判断您现在是想要收录、推荐还是品牌信任提升。",
        DELIVERY: "GEO 能不能跑起来，关键在关键词、内容底座和品牌资料是否先准备到位。",
        SYSTEM_COMPARE: "它和传统 SEO、代运营不完全一样，更偏 AI 搜索时代的可见性和品牌信任建设。",
        UNCLEAR: "这个问题可以先不急着展开，先把您想解决的搜索场景说清楚。"
      },
      warnings: {
        PRICE: "不要承诺固定周期见效。",
        COOPERATION: "不要一上来承诺结果，先诊断。",
        CASE: "不要只讲案例，记得问关键词。",
        DELIVERY: "不要把 GEO 说成一次性动作。",
        SYSTEM_COMPARE: "不要混同成普通 SEO 套餐。",
        UNCLEAR: "先问搜索场景和品牌现状。"
      }
    };
  }

  if (customerType === "PLATFORM_TRAINING_CLIENT") {
    return {
      materialTitles: {
        PRICE: ["培训课程介绍", "课程课纲"],
        COOPERATION: ["培训课程介绍", "报名说明"],
        CASE: ["课程课纲", "往期问题清单"],
        DELIVERY: ["适合对象说明", "报名说明"],
        SYSTEM_COMPARE: ["培训课程介绍", "适合对象说明"],
        UNCLEAR: ["培训课程介绍", "课程课纲"]
      },
      nextActions: {
        PRICE: "确认参训角色和人数",
        COOPERATION: "发送课纲并推动报名",
        CASE: "确认更想看老板课、团队课还是实操课",
        DELIVERY: "确认是否需要课后服务或辅导",
        SYSTEM_COMPARE: "判断是在比课程内容、实操深度还是参与角色",
        UNCLEAR: "先问谁来参加和当前最想学什么"
      },
      answers: {
        PRICE: "课程这块先看谁来参加、想解决什么问题，再谈安排会更准确。",
        COOPERATION: "如果您在看课程，我建议先把课纲、适合对象和报名节奏对齐。",
        CASE: "这块可以先给您看课纲和往期高频问题，帮助判断是不是现在需要的内容。",
        DELIVERY: "课程价值更看能不能带回去用，所以先确认参训角色和当前业务问题很关键。",
        SYSTEM_COMPARE: "它不是泛泛听一场分享，重点是围绕业务场景把方法、案例和动作讲清楚。",
        UNCLEAR: "先把参训对象和最想解决的问题对齐，建议会更贴近。"
      },
      warnings: {
        PRICE: "不要先按最低价沟通，先看参训对象。",
        COOPERATION: "不要承诺上课后立刻见效。",
        CASE: "不要只讲老师，记得讲场景。",
        DELIVERY: "不要把课程说成万能解法。",
        SYSTEM_COMPARE: "不要和普通公开课混讲。",
        UNCLEAR: "先问角色、人数和目标。"
      }
    };
  }

  if (customerType === "PLATFORM_EVENT_RESOURCE_CLIENT") {
    return {
      materialTitles: {
        PRICE: ["乌镇设计周合作说明", "品牌露出权益说明"],
        COOPERATION: ["乌镇设计周合作说明", "行业峰会资源说明"],
        CASE: ["榜单与趋势发布说明", "品牌露出权益说明"],
        DELIVERY: ["行业峰会资源说明", "品牌露出权益说明"],
        SYSTEM_COMPARE: ["乌镇设计周合作说明", "榜单与趋势发布说明"],
        UNCLEAR: ["乌镇设计周合作说明", "行业峰会资源说明"]
      },
      nextActions: {
        PRICE: "判断更适合活动露出、峰会合作还是榜单发布",
        COOPERATION: "发送资源包并安排活动合作沟通",
        CASE: "确认更想看露出权益还是资源链接方式",
        DELIVERY: "确认活动节点和内部决策节奏",
        SYSTEM_COMPARE: "先判断是在比曝光、背书还是资源链接",
        UNCLEAR: "先问最想要哪类行业资源"
      },
      answers: {
        PRICE: "活动资源这块不是只看一个价格，更要看您现在更需要露出、背书还是资源链接。",
        COOPERATION: "如果要推进活动合作，通常先把适合的资源位和沟通节奏定清楚。",
        CASE: "这块可以先给您看乌镇、峰会和榜单资源，再判断哪种更适合您当前目标。",
        DELIVERY: "活动合作能不能发挥价值，关键要看节点、权益和后续承接有没有一起设计。",
        SYSTEM_COMPARE: "它和普通广告投放不一样，更偏行业影响力、资源对接和品牌露出路径。",
        UNCLEAR: "先把您最想获得的活动价值点说清楚，我再给您更贴近的建议。"
      },
      warnings: {
        PRICE: "不要只谈价格，先讲资源匹配。",
        COOPERATION: "不要承诺一定带来客户。",
        CASE: "不要只讲热闹，要回到业务价值。",
        DELIVERY: "不要忽略活动后的承接动作。",
        SYSTEM_COMPARE: "不要和普通广告位混讲。",
        UNCLEAR: "先问目标，再推荐资源。"
      }
    };
  }

  if (customerType === "PLATFORM_SUPPLY_CHAIN_CLIENT") {
    return {
      materialTitles: {
        PRICE: ["集采合作说明", "产品标准说明"],
        COOPERATION: ["集采合作说明", "合作流程说明"],
        CASE: ["产品标准说明", "质量保障机制"],
        DELIVERY: ["质量保障机制", "合作流程说明"],
        SYSTEM_COMPARE: ["集采合作说明", "质量保障机制"],
        UNCLEAR: ["集采合作说明", "产品标准说明"]
      },
      nextActions: {
        PRICE: "确认采购品类和当前合作方式",
        COOPERATION: "安排供应链对接沟通",
        CASE: "确认更关心标准、价格还是质量机制",
        DELIVERY: "确认交付节点和责任边界",
        SYSTEM_COMPARE: "先判断是在比价格、标准还是售后机制",
        UNCLEAR: "先问采购品类和合作阶段"
      },
      answers: {
        PRICE: "集采这块通常要先看采购品类、合作量级和交付要求，再谈价格会更准。",
        COOPERATION: "如果是集采合作，建议先把标准、质量和流程边界讲清楚。",
        CASE: "这块可以先给您看产品标准和保障机制，再判断是否适合继续推进。",
        DELIVERY: "供应链合作关键不只是价格，还要把质量、交付和责任边界提前说清楚。",
        SYSTEM_COMPARE: "它不是单纯比价，更像把标准、流程、质量保障和协作机制一起看。",
        UNCLEAR: "先把采购品类和当前诉求问清楚，建议才不会偏。"
      },
      warnings: {
        PRICE: "不要脱离品类和量级直接报价。",
        COOPERATION: "不要先承诺所有品类都能接。",
        CASE: "不要只讲低价，记得讲标准。",
        DELIVERY: "不要模糊质量和责任边界。",
        SYSTEM_COMPARE: "不要只按价格单点比较。",
        UNCLEAR: "先问品类、量级和节点。"
      }
    };
  }

  if (customerType === "PLATFORM_AFTERMARKET_CLIENT") {
    return {
      materialTitles: {
        PRICE: ["一清一护项目说明", "门店合作模式"],
        COOPERATION: ["一清一护项目说明", "上门服务 SOP"],
        CASE: ["门店合作模式", "私域转化方案"],
        DELIVERY: ["上门服务 SOP", "全球严选产品说明"],
        SYSTEM_COMPARE: ["一清一护项目说明", "门店合作模式"],
        UNCLEAR: ["一清一护项目说明", "上门服务 SOP"]
      },
      nextActions: {
        PRICE: "判断门店基础和服务能力",
        COOPERATION: "发送合作说明并安排项目沟通",
        CASE: "确认更想看合作模式还是服务 SOP",
        DELIVERY: "确认门店服务标准和上门能力",
        SYSTEM_COMPARE: "先判断是在比项目模式、利润还是服务标准",
        UNCLEAR: "先问门店情况和最想做哪类后市场业务"
      },
      answers: {
        PRICE: "这类后市场合作先看门店基础、服务能力和项目模式，再谈费用会更准。",
        COOPERATION: "如果要推进一清一护，建议先把门店基础、合作模式和服务标准讲清楚。",
        CASE: "这块可以先给您看项目说明和门店合作方式，再判断适不适合现在推进。",
        DELIVERY: "后市场能不能做起来，关键在 SOP、上门服务和门店转化动作有没有配上。",
        SYSTEM_COMPARE: "它不是单纯卖产品，更偏项目合作、门店服务和私域转化的组合。",
        UNCLEAR: "先把您门店现在的服务能力和目标说清楚，我再给您更贴近的建议。"
      },
      warnings: {
        PRICE: "不要先谈最低价，先看门店基础。",
        COOPERATION: "不要承诺所有门店都适合。",
        CASE: "不要只讲项目收益，记得讲服务动作。",
        DELIVERY: "不要忽略上门服务标准。",
        SYSTEM_COMPARE: "不要说成纯产品分销。",
        UNCLEAR: "先问门店条件和合作目标。"
      }
    };
  }

  if (customerType === "PLATFORM_PARTNER_CLIENT") {
    return {
      materialTitles: {
        PRICE: ["合作伙伴说明", "合作边界说明"],
        COOPERATION: ["资源共创方案", "活动共建说明"],
        CASE: ["资源共创方案", "合作伙伴说明"],
        DELIVERY: ["合作边界说明", "活动共建说明"],
        SYSTEM_COMPARE: ["合作伙伴说明", "合作边界说明"],
        UNCLEAR: ["合作伙伴说明", "资源共创方案"]
      },
      nextActions: {
        PRICE: "先明确双方资源和合作边界",
        COOPERATION: "安排合作沟通并推进小范围试合作",
        CASE: "确认更关心联合活动、资源互换还是共同开发客户",
        DELIVERY: "先讲清合作分工和推进节奏",
        SYSTEM_COMPARE: "先判断是在比资源价值还是合作方式",
        UNCLEAR: "先问对方想交换什么资源"
      },
      answers: {
        PRICE: "合作伙伴这类沟通先看双方资源匹配和边界，再谈投入方式会更稳。",
        COOPERATION: "如果要推进伙伴合作，建议先把资源、分工和试合作范围定清楚。",
        CASE: "这块可以先给您看资源共创和活动共建思路，再判断哪种更适合先跑。",
        DELIVERY: "合作能不能落地，关键是分工、节奏和边界先讲明白，不然后面容易跑偏。",
        SYSTEM_COMPARE: "它不是简单买资源，更像围绕双方资源做共创和客户协同。",
        UNCLEAR: "先把您想交换的资源和合作目标说清楚，我再给您更贴近的建议。"
      },
      warnings: {
        PRICE: "不要先承诺大范围合作。",
        COOPERATION: "先从小范围试合作开始。",
        CASE: "不要只讲想法，记得落到资源清单。",
        DELIVERY: "不要模糊合作边界。",
        SYSTEM_COMPARE: "不要当成单次广告合作去讲。",
        UNCLEAR: "先问资源、目标和边界。"
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

  if (customerType === "PLATFORM_FACTORY_OWNER") {
    if (questionType === "SYSTEM_COMPARE") return "您现在更卡在 GEO、企微承接还是老板看板";
    if (questionType === "PRICE") return "当前最卡的增长环节和预期投入";
    return "您现在最想优先补的是获客、增信还是承接";
  }

  if (customerType === "PLATFORM_MEMBERSHIP_CLIENT") {
    if (questionType === "PRICE") return "您更想先补增信、露出还是客户转化";
    return "您现在最想通过会员解决什么问题";
  }

  if (customerType === "PLATFORM_GEO_AI_CLIENT") {
    if (questionType === "SYSTEM_COMPARE") return "您是在比较 GEO、SEO 还是代运营";
    if (questionType === "PRICE") return "品牌关键词、内容底座和当前可见性情况";
    return "您现在最想提升哪一类 AI 搜索可见性";
  }

  if (customerType === "PLATFORM_TRAINING_CLIENT") {
    if (questionType === "PRICE") return "谁来参加、多少人参加和最想解决什么问题";
    return "您更想给老板、销售还是团队报名";
  }

  if (customerType === "PLATFORM_EVENT_RESOURCE_CLIENT") {
    if (questionType === "PRICE") return "您更看重露出、背书还是资源链接";
    return "您这次更想拿到哪类活动资源";
  }

  if (customerType === "PLATFORM_SUPPLY_CHAIN_CLIENT") {
    if (questionType === "PRICE") return "采购品类、量级和交付要求";
    return "您现在更关心标准、价格还是质量保障";
  }

  if (customerType === "PLATFORM_AFTERMARKET_CLIENT") {
    if (questionType === "PRICE") return "门店基础、服务能力和合作目标";
    return "您更想先看项目模式、SOP 还是门店转化";
  }

  if (customerType === "PLATFORM_PARTNER_CLIENT") {
    if (questionType === "PRICE") return "双方资源、合作范围和当前目标";
    return "您最希望先推进资源互换、联合活动还是客户共创";
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
    case "PLATFORM_FACTORY_OWNER":
      addTag("整木工厂老板", "客户类型标签", "当前客户是整木网自用工作台里的工厂老板客户。", "HIGH");
      addTag("增长诊断意向", "业务标签", "适合先做增长诊断，判断获客、增信和承接卡点。", "HIGH");
      addTag("品牌增信关注", "需求标签", "该类客户通常同时关注行业背书和品牌信任。", "MEDIUM");
      addTag("业务增长中台意向", "业务标签", "适合继续引导到企微承接和老板看板能力。", "MEDIUM");
      break;
    case "PLATFORM_MEMBERSHIP_CLIENT":
      addTag("会员意向客户", "客户类型标签", "当前客户类型为会员意向客户，建议围绕会员权益和增信价值推进。", "HIGH");
      addTag("会员服务", "业务标签", "该类客户适合优先进入会员服务沟通。", "HIGH");
      addTag("品牌增信关注", "需求标签", "会员意向客户通常会同时关注背书和增信。", "MEDIUM");
      break;
    case "PLATFORM_GEO_AI_CLIENT":
      addTag("GEO／AI 推广客户", "客户类型标签", "当前客户类型为 GEO／AI 推广客户。", "HIGH");
      addTag("GEO意向", "业务标签", "该类客户适合先做 AI 搜索可见性诊断。", "HIGH");
      addTag("AI推广关注", "需求标签", "客户更容易继续追问推荐、收录和关键词。", "MEDIUM");
      break;
    case "PLATFORM_TRAINING_CLIENT":
      addTag("培训课程客户", "客户类型标签", "当前客户类型为培训课程客户。", "HIGH");
      addTag("培训意向", "业务标签", "该类客户适合按课程介绍和报名沟通推进。", "HIGH");
      addTag("课程报名关注", "需求标签", "建议继续确认参训角色和报名节奏。", "MEDIUM");
      break;
    case "PLATFORM_EVENT_RESOURCE_CLIENT":
      addTag("活动资源客户", "客户类型标签", "当前客户类型为活动／乌镇资源客户。", "HIGH");
      addTag("乌镇资源关注", "需求标签", "适合继续围绕乌镇设计周和峰会资源推进。", "HIGH");
      addTag("品牌露出关注", "需求标签", "活动客户往往同时关注行业露出和背书。", "MEDIUM");
      break;
    case "PLATFORM_SUPPLY_CHAIN_CLIENT":
      addTag("供应链客户", "客户类型标签", "当前客户类型为供应链／集采客户。", "HIGH");
      addTag("集采供应链", "业务标签", "适合围绕品类、标准和合作流程推进。", "HIGH");
      addTag("质量保障关注", "需求标签", "该类客户通常会持续追问质量和责任边界。", "MEDIUM");
      break;
    case "PLATFORM_AFTERMARKET_CLIENT":
      addTag("后市场客户", "客户类型标签", "当前客户类型为一清一护后市场客户。", "HIGH");
      addTag("一清一护", "业务标签", "适合围绕项目说明、门店合作和 SOP 推进。", "HIGH");
      addTag("门店合作意向", "需求标签", "后市场客户通常会继续关注门店合作方式。", "MEDIUM");
      break;
    case "PLATFORM_PARTNER_CLIENT":
      addTag("合作伙伴客户", "客户类型标签", "当前客户类型为合作伙伴客户。", "HIGH");
      addTag("联盟合作", "业务标签", "适合围绕资源共创和试合作推进。", "HIGH");
      addTag("内容共创", "业务标签", "合作伙伴更容易关注联合活动和内容共创。", "MEDIUM");
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

function mergeBusinessLineSuggestedTags(
  baseTags: SuggestedTag[],
  businessLines: BusinessLineContext[],
  lead: LeadContext,
  customerQuestion: string,
  stage: LeadStage
) {
  const merged = new Map<string, SuggestedTag>();

  for (const tag of baseTags) {
    upsertSuggestedTag(merged, tag, stage);
  }

  const matchedBusinessLines = matchBusinessLinesForQuestion({
    businessLines: businessLines as BusinessLineRecord[],
    customerType: lead.customerType,
    customerQuestion
  });

  for (const { line } of matchedBusinessLines) {
    for (const tag of parseBusinessLineRecommendedTags(line.recommendedTagNames)) {
      const normalizedGroup = normalizeSuggestedTagGroup(tag.tagGroup);
      if (!normalizedGroup) continue;

      upsertSuggestedTag(
        merged,
        {
          tagName: tag.tagName,
          tagGroup: normalizedGroup,
          reason: `命中启用业务线「${line.name}」，建议优先按该业务线继续跟进。`,
          confidence: "HIGH"
        },
        stage
      );
    }
  }

  return [...merged.values()].sort((left, right) => {
    const confidenceDiff = confidenceRank[right.confidence] - confidenceRank[left.confidence];
    if (confidenceDiff !== 0) return confidenceDiff;
    if (left.tagGroup !== right.tagGroup) return left.tagGroup.localeCompare(right.tagGroup, "zh-CN");
    return left.tagName.localeCompare(right.tagName, "zh-CN");
  });
}

function prependBusinessLineMaterials(
  pickedMaterials: MaterialContext[],
  allMaterials: MaterialContext[],
  businessLines: BusinessLineContext[],
  lead: LeadContext,
  customerQuestion: string
) {
  const matchedBusinessLines = matchBusinessLinesForQuestion({
    businessLines: businessLines as BusinessLineRecord[],
    customerType: lead.customerType,
    customerQuestion
  });

  const seen = new Set<string>();
  const ordered: MaterialContext[] = [];

  const pushMaterial = (material?: MaterialContext) => {
    if (!material || seen.has(material.id)) return;
    seen.add(material.id);
    ordered.push(material);
  };

  for (const { line } of matchedBusinessLines) {
    for (const materialId of parseBusinessLineIdList(line.recommendedMaterialIds)) {
      pushMaterial(allMaterials.find((material) => material.id === materialId));
    }
  }

  for (const material of pickedMaterials) {
    pushMaterial(material);
  }

  return ordered;
}

function resolveBusinessLineNextAction(
  fallbackNextAction: string,
  businessLines: BusinessLineContext[],
  lead: LeadContext,
  customerQuestion: string
) {
  const matchedBusinessLines = matchBusinessLinesForQuestion({
    businessLines: businessLines as BusinessLineRecord[],
    customerType: lead.customerType,
    customerQuestion
  });

  return matchedBusinessLines.find((item) => item.line.defaultNextAction?.trim())?.line.defaultNextAction?.trim() ?? fallbackNextAction;
}

export function generateReplySuggestions(input: {
  lead: LeadContext;
  strategy: StrategyContext;
  materials: MaterialContext[];
  businessLines?: BusinessLineContext[];
  customerQuestion: string;
}): GeneratedReplySuggestion[] {
  const questionType = detectQuestionType(input.customerQuestion);
  const customerTypeConfig = getCustomerTypeConfig(input.lead.customerType);
  const materialMatches = prependBusinessLineMaterials(
    pickMaterials(input.materials, input.strategy, customerTypeConfig.materialTitles[questionType], 2),
    input.materials,
    input.businessLines ?? [],
    input.lead,
    input.customerQuestion
  );
  const stageHint = getStageHint(input.lead.stage);
  const nextQuestion = buildNextQuestion(input.lead.customerType, questionType);
  const recommendedNextAction = resolveBusinessLineNextAction(
    customerTypeConfig.nextActions[questionType] || input.strategy?.recommendedNextAction || "继续确认客户真实需求",
    input.businessLines ?? [],
    input.lead,
    input.customerQuestion
  );
  const answer = customerTypeConfig.answers[questionType];
  const warning = customerTypeConfig.warnings[questionType];
  const suggestedTags = mergeBusinessLineSuggestedTags(
    buildSuggestedTags(input.lead, input.customerQuestion),
    input.businessLines ?? [],
    input.lead,
    input.customerQuestion,
    input.lead.stage
  );

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
    const normalizedGroup = normalizeSuggestedTagGroup(tagGroup);
    if (!normalizedGroup) return [];
    if (!["LOW", "MEDIUM", "HIGH"].includes(confidence)) return [];

    return [
      {
        tagName,
        tagGroup: normalizedGroup,
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
