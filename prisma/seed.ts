/*
 * 文件说明：该文件为 V1.4 本地开发环境写入可演示的通用销售样板数据。
 * 功能说明：创建平台管理员、两个租户、企业角色账号、四类客户策略、资料包、任务模板、线索、跟进记录和任务。
 *
 * 结构概览：
 *   第一部分：导入依赖与基础类型
 *   第二部分：通用销售策略、资料和模板数据
 *   第三部分：线索与任务样板数据
 *   第四部分：租户数据写入函数
 *   第五部分：主种子流程
 */
import {
  PrismaClient,
  type BusinessLineCategory,
  type BusinessLineStatus,
  type CustomerType,
  type FollowTaskPriority,
  type FollowTaskStatus,
  type FollowTaskType,
  type IntentionLevel,
  type LeadSource,
  type LeadStage,
  type NeedType
} from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

type StrategyTemplate = {
  customerType: CustomerType;
  name: string;
  painPoints: string[];
  firstMaterials: string[];
  welcomeScript: string;
  day3Script: string;
  day7Script: string;
  day15Script: string;
  manualTriggerRules: string[];
  recommendedNextAction: string;
  recommendedPrivateContent: string;
};

type MaterialTemplate = {
  title: string;
  description: string;
  url: string;
  customerType?: CustomerType | null;
};

type TaskTemplateSeed = {
  name: string;
  title: string;
  description: string;
  type: FollowTaskType;
  priority: FollowTaskPriority;
  defaultDueDays: number;
  customerType?: CustomerType | null;
  stage?: LeadStage | null;
};

type BusinessLineRecommendedTagSeed = {
  tagName: string;
  tagGroup: "客户类型标签" | "需求标签" | "阶段标签" | "业务标签" | "风险标签";
};

type BusinessLineSeed = {
  name: string;
  slug: string;
  description: string;
  status?: BusinessLineStatus;
  category: BusinessLineCategory;
  priority: number;
  targetCustomerTypes: CustomerType[];
  recommendedTags: BusinessLineRecommendedTagSeed[];
  recommendedMaterialTitles: string[];
  recommendedTaskTemplateNames: string[];
  defaultNextAction: string;
  notes?: string;
};

type DemoFollowUp = {
  content: string;
  nextAction: string;
  stageBefore: LeadStage;
  stageAfter: LeadStage;
  createdDaysAgo: number;
  nextFollowOffsetDays?: number | null;
};

type DemoTask = {
  title: string;
  description: string;
  type: FollowTaskType;
  status: FollowTaskStatus;
  priority: FollowTaskPriority;
  dueOffsetDays: number;
  completedOffsetDays?: number | null;
};

type LeadTemplate = {
  id: string;
  name: string;
  phone: string;
  wechat?: string;
  company?: string;
  industry?: string;
  city: string;
  source: LeadSource;
  customerType: CustomerType;
  needType: NeedType;
  intentionLevel: IntentionLevel;
  stage: LeadStage;
  owner: "sales" | "admin" | "operator";
  message: string;
  followUp: DemoFollowUp;
  task: DemoTask;
  extraTags?: string[];
};

type SeedTenantInput = {
  slug: string;
  name: string;
  industry: string;
  plan?: "flagship";
  users: { admin: string; operator: string; sales: string };
  userNames?: { admin: string; operator: string; sales: string };
  strategies?: StrategyTemplate[];
  materials?: MaterialTemplate[];
  taskTemplates?: TaskTemplateSeed[];
  businessLines?: BusinessLineSeed[];
  leads: LeadTemplate[];
};

function atHour(date: Date, hour: number, minute = 0) {
  const value = new Date(date);
  value.setHours(hour, minute, 0, 0);
  return value;
}

function daysFromNow(days: number, hour = 10, minute = 0) {
  const value = atHour(new Date(), hour, minute);
  value.setDate(value.getDate() + days);
  return value;
}

function daysAgo(days: number, hour = 9, minute = 30) {
  return daysFromNow(-days, hour, minute);
}

function uniqueById(values: { id: string }[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    if (seen.has(value.id)) return false;
    seen.add(value.id);
    return true;
  });
}

const strategyTemplates: StrategyTemplate[] = [
  {
    customerType: "OWNER_CLIENT",
    name: "潜在客户跟进策略",
    painPoints: ["效果", "环保", "价格", "交付", "售后", "设计落地"],
    firstMaterials: ["产品服务避坑清单", "成功案例", "交付流程说明", "环保与售后说明"],
    welcomeScript: "您好，已收到您的产品服务需求。我们先发您真实案例和避坑清单，方便您快速判断风格、预算和落地节奏。",
    day3Script: "您目前更关注整体效果、环保材料还是预算控制？我可以按您的房屋情况先给一版建议。",
    day7Script: "如果方便发一下户型、面积或装修阶段，我们可以进一步判断更适合的客户增长方案和交付节奏。",
    day15Script: "前面发您的案例和说明是否有帮助？如果近期准备推进装修，可以先预约一次初步方案沟通。",
    manualTriggerRules: ["发送户型图", "询问价格", "咨询环保", "关注交付周期", "预约到店沟通"],
    recommendedNextAction: "预约初步方案",
    recommendedPrivateContent: "别墅客户增长案例、环保说明、交付节点记录、售后服务说明"
  },
  {
    customerType: "DEALER_CLIENT",
    name: "合作伙伴跟进策略",
    painPoints: ["利润", "政策", "区域保护", "总部支持", "样板门店", "风险"],
    firstMaterials: ["合作方案", "产品体系说明", "合作政策说明", "样板门店案例", "现场评估邀请"],
    welcomeScript: "您好，感谢关注客户增长合作。先发您合作方案和产品体系，您可以先看利润空间、区域政策和总部支持方式。",
    day3Script: "您现在更关注利润模型、区域保护，还是样板门店和落地支持？我可以按您所在城市给您说明。",
    day7Script: "如果您方便提供城市和门店情况，我们可以进一步判断合作政策、样板支持和现场评估安排。",
    day15Script: "近期如果还在评估项目，可以先安排一次合作负责人沟通，把政策和投入边界讲清楚。",
    manualTriggerRules: ["询问代理政策", "提供城市信息", "了解门店情况", "关注利润模型", "预约到厂"],
    recommendedNextAction: "安排合作负责人沟通",
    recommendedPrivateContent: "样板门店案例、合作政策说明、合作伙伴答疑纪要"
  },
  {
    customerType: "DESIGNER_CLIENT",
    name: "意向客户跟进策略",
    painPoints: ["审美", "落地", "工艺", "材料", "案例", "项目配合"],
    firstMaterials: ["成功案例", "工艺节点说明", "材料样册", "方案协作机制", "项目配合流程"],
    welcomeScript: "您好，已收到您的设计合作需求。先发您成功案例、工艺节点和材料样册，方便您判断审美方向和落地配合。",
    day3Script: "您近期主要在做哪类项目？如果有图纸或风格方向，我们可以先给一版材料与工艺建议。",
    day7Script: "我们可以配合报价、深化、材料确认和交付节点，您更希望先从哪一块开始沟通？",
    day15Script: "如果近期有项目在推进，可以先建立项目群或项目协作沟通，避免后期工艺和报价来回反复。",
    manualTriggerRules: ["发送图纸", "询问工艺", "想看案例", "询问材料", "需要项目报价配合"],
    recommendedNextAction: "建立项目合作沟通",
    recommendedPrivateContent: "成功案例、材料样册、方案协作案例、工艺落地说明"
  },
  {
    customerType: "FACTORY_CLIENT",
    name: "重点客户增长策略",
    painPoints: ["获客", "合作", "品牌", "成交", "企业微信", "AI推广", "内容增长"],
    firstMaterials: ["内部提醒承接自查表", "客户增长诊断表", "信任建设方案", "内容增长说明", "销售协作工作台合作建议"],
    welcomeScript: "您好，已收到您的增长咨询。先发您内部提醒承接自查表和增长诊断表，方便判断当前获客、承接和成交的主要断点。",
    day3Script: "您现在更卡在获客、合作、承接还是管理看板？我可以先按现状给您一个诊断方向。",
    day7Script: "如果方便说一下企业规模和主要渠道，我们可以判断先做内部提醒承接、信任建设，还是先做内容增长更合适。",
    day15Script: "近期如果准备系统化推进增长，建议安排一次深度诊断，把渠道、企微、销售跟进和看板串起来。",
    manualTriggerRules: ["询问合作费用", "介绍企业规模", "希望做推广", "想看企微方案", "安排老板沟通"],
    recommendedNextAction: "安排深度诊断",
    recommendedPrivateContent: "销售协作工作台案例、内部提醒承接流程、信任建设方案、内容增长思路"
  }
];

const materialTemplates: MaterialTemplate[] = [
  { customerType: "OWNER_CLIENT", title: "产品服务避坑清单", description: "帮助潜在客户快速排查预算、工艺和交付常见风险。", url: "https://example.com/owner-avoid-pitfalls" },
  { customerType: "OWNER_CLIENT", title: "成功案例", description: "展示别墅、大平层和产品服务场景的真实落地案例。", url: "https://example.com/owner-casebook" },
  { customerType: "OWNER_CLIENT", title: "交付流程说明", description: "说明从测量、深化、生产到安装交付的完整流程。", url: "https://example.com/owner-delivery-flow" },
  { customerType: "OWNER_CLIENT", title: "环保与售后说明", description: "适合潜在客户重点了解环保、售后和材料边界。", url: "https://example.com/owner-service" },
  { customerType: "DEALER_CLIENT", title: "合作方案", description: "帮助合作伙伴快速了解品牌定位、利润模型和合作方式。", url: "https://example.com/dealer-investment-book" },
  { customerType: "DEALER_CLIENT", title: "产品体系说明", description: "覆盖产品服务线、客单结构和样板空间组合。", url: "https://example.com/dealer-product-system" },
  { customerType: "DEALER_CLIENT", title: "合作政策说明", description: "讲清区域保护、返利和总部支持方式。", url: "https://example.com/dealer-policy" },
  { customerType: "DEALER_CLIENT", title: "样板门店案例", description: "展示门店落地效果和合作转化案例。", url: "https://example.com/dealer-showroom" },
  { customerType: "DEALER_CLIENT", title: "现场评估邀请", description: "适合推动合作伙伴进入考察和政策确认阶段。", url: "https://example.com/dealer-factory-visit" },
  { customerType: "DESIGNER_CLIENT", title: "成功案例", description: "适合意向客户筛选审美方向和风格落地样本。", url: "https://example.com/designer-casebook" },
  { customerType: "DESIGNER_CLIENT", title: "工艺节点说明", description: "帮助意向客户确认工艺可行性和施工衔接。", url: "https://example.com/designer-craft" },
  { customerType: "DESIGNER_CLIENT", title: "材料样册", description: "展示常用产品资料、饰面和五金搭配。", url: "https://example.com/designer-material-swatch" },
  { customerType: "DESIGNER_CLIENT", title: "方案协作机制", description: "说明项目合作、报价支持和设计协同方式。", url: "https://example.com/designer-cooperation" },
  { customerType: "DESIGNER_CLIENT", title: "项目配合流程", description: "帮助意向客户判断从深化到交付的协作节奏。", url: "https://example.com/designer-project-flow" },
  { customerType: "FACTORY_CLIENT", title: "内部提醒承接自查表", description: "帮助重点客户排查内部提醒承接和线索分配断点。", url: "https://example.com/factory-wecom-check" },
  { customerType: "FACTORY_CLIENT", title: "客户增长诊断表", description: "用于梳理获客、合作、内容和成交的系统问题。", url: "https://example.com/factory-growth-diagnosis" },
  { customerType: "FACTORY_CLIENT", title: "信任建设方案", description: "帮助重点客户理解老板 IP、品牌内容和增信路径。", url: "https://example.com/factory-brand-trust" },
  { customerType: "FACTORY_CLIENT", title: "内容增长说明", description: "介绍本地搜索、地图和内容分发的增长方式。", url: "https://example.com/factory-geo" },
  { customerType: "FACTORY_CLIENT", title: "销售协作工作台合作建议", description: "适合重点客户评估内部提醒承接和管理看板合作。", url: "https://example.com/factory-growth-hub" }
];

const taskTemplateSeeds: TaskTemplateSeed[] = [
  { customerType: "OWNER_CLIENT", name: "首次沟通", title: "首次沟通潜在客户", description: "确认房屋面积、装修阶段、预算和风格偏好。", type: "FIRST_FOLLOW", priority: "HIGH", defaultDueDays: 1 },
  { customerType: "OWNER_CLIENT", name: "发送成功案例", title: "发送潜在客户成功案例", description: "发送成功案例和避坑清单，建立初步信任。", type: "SEND_MATERIAL", priority: "NORMAL", defaultDueDays: 1 },
  { customerType: "OWNER_CLIENT", name: "了解房屋面积和装修阶段", title: "了解房屋面积和装修阶段", description: "收集户型、面积和当前装修进度。", type: "PHONE_CALL", priority: "NORMAL", defaultDueDays: 2 },
  { customerType: "OWNER_CLIENT", name: "预约初步方案", title: "预约初步方案沟通", description: "推动客户进入一对一方案沟通。", type: "PHONE_CALL", priority: "HIGH", defaultDueDays: 3 },
  { customerType: "OWNER_CLIENT", name: "报价后跟进", title: "报价后跟进潜在客户", description: "跟进潜在客户对报价、环保和交付的反馈。", type: "QUOTE_FOLLOW", priority: "HIGH", defaultDueDays: 2, stage: "QUOTED" },
  { customerType: "OWNER_CLIENT", name: "15 天沉默激活", title: "15 天沉默激活潜在客户", description: "对沉默客户重新激活并引导二次沟通。", type: "REACTIVATE", priority: "NORMAL", defaultDueDays: 0, stage: "TO_REACTIVATE" },
  { customerType: "DEALER_CLIENT", name: "发送合作资料", title: "发送合作资料包", description: "发送合作方案、产品体系和合作政策。", type: "SEND_MATERIAL", priority: "HIGH", defaultDueDays: 1 },
  { customerType: "DEALER_CLIENT", name: "了解所在城市和门店情况", title: "了解城市和门店情况", description: "确认客户所在城市、门店现状和团队基础。", type: "PHONE_CALL", priority: "NORMAL", defaultDueDays: 2 },
  { customerType: "DEALER_CLIENT", name: "合作负责人沟通", title: "安排合作负责人沟通", description: "由合作主管进一步判断合作可行性。", type: "PHONE_CALL", priority: "HIGH", defaultDueDays: 3 },
  { customerType: "DEALER_CLIENT", name: "邀约现场评估", title: "邀约现场评估", description: "推动合作伙伴现场评估样板和政策。", type: "VISIT_INVITE", priority: "HIGH", defaultDueDays: 5 },
  { customerType: "DEALER_CLIENT", name: "政策确认跟进", title: "政策确认跟进", description: "跟进利润模型、区域保护和签约条件。", type: "DEAL_PUSH", priority: "HIGH", defaultDueDays: 2, stage: "PENDING_DEAL" },
  { customerType: "DESIGNER_CLIENT", name: "发送成功案例", title: "发送意向客户成功案例", description: "发送成功案例，帮助对齐审美方向。", type: "SEND_MATERIAL", priority: "NORMAL", defaultDueDays: 1 },
  { customerType: "DESIGNER_CLIENT", name: "了解客户项目类型", title: "了解客户项目类型", description: "确认意向客户当前项目类型、客户层级和合作边界。", type: "PHONE_CALL", priority: "NORMAL", defaultDueDays: 2 },
  { customerType: "DESIGNER_CLIENT", name: "建立项目合作沟通", title: "建立项目合作沟通", description: "建立项目群或专项协作沟通。", type: "WECHAT_FOLLOW", priority: "HIGH", defaultDueDays: 2 },
  { customerType: "DESIGNER_CLIENT", name: "发送工艺节点", title: "发送工艺节点说明", description: "补充工艺节点和材料搭配说明。", type: "SEND_MATERIAL", priority: "NORMAL", defaultDueDays: 1 },
  { customerType: "DESIGNER_CLIENT", name: "项目报价配合", title: "项目报价配合", description: "在客户项目推进阶段配合报价和深化。", type: "QUOTE_FOLLOW", priority: "HIGH", defaultDueDays: 2, stage: "PENDING_DEAL" },
  { customerType: "FACTORY_CLIENT", name: "发送增长诊断表", title: "发送增长诊断表", description: "发送内部提醒承接自查表和增长诊断表。", type: "SEND_MATERIAL", priority: "HIGH", defaultDueDays: 1 },
  { customerType: "FACTORY_CLIENT", name: "了解企业获客方式", title: "了解企业获客方式", description: "确认企业当前获客、合作和销售协作方式。", type: "PHONE_CALL", priority: "NORMAL", defaultDueDays: 2 },
  { customerType: "FACTORY_CLIENT", name: "判断承接问题", title: "判断承接问题", description: "识别获客到内部提醒承接、销售跟进的主要堵点。", type: "CUSTOM", priority: "HIGH", defaultDueDays: 2 },
  { customerType: "FACTORY_CLIENT", name: "安排深度诊断", title: "安排深度诊断", description: "推进老板或负责人进入深度诊断沟通。", type: "PHONE_CALL", priority: "URGENT", defaultDueDays: 3 },
  { customerType: "FACTORY_CLIENT", name: "推动合作沟通", title: "推动合作沟通", description: "围绕信任建设、企微和管理看板推进合作。", type: "DEAL_PUSH", priority: "URGENT", defaultDueDays: 2, stage: "QUOTED" }
];

const demoBusinessLineSeeds: BusinessLineSeed[] = [
  {
    name: "潜在客户产品服务",
    slug: "owner-wood-customization",
    description: "面向潜在客户的产品服务业务线，重点覆盖案例效果、环保、价格、交付和售后沟通。",
    category: "PRODUCT",
    priority: 10,
    targetCustomerTypes: ["OWNER_CLIENT"],
    recommendedTags: [
      { tagName: "潜在客户", tagGroup: "客户类型标签" },
      { tagName: "效果关注", tagGroup: "需求标签" },
      { tagName: "交付关注", tagGroup: "需求标签" }
    ],
    recommendedMaterialTitles: ["产品服务避坑清单", "成功案例", "交付流程说明", "环保与售后说明"],
    recommendedTaskTemplateNames: ["首次沟通", "发送成功案例", "预约初步方案", "报价后跟进"],
    defaultNextAction: "了解房屋情况、装修阶段和预算区间",
    notes: "适合用于潜在客户咨询、别墅木作和高客单落地沟通。"
  },
  {
    name: "合作伙伴伙伴合作",
    slug: "dealer-investment-cooperation",
    description: "面向合作伙伴的伙伴合作业务线，重点沟通城市、门店基础、政策、利润和现场评估。",
    category: "PARTNERSHIP",
    priority: 20,
    targetCustomerTypes: ["DEALER_CLIENT"],
    recommendedTags: [
      { tagName: "合作伙伴", tagGroup: "客户类型标签" },
      { tagName: "合作意向", tagGroup: "需求标签" },
      { tagName: "合作意向", tagGroup: "业务标签" }
    ],
    recommendedMaterialTitles: ["合作方案", "产品体系说明", "合作政策说明", "样板门店案例"],
    recommendedTaskTemplateNames: ["发送合作资料", "了解所在城市和门店情况", "合作负责人沟通", "邀约现场评估"],
    defaultNextAction: "安排合作负责人沟通或现场评估",
    notes: "适合围绕合作政策、利润模型和样板门店推进。"
  },
  {
    name: "客户项目合作",
    slug: "designer-project-cooperation",
    description: "面向意向客户的项目合作业务线，重点沟通成功案例、工艺节点、材料和项目配合节奏。",
    category: "SERVICE",
    priority: 30,
    targetCustomerTypes: ["DESIGNER_CLIENT"],
    recommendedTags: [
      { tagName: "意向客户", tagGroup: "客户类型标签" },
      { tagName: "案例关注", tagGroup: "需求标签" },
      { tagName: "项目合作意向", tagGroup: "业务标签" }
    ],
    recommendedMaterialTitles: ["成功案例", "工艺节点说明", "材料样册", "方案协作机制"],
    recommendedTaskTemplateNames: ["发送成功案例", "了解客户项目类型", "建立项目合作沟通", "发送工艺节点"],
    defaultNextAction: "了解项目类型、图纸和落地配合要求",
    notes: "适合客户项目协同、工艺解释和材料配合。"
  },
  {
    name: "重点客户增长服务",
    slug: "factory-growth-service",
    description: "面向重点客户的增长服务业务线，重点沟通获客、承接、销售跟进、信任建设和内容增长。",
    category: "SERVICE",
    priority: 40,
    targetCustomerTypes: ["FACTORY_CLIENT"],
    recommendedTags: [
      { tagName: "重点客户", tagGroup: "客户类型标签" },
      { tagName: "增长诊断意向", tagGroup: "业务标签" },
      { tagName: "重点客户增长服务", tagGroup: "业务标签" }
    ],
    recommendedMaterialTitles: ["内部提醒承接自查表", "客户增长诊断表", "信任建设方案", "内容增长说明", "销售协作工作台合作建议"],
    recommendedTaskTemplateNames: ["发送增长诊断表", "了解企业获客方式", "判断承接问题", "安排深度诊断"],
    defaultNextAction: "判断当前卡在获客、承接、成交还是管理看板",
    notes: "适合对外讲客户销售协作工作台和重点客户诊断服务。"
  }
];

const platformBusinessLineSeeds: BusinessLineSeed[] = [
  {
    name: "会员服务",
    slug: "membership-service",
    description: "面向会员意向客户的业务线，重点沟通会员权益、行业背书、信任建设和资源露出。",
    category: "MEMBERSHIP",
    priority: 10,
    targetCustomerTypes: ["PLATFORM_MEMBERSHIP_CLIENT"],
    recommendedTags: [
      { tagName: "会员意向", tagGroup: "业务标签" },
      { tagName: "信任建设关注", tagGroup: "需求标签" },
      { tagName: "联盟合作意向", tagGroup: "业务标签" }
    ],
    recommendedMaterialTitles: ["MarketClaw会员服务说明", "会员权益说明", "客户信任建设方案"],
    recommendedTaskTemplateNames: ["发送会员说明", "安排会员沟通", "发送报价", "续费提醒"],
    defaultNextAction: "发送会员说明并判断适合基础增信还是高阶服务",
    notes: "适合围绕MarketClaw会员、增信与行业背书推进。"
  },
  {
    name: "内容增长",
    slug: "geo-ai-promotion",
    description: "面向内容增长、AI 搜索和品牌可见性客户的业务线，重点沟通 AI 搜索可见性、关键词、收录与诊断。",
    category: "SERVICE",
    priority: 20,
    targetCustomerTypes: ["PLATFORM_GEO_AI_CLIENT", "PLATFORM_FACTORY_OWNER"],
    recommendedTags: [
      { tagName: "内容增长意向", tagGroup: "业务标签" },
      { tagName: "AI推广关注", tagGroup: "需求标签" },
      { tagName: "待诊断", tagGroup: "阶段标签" },
      { tagName: "内容增长方案待发", tagGroup: "业务标签" }
    ],
    recommendedMaterialTitles: ["内容增长服务说明", "品牌增长方案", "内容可见性自查表", "内容底座说明"],
    recommendedTaskTemplateNames: ["发送内容增长方案", "安排增长诊断", "发送报价"],
    defaultNextAction: "先安排一次 AI 可见性诊断，再判断是否进入内容增长服务",
    notes: "适合重点客户和内容增长意向客户。"
  },
  {
    name: "活动合作",
    slug: "wuzhen-design-week",
    description: "面向活动资源客户的业务线，重点沟通活动合作、峰会、榜单、白皮书和品牌露出。",
    category: "ACTIVITY",
    priority: 30,
    targetCustomerTypes: ["PLATFORM_EVENT_RESOURCE_CLIENT", "PLATFORM_FACTORY_OWNER"],
    recommendedTags: [
      { tagName: "活动资源关注", tagGroup: "需求标签" },
      { tagName: "活动资源意向", tagGroup: "业务标签" },
      { tagName: "品牌露出关注", tagGroup: "需求标签" }
    ],
    recommendedMaterialTitles: ["活动合作说明", "行业峰会资源说明", "品牌露出权益说明"],
    recommendedTaskTemplateNames: ["邀请参加活动", "活动资源跟进"],
    defaultNextAction: "判断客户更看重露出、背书还是资源链接",
    notes: "适合围绕活动合作与行业活动露出沟通。"
  },
  {
    name: "培训课程",
    slug: "training-course",
    description: "面向培训课程客户的业务线，重点沟通课程内容、适合对象、实操和报名节奏。",
    category: "COURSE",
    priority: 40,
    targetCustomerTypes: ["PLATFORM_TRAINING_CLIENT"],
    recommendedTags: [
      { tagName: "培训意向", tagGroup: "业务标签" },
      { tagName: "课程报名关注", tagGroup: "需求标签" }
    ],
    recommendedMaterialTitles: ["培训课程介绍", "课程介绍", "课纲", "适合对象"],
    recommendedTaskTemplateNames: ["提醒报名课程"],
    defaultNextAction: "确认参训角色并发送课纲",
    notes: "适合老板课、团队课和训练营报名沟通。"
  },
  {
    name: "集采供应链",
    slug: "supply-chain",
    description: "面向供应链与集采客户的业务线，重点沟通采购品类、标准、价格、质量保障和合作流程。",
    category: "SUPPLY_CHAIN",
    priority: 50,
    targetCustomerTypes: ["PLATFORM_SUPPLY_CHAIN_CLIENT"],
    recommendedTags: [
      { tagName: "集采供应链", tagGroup: "业务标签" },
      { tagName: "质量保障关注", tagGroup: "需求标签" }
    ],
    recommendedMaterialTitles: ["集采合作说明", "产品标准说明", "质量保障机制", "合作流程"],
    recommendedTaskTemplateNames: ["集采合作跟进"],
    defaultNextAction: "确认采购品类和合作流程",
    notes: "适合集采、供应链和标准品合作沟通。"
  },
  {
    name: "一清一护",
    slug: "aftermarket-service",
    description: "面向一清一护后市场客户的业务线，重点沟通门店合作、服务 SOP、项目模式和私域转化。",
    category: "SERVICE",
    priority: 60,
    targetCustomerTypes: ["PLATFORM_AFTERMARKET_CLIENT"],
    recommendedTags: [
      { tagName: "一清一护", tagGroup: "业务标签" },
      { tagName: "后市场意向", tagGroup: "业务标签" },
      { tagName: "门店合作意向", tagGroup: "需求标签" }
    ],
    recommendedMaterialTitles: ["一清一护门店合作说明", "门店合作模式", "上门服务 SOP", "私域转化方案"],
    recommendedTaskTemplateNames: ["一清一护项目沟通"],
    defaultNextAction: "判断门店基础并发送项目合作说明",
    notes: "适合后市场项目、门店合作和上门服务沟通。"
  },
  {
    name: "信任建设",
    slug: "brand-trust",
    description: "面向信任建设客户的业务线，重点沟通行业背书、声望增长、可见性和品牌内容沉淀。",
    category: "SERVICE",
    priority: 70,
    targetCustomerTypes: ["PLATFORM_FACTORY_OWNER", "PLATFORM_MEMBERSHIP_CLIENT", "PLATFORM_GEO_AI_CLIENT"],
    recommendedTags: [
      { tagName: "信任建设关注", tagGroup: "需求标签" },
      { tagName: "待诊断", tagGroup: "阶段标签" }
    ],
    recommendedMaterialTitles: ["客户信任建设方案", "品牌增长方案"],
    recommendedTaskTemplateNames: ["安排增长诊断", "发送报价"],
    defaultNextAction: "判断客户更需要背书、露出还是搜索可见性增信",
    notes: "适合和会员、内容增长、重点客户老板路径做联动。"
  },
  {
    name: "联盟合作",
    slug: "alliance-partnership",
    description: "面向合作伙伴客户的业务线，重点沟通资源互换、联合活动、内容共创和试合作边界。",
    category: "PARTNERSHIP",
    priority: 80,
    targetCustomerTypes: ["PLATFORM_PARTNER_CLIENT", "PLATFORM_MEMBERSHIP_CLIENT"],
    recommendedTags: [
      { tagName: "联盟合作", tagGroup: "业务标签" },
      { tagName: "内容共创", tagGroup: "业务标签" }
    ],
    recommendedMaterialTitles: ["销售协作伙伴计划说明", "合作伙伴说明", "资源共创方案", "合作边界说明"],
    recommendedTaskTemplateNames: ["活动资源跟进", "沉默客户激活"],
    defaultNextAction: "安排合作沟通并明确双方资源边界",
    notes: "适合平台合作伙伴与资源共创场景。"
  },
  {
    name: "CNAS认可指南",
    slug: "cnas-guide",
    description: "用于承接 CNAS 认可相关咨询线索，通过路径判断问卷识别实验室类型、当前阶段、风险点和启动意向，帮助顾问进行初步分层和跟进。",
    category: "SERVICE",
    priority: 90,
    targetCustomerTypes: ["OTHER"],
    recommendedTags: [
      { tagName: "CNAS认可指南", tagGroup: "业务标签" },
      { tagName: "检测实验室", tagGroup: "客户类型标签" },
      { tagName: "校准实验室", tagGroup: "客户类型标签" },
      { tagName: "企业内检实验室", tagGroup: "客户类型标签" },
      { tagName: "第三方实验室", tagGroup: "客户类型标签" },
      { tagName: "阶段了解", tagGroup: "阶段标签" },
      { tagName: "阶段建设", tagGroup: "阶段标签" },
      { tagName: "阶段体系文件", tagGroup: "阶段标签" },
      { tagName: "阶段准备申请", tagGroup: "阶段标签" },
      { tagName: "阶段评审整改", tagGroup: "阶段标签" },
      { tagName: "风险周期", tagGroup: "风险标签" },
      { tagName: "风险费用", tagGroup: "风险标签" },
      { tagName: "风险材料", tagGroup: "风险标签" },
      { tagName: "风险人员设备", tagGroup: "风险标签" },
      { tagName: "风险评审", tagGroup: "风险标签" },
      { tagName: "风险返工", tagGroup: "风险标签" },
      { tagName: "高意向", tagGroup: "业务标签" },
      { tagName: "中意向", tagGroup: "业务标签" },
      { tagName: "低意向", tagGroup: "业务标签" }
    ],
    recommendedMaterialTitles: [
      "CNAS认可基础认知手册",
      "CNAS认可和CNAS认证有什么区别",
      "CNAS认可启动前自查清单",
      "实验室建设准备重点表",
      "CNAS体系文件与真实运行检查表",
      "CNAS评审前风险检查清单",
      "CNAS整改闭环问题清单",
      "CNAS企业微信欢迎语模板"
    ],
    recommendedTaskTemplateNames: ["CNAS高意向路径梳理", "CNAS基础条件核对", "CNAS内容培育跟进"],
    defaultNextAction: "根据问卷结果判断是否适合进入 30 分钟认可路径梳理。",
    notes: "用于在MarketClaw 平台租户中承接 CNAS 专业服务线索，不单独新开系统。"
  }
];

const zhengmuLeads: LeadTemplate[] = [
  {
    id: "demo-lead-001",
    name: "陈先生",
    phone: "13800000001",
    wechat: "chen-villa",
    city: "杭州",
    source: "douyin",
    customerType: "OWNER_CLIENT",
    needType: "BOOK_CONSULTATION",
    intentionLevel: "STRONG",
    stage: "NEW",
    owner: "sales",
    message: "抖音看到别墅客户增长案例，希望尽快沟通整体效果和环保方案。",
    followUp: {
      content: "客户已经确认想先看真实案例，并愿意补充户型图和装修时间表。",
      nextAction: "发送成功案例并收集户型",
      stageBefore: "NEW",
      stageAfter: "NEW",
      createdDaysAgo: 1,
      nextFollowOffsetDays: 1
    },
    task: {
      title: "潜在客户首次沟通：陈先生",
      description: "确认户型、预算和环保需求，准备进入初步方案沟通。",
      type: "FIRST_FOLLOW",
      status: "PENDING",
      priority: "URGENT",
      dueOffsetDays: 0
    }
  },
  {
    id: "demo-lead-002",
    name: "李女士",
    phone: "13800000002",
    wechat: "li-home",
    city: "苏州",
    source: "xiaohongshu",
    customerType: "OWNER_CLIENT",
    needType: "GET_MATERIAL",
    intentionLevel: "HIGH",
    stage: "MATERIAL_SENT",
    owner: "sales",
    message: "小红书咨询环保与售后，希望先看成功案例和交付说明。",
    followUp: {
      content: "已发送成功案例和环保说明，客户正在确认房屋面积和装修阶段。",
      nextAction: "了解房屋面积和装修阶段",
      stageBefore: "NEW",
      stageAfter: "MATERIAL_SENT",
      createdDaysAgo: 2,
      nextFollowOffsetDays: 0
    },
    task: {
      title: "发送成功案例：李女士",
      description: "继续跟进潜在客户对案例、环保和售后说明的反馈。",
      type: "SEND_MATERIAL",
      status: "PENDING",
      priority: "HIGH",
      dueOffsetDays: 0
    }
  },
  {
    id: "demo-lead-003",
    name: "周总",
    phone: "13800000003",
    wechat: "zhou-dealer",
    company: "合肥某高客单馆",
    industry: "客户增长门店",
    city: "合肥",
    source: "shipinhao",
    customerType: "DEALER_CLIENT",
    needType: "INVESTMENT_JOIN",
    intentionLevel: "HIGH",
    stage: "CONTACTED",
    owner: "sales",
    message: "视频号看到合作内容，重点关注区域政策、利润和样板门店支持。",
    followUp: {
      content: "已沟通所在城市和门店现状，客户希望先看合作资料和合作政策。",
      nextAction: "发送合作资料",
      stageBefore: "NEW",
      stageAfter: "CONTACTED",
      createdDaysAgo: 3,
      nextFollowOffsetDays: 0
    },
    task: {
      title: "发送合作资料：周总",
      description: "发送合作方案、产品体系和合作政策，并约定下一次沟通。",
      type: "SEND_MATERIAL",
      status: "PENDING",
      priority: "HIGH",
      dueOffsetDays: 0
    }
  },
  {
    id: "demo-lead-004",
    name: "王总",
    phone: "13800000004",
    wechat: "wang-design",
    company: "南京木语设计",
    industry: "室内设计",
    city: "南京",
    source: "friend_circle",
    customerType: "DESIGNER_CLIENT",
    needType: "COOPERATION",
    intentionLevel: "MEDIUM",
    stage: "DIAGNOSED",
    owner: "operator",
    message: "朋友圈咨询高客单项目配合，希望确认工艺节点和设计落地能力。",
    followUp: {
      content: "已经确认项目在方案阶段，意向客户希望先看工艺节点和材料样册。",
      nextAction: "发送工艺节点说明",
      stageBefore: "CONTACTED",
      stageAfter: "DIAGNOSED",
      createdDaysAgo: 2,
      nextFollowOffsetDays: 2
    },
    task: {
      title: "发送成功案例：王总",
      description: "补充成功案例、材料样册和项目配合机制。",
      type: "SEND_MATERIAL",
      status: "PENDING",
      priority: "NORMAL",
      dueOffsetDays: 2
    }
  },
  {
    id: "demo-lead-005",
    name: "赵厂长",
    phone: "13800000005",
    wechat: "zhao-factory",
    company: "佛山某重点客户",
    industry: "客户增长制造",
    city: "佛山",
    source: "website",
    customerType: "FACTORY_CLIENT",
    needType: "GROWTH_SYSTEM",
    intentionLevel: "STRONG",
    stage: "QUOTED",
    owner: "admin",
    message: "官网留资，想搭企业微信承接、管理看板和内容增长协同。",
    followUp: {
      content: "已完成初步诊断并发送合作建议，客户正在评估深度合作范围。",
      nextAction: "推动合作沟通",
      stageBefore: "DIAGNOSED",
      stageAfter: "QUOTED",
      createdDaysAgo: 1,
      nextFollowOffsetDays: 1
    },
    task: {
      title: "安排深度诊断：赵厂长",
      description: "围绕内部提醒承接、管理看板和内容增长推进深度诊断。",
      type: "DEAL_PUSH",
      status: "PENDING",
      priority: "URGENT",
      dueOffsetDays: 0
    }
  },
  {
    id: "demo-lead-006",
    name: "吴经理",
    phone: "13800000006",
    wechat: "wu-channel",
    company: "成都某客户增长馆",
    industry: "合作伙伴",
    city: "成都",
    source: "referral",
    customerType: "DEALER_CLIENT",
    needType: "ASK_PRICE",
    intentionLevel: "MEDIUM",
    stage: "PENDING_DEAL",
    owner: "sales",
    message: "老客户转介绍，重点想了解政策细节、利润模型和样板支持。",
    followUp: {
      content: "已经沟通政策边界和门店预算，客户需要进一步确认签约条件。",
      nextAction: "政策确认跟进",
      stageBefore: "CONTACTED",
      stageAfter: "PENDING_DEAL",
      createdDaysAgo: 4,
      nextFollowOffsetDays: -1
    },
    task: {
      title: "政策确认跟进：吴经理",
      description: "继续推进利润模型、区域保护和签约节奏。",
      type: "DEAL_PUSH",
      status: "PENDING",
      priority: "HIGH",
      dueOffsetDays: -1
    }
  },
  {
    id: "demo-lead-007",
    name: "郑先生",
    phone: "13800000007",
    wechat: "zheng-owner",
    city: "宁波",
    source: "offline_event",
    customerType: "OWNER_CLIENT",
    needType: "PRODUCT_INQUIRY",
    intentionLevel: "LOW",
    stage: "TO_REACTIVATE",
    owner: "sales",
    message: "线下活动留资，之前看过案例后暂时搁置，近期准备重新启动装修。",
    followUp: {
      content: "客户沉默 2 周后回复，表示近期可能重新评估方案和预算。",
      nextAction: "15 天沉默激活",
      stageBefore: "MATERIAL_SENT",
      stageAfter: "TO_REACTIVATE",
      createdDaysAgo: 7,
      nextFollowOffsetDays: -2
    },
    task: {
      title: "15 天沉默激活：郑先生",
      description: "重新唤醒潜在客户，确认近期装修进展和沟通意愿。",
      type: "REACTIVATE",
      status: "PENDING",
      priority: "LOW",
      dueOffsetDays: -2
    }
  },
  {
    id: "demo-lead-008",
    name: "孙总",
    phone: "13800000008",
    wechat: "sun-growth",
    company: "湖州某木作重点客户",
    industry: "客户增长制造",
    city: "湖州",
    source: "referral",
    customerType: "FACTORY_CLIENT",
    needType: "BOOK_CONSULTATION",
    intentionLevel: "HIGH",
    stage: "DEAL_DONE",
    owner: "sales",
    message: "转介绍客户，已完成增长诊断合作，准备进入系统搭建阶段。",
    followUp: {
      content: "已确认管理看板和内部提醒承接方案，客户对阶段合作结果满意。",
      nextAction: "沉淀案例并准备二期方案",
      stageBefore: "PENDING_DEAL",
      stageAfter: "DEAL_DONE",
      createdDaysAgo: 3,
      nextFollowOffsetDays: null
    },
    task: {
      title: "推动合作沟通：孙总",
      description: "该重点客户已进入已成交状态，任务用于演示已完成阶段。",
      type: "DEAL_PUSH",
      status: "DONE",
      priority: "HIGH",
      dueOffsetDays: -3,
      completedOffsetDays: -2
    }
  },
  {
    id: "demo-lead-009",
    name: "林女士",
    phone: "13800000009",
    wechat: "lin-owner",
    company: "上海某私宅",
    city: "上海",
    source: "website",
    customerType: "OWNER_CLIENT",
    needType: "ASK_PRICE",
    intentionLevel: "MEDIUM",
    stage: "QUOTED",
    owner: "admin",
    message: "官网咨询客户增长报价，重点比较效果落地、环保等级和预算边界。",
    followUp: {
      content: "已完成报价说明，客户正在和意向客户确认材料与预算方案。",
      nextAction: "报价后跟进",
      stageBefore: "DIAGNOSED",
      stageAfter: "QUOTED",
      createdDaysAgo: 2,
      nextFollowOffsetDays: 2
    },
    task: {
      title: "报价后跟进：林女士",
      description: "继续跟进环保、售后和报价细节，争取推进方案确认。",
      type: "QUOTE_FOLLOW",
      status: "DELAYED",
      priority: "HIGH",
      dueOffsetDays: 2
    }
  },
  {
    id: "demo-lead-010",
    name: "何总",
    phone: "13800000010",
    wechat: "he-dealer",
    company: "苏南某客户增长馆",
    industry: "经销门店",
    city: "无锡",
    source: "gongzhonghao",
    customerType: "DEALER_CLIENT",
    needType: "COOPERATION",
    intentionLevel: "STRONG",
    stage: "DIAGNOSED",
    owner: "operator",
    message: "公众号看完合作文章后留资，想评估样板门店和总部支持力度。",
    followUp: {
      content: "已沟通门店现状和预算，下一步要安排合作主管深聊合作条件。",
      nextAction: "合作负责人沟通",
      stageBefore: "CONTACTED",
      stageAfter: "DIAGNOSED",
      createdDaysAgo: 1,
      nextFollowOffsetDays: 3
    },
    task: {
      title: "合作负责人沟通：何总",
      description: "安排合作主管进一步讲解合作政策和样板门店支持。",
      type: "PHONE_CALL",
      status: "PENDING",
      priority: "URGENT",
      dueOffsetDays: 3
    }
  },
  {
    id: "demo-lead-011",
    name: "马总",
    phone: "13800000011",
    wechat: "ma-dealer",
    company: "鲁南某高客单馆",
    industry: "经销门店",
    city: "临沂",
    source: "offline_event",
    customerType: "DEALER_CLIENT",
    needType: "INVESTMENT_JOIN",
    intentionLevel: "LOW",
    stage: "DEAL_DONE",
    owner: "admin",
    message: "展会成交客户，已经完成现场评估和签约演示案例。",
    followUp: {
      content: "已完成现场评估和政策确认，客户进入签约落地阶段。",
      nextAction: "交接总部启动支持",
      stageBefore: "PENDING_DEAL",
      stageAfter: "DEAL_DONE",
      createdDaysAgo: 5,
      nextFollowOffsetDays: null
    },
    task: {
      title: "邀约现场评估：马总",
      description: "该合作伙伴已成交，任务用于演示合作伙伴路线的已完成状态。",
      type: "VISIT_INVITE",
      status: "DONE",
      priority: "NORMAL",
      dueOffsetDays: -4,
      completedOffsetDays: -3
    }
  },
  {
    id: "demo-lead-012",
    name: "许经理",
    phone: "13800000012",
    wechat: "xu-design",
    company: "杭州木意设计",
    industry: "室内设计",
    city: "杭州",
    source: "xiaohongshu",
    customerType: "DESIGNER_CLIENT",
    needType: "GET_MATERIAL",
    intentionLevel: "HIGH",
    stage: "NEW",
    owner: "sales",
    message: "小红书看到成功案例，希望先看成功案例和合作机制。",
    followUp: {
      content: "意向客户先想看项目案例和材料样册，后续再评估是否建立项目合作沟通。",
      nextAction: "发送成功案例",
      stageBefore: "NEW",
      stageAfter: "NEW",
      createdDaysAgo: 1,
      nextFollowOffsetDays: 0
    },
    task: {
      title: "发送成功案例：许经理",
      description: "先发成功案例和方案协作机制，帮助意向客户建立第一印象。",
      type: "SEND_MATERIAL",
      status: "PENDING",
      priority: "HIGH",
      dueOffsetDays: 0
    }
  },
  {
    id: "demo-lead-013",
    name: "顾老师",
    phone: "13800000013",
    wechat: "gu-designer",
    company: "苏州顾问设计",
    industry: "室内设计",
    city: "苏州",
    source: "referral",
    customerType: "DESIGNER_CLIENT",
    needType: "COOPERATION",
    intentionLevel: "STRONG",
    stage: "CONTACTED",
    owner: "sales",
    message: "同行转介绍，希望建立长期项目合作和报价配合机制。",
    followUp: {
      content: "已确认近期有高客单项目在推进，希望建立专项沟通并共享工艺节点。",
      nextAction: "建立项目合作沟通",
      stageBefore: "NEW",
      stageAfter: "CONTACTED",
      createdDaysAgo: 3,
      nextFollowOffsetDays: -1
    },
    task: {
      title: "建立项目合作沟通：顾老师",
      description: "创建项目沟通节奏，推进工艺、报价和材料协作。",
      type: "WECHAT_FOLLOW",
      status: "PENDING",
      priority: "URGENT",
      dueOffsetDays: -1
    }
  },
  {
    id: "demo-lead-014",
    name: "唐总",
    phone: "13800000014",
    wechat: "tang-design",
    company: "宁波观木设计",
    industry: "室内设计",
    city: "宁波",
    source: "offline_event",
    customerType: "DESIGNER_CLIENT",
    needType: "ASK_PRICE",
    intentionLevel: "LOW",
    stage: "PENDING_DEAL",
    owner: "admin",
    message: "活动现场沟通过工艺和材料，希望项目报价时获得配合支持。",
    followUp: {
      content: "客户已经提供项目风格参考，等待报价配合和材料建议。",
      nextAction: "项目报价配合",
      stageBefore: "DIAGNOSED",
      stageAfter: "PENDING_DEAL",
      createdDaysAgo: 4,
      nextFollowOffsetDays: 3
    },
    task: {
      title: "项目报价配合：唐总",
      description: "配合意向客户完成项目报价和材料细节确认。",
      type: "QUOTE_FOLLOW",
      status: "PENDING",
      priority: "NORMAL",
      dueOffsetDays: 3
    }
  },
  {
    id: "demo-lead-015",
    name: "宋总",
    phone: "13800000015",
    wechat: "song-growth",
    company: "广州某重点客户",
    industry: "客户增长制造",
    city: "广州",
    source: "gongzhonghao",
    customerType: "FACTORY_CLIENT",
    needType: "GROWTH_SYSTEM",
    intentionLevel: "MEDIUM",
    stage: "MATERIAL_SENT",
    owner: "sales",
    message: "公众号咨询信任建设和内容增长，希望先看诊断表和承接自查表。",
    followUp: {
      content: "已经发送增长诊断表和内部提醒承接自查表，客户准备梳理现有渠道数据。",
      nextAction: "了解企业获客方式",
      stageBefore: "NEW",
      stageAfter: "MATERIAL_SENT",
      createdDaysAgo: 2,
      nextFollowOffsetDays: 2
    },
    task: {
      title: "发送增长诊断表：宋总",
      description: "继续跟进重点客户对承接自查表和诊断表的反馈。",
      type: "SEND_MATERIAL",
      status: "DELAYED",
      priority: "NORMAL",
      dueOffsetDays: 2
    }
  },
  {
    id: "demo-lead-016",
    name: "吕厂",
    phone: "13800000016",
    wechat: "lv-factory",
    company: "绍兴某木作重点客户",
    industry: "客户增长制造",
    city: "绍兴",
    source: "shipinhao",
    customerType: "FACTORY_CLIENT",
    needType: "GROWTH_SYSTEM",
    intentionLevel: "LOW",
    stage: "TO_REACTIVATE",
    owner: "sales",
    message: "视频号咨询过管理看板和内容增长，但近期沟通中断，需要重新激活。",
    followUp: {
      content: "客户暂时搁置项目，近期重新启动信任建设和渠道承接梳理。",
      nextAction: "判断承接问题",
      stageBefore: "CONTACTED",
      stageAfter: "TO_REACTIVATE",
      createdDaysAgo: 8,
      nextFollowOffsetDays: -3
    },
    task: {
      title: "判断承接问题：吕厂",
      description: "重新梳理重点客户的内部提醒承接和销售协作问题。",
      type: "CUSTOM",
      status: "PENDING",
      priority: "LOW",
      dueOffsetDays: -3
    }
  }
];

const platformStrategyTemplates: StrategyTemplate[] = [
  {
    customerType: "PLATFORM_FACTORY_OWNER",
    name: "重点客户跟进策略",
    painPoints: ["获客", "合作", "品牌", "成交", "行业背书", "AI 推广", "企业微信承接"],
    firstMaterials: ["客户增长诊断表", "客户信任建设方案", "客户跟进与销售协作工作台说明", "内容增长服务说明", "销售协作伙伴计划说明"],
    welcomeScript: "先发您增长诊断表和信任建设方案，方便先判断现在更卡在客户来源、品牌信任，还是内部提醒承接和销售跟进。",
    day3Script: "您现在更想先补获客、信任建设，还是销售跟进这条线？我可以按这个方向给您收一版建议。",
    day7Script: "如果方便，您可以先说一下主要渠道和销售现状，我再判断先做内容增长、内部提醒承接，还是先做管理看板。",
    day15Script: "如果近期准备系统化推进，建议先安排一次增长诊断，把获客、承接和成交链路看清楚。",
    manualTriggerRules: ["问合作费用", "问内容增长", "问内部提醒承接", "问信任建设", "约老板沟通"],
    recommendedNextAction: "安排一次增长诊断",
    recommendedPrivateContent: "增长诊断表、信任建设方案、内部提醒承接说明、内容增长服务说明、联盟说明"
  },
  {
    customerType: "PLATFORM_MEMBERSHIP_CLIENT",
    name: "会员意向客户跟进策略",
    painPoints: ["加入MarketClaw有什么用", "能否提升信任", "有没有资源露出", "是否有客户转化", "和普通广告有什么区别"],
    firstMaterials: ["MarketClaw会员服务说明", "基础增信服务清单", "声望增长服务清单", "会员权益说明", "MarketClaw行业增信价值说明"],
    welcomeScript: "先把会员服务说明和权益发您，方便您先判断现在更需要增信、露出，还是客户承接支持。",
    day3Script: "您现在更想解决品牌背书、资源露出，还是客户转化问题？我可以按这个方向帮您收口。",
    day7Script: "如果方便，我建议先按基础增信、声望增长和高阶服务三档对一下，判断哪一档更适合。",
    day15Script: "如果近期准备推进会员合作，建议安排一次会员沟通，把权益边界和适合的服务层级讲清楚。",
    manualTriggerRules: ["问会员费用", "问会员权益", "问增信", "问露出", "问和广告区别"],
    recommendedNextAction: "发送会员说明并推进会员沟通",
    recommendedPrivateContent: "会员服务说明、权益说明、增信价值说明、服务分层建议"
  },
  {
    customerType: "PLATFORM_GEO_AI_CLIENT",
    name: "内容增长客户跟进策略",
    painPoints: ["什么是内容增长", "AI 搜索为什么重要", "能不能被 AI 推荐", "和 SEO、代运营有什么区别", "多久能看到变化"],
    firstMaterials: ["内容增长服务说明", "品牌增长方案", "内容可见性自查表", "内容底座说明"],
    welcomeScript: "先发您内容增长服务说明和 AI 搜索可见性自查表，方便先看品牌现在在哪些关键词和场景上不够可见。",
    day3Script: "您现在更关心 AI 推荐、品牌收录，还是关键词布局？我可以按这个方向帮您继续拆。",
    day7Script: "如果方便，先把品牌关键词和现在做过的内容方向说一下，我判断是否适合先做内容增长诊断。",
    day15Script: "如果近期准备推进，建议先做一次 AI 可见性诊断，再决定是先补内容底座还是直接开内容增长。",
    manualTriggerRules: ["问内容增长", "问 AI 搜索", "问 SEO 区别", "问收录", "问关键词"],
    recommendedNextAction: "先做 AI 可见性诊断",
    recommendedPrivateContent: "内容增长服务说明、AI 搜索自查表、关键词说明、信任建设方案"
  },
  {
    customerType: "PLATFORM_TRAINING_CLIENT",
    name: "培训课程客户跟进策略",
    painPoints: ["课程讲什么", "适合谁", "有没有实操", "参加后能带回什么", "老板和团队参加是否有价值"],
    firstMaterials: ["培训课程介绍", "课程课纲", "适合对象说明", "往期问题清单", "报名说明"],
    welcomeScript: "先发您课程介绍和课纲，方便您先判断更适合老板参加、销售参加，还是团队一起参加。",
    day3Script: "您现在更关心课程内容、实操部分，还是参训对象匹配？我可以按这个方向帮您推荐。",
    day7Script: "如果方便，先说一下准备谁来参加、想解决什么问题，我再判断哪一场更适合。",
    day15Script: "如果近期准备报名，建议先把参训角色和目标收清楚，这样课程价值会更容易落地。",
    manualTriggerRules: ["问课纲", "问老师", "问报名", "问适合谁", "问课后服务"],
    recommendedNextAction: "发送课纲并推动报名",
    recommendedPrivateContent: "课程介绍、课纲、适合对象、报名说明、往期问题清单"
  },
  {
    customerType: "PLATFORM_EVENT_RESOURCE_CLIENT",
    name: "活动／活动资源客户跟进策略",
    painPoints: ["参与活动有什么价值", "有没有峰会、榜单、白皮书", "能否提升行业影响力", "有没有客户和资源链接"],
    firstMaterials: ["活动合作说明", "行业峰会资源说明", "榜单与趋势发布说明", "品牌露出权益说明"],
    welcomeScript: "先发您活动和峰会资源说明，方便先判断您更想要品牌露出、行业背书，还是客户资源链接。",
    day3Script: "您现在更想看活动露出权益、榜单趋势发布，还是资源对接方式？我按这个方向给您细化。",
    day7Script: "如果方便，先说一下这次更想拿曝光、背书，还是资源链接，我再给您对应资源包。",
    day15Script: "如果准备推进活动合作，建议安排一次资源沟通，把节点、权益和后续承接讲清楚。",
    manualTriggerRules: ["问活动", "问峰会", "问榜单", "问白皮书", "问露出"],
    recommendedNextAction: "发送资源包并安排活动合作沟通",
    recommendedPrivateContent: "活动说明、峰会资源、榜单与趋势发布、品牌露出权益"
  },
  {
    customerType: "PLATFORM_SUPPLY_CHAIN_CLIENT",
    name: "供应链／集采客户跟进策略",
    painPoints: ["产品是否靠谱", "价格是否有优势", "质量怎么保障", "出了问题谁负责", "合作流程是什么"],
    firstMaterials: ["集采合作说明", "产品标准说明", "质量保障机制", "合作流程说明"],
    welcomeScript: "先发您集采合作说明和产品标准，方便先判断现在更关心价格、标准，还是质量和责任边界。",
    day3Script: "您现在更想先看采购品类、合作流程，还是质量保障这块？我可以按这个方向继续细化。",
    day7Script: "如果方便，先说一下采购品类和合作量级，我再判断更适合先对标准还是先对流程。",
    day15Script: "如果准备推进，建议安排一次供应链对接，把品类、流程和交付责任边界先讲明白。",
    manualTriggerRules: ["问集采价格", "问产品标准", "问质量保障", "问合作流程", "问责任边界"],
    recommendedNextAction: "安排供应链对接",
    recommendedPrivateContent: "集采说明、产品标准、质量保障、合作流程"
  },
  {
    customerType: "PLATFORM_AFTERMARKET_CLIENT",
    name: "一清一护后市场客户跟进策略",
    painPoints: ["项目怎么做", "门店怎么接", "客户从哪里来", "服务怎么标准化", "利润空间怎么样", "品牌背书是什么"],
    firstMaterials: ["一清一护项目说明", "门店合作模式", "上门服务 SOP", "私域转化方案", "全球严选产品说明"],
    welcomeScript: "先发您一清一护项目说明和门店合作模式，方便先判断门店基础、服务能力和合作方式是否匹配。",
    day3Script: "您现在更想先看门店合作模式、SOP，还是项目收益和转化方式？我按这个方向给您细化。",
    day7Script: "如果方便，先说一下门店现状和服务能力，我再判断更适合先做项目沟通还是先做门店评估。",
    day15Script: "如果准备推进，建议安排一次项目沟通，把门店基础、服务动作和私域转化路径讲清楚。",
    manualTriggerRules: ["问一清一护", "问门店合作", "问上门服务", "问后市场", "问利润空间"],
    recommendedNextAction: "发送合作说明并安排项目沟通",
    recommendedPrivateContent: "项目说明、门店合作模式、上门服务 SOP、私域转化方案"
  },
  {
    customerType: "PLATFORM_PARTNER_CLIENT",
    name: "合作伙伴客户跟进策略",
    painPoints: ["能否资源互换", "能否联合活动", "能否共同开发客户", "合作边界是什么"],
    firstMaterials: ["合作伙伴说明", "资源共创方案", "活动共建说明", "合作边界说明"],
    welcomeScript: "先发您合作伙伴说明和资源共创方案，方便先判断更适合资源互换、联合活动，还是先做小范围试合作。",
    day3Script: "您现在更想先谈资源互换、内容共创，还是客户协同？我按这个方向给您细化。",
    day7Script: "如果方便，先说一下您能提供的资源和希望获得的资源，我再判断先从哪种合作方式起步更稳。",
    day15Script: "如果准备推进，建议安排一次合作沟通，把资源、边界和试合作范围先定清楚。",
    manualTriggerRules: ["问合作伙伴", "问资源互换", "问联合活动", "问共创", "问边界"],
    recommendedNextAction: "安排合作沟通并推进试合作",
    recommendedPrivateContent: "合作伙伴说明、资源共创方案、活动共建说明、边界说明"
  }
];

const platformMaterialTemplates: MaterialTemplate[] = [
  { customerType: "PLATFORM_MEMBERSHIP_CLIENT", title: "MarketClaw会员服务说明", description: "说明 MarketClaw会员服务的核心结构、适合对象和合作边界。", url: "https://example.com/platform-membership-overview" },
  { customerType: "PLATFORM_MEMBERSHIP_CLIENT", title: "基础增信服务清单", description: "适合先建立行业背书和基础增信认知。", url: "https://example.com/platform-membership-basic-trust" },
  { customerType: "PLATFORM_MEMBERSHIP_CLIENT", title: "声望增长服务清单", description: "适合进一步强化品牌声望和行业影响力。", url: "https://example.com/platform-membership-prestige" },
  { customerType: "PLATFORM_MEMBERSHIP_CLIENT", title: "会员权益说明", description: "梳理会员可获得的增信、露出和业务协同权益。", url: "https://example.com/platform-membership-rights" },
  { customerType: "PLATFORM_MEMBERSHIP_CLIENT", title: "MarketClaw行业增信价值说明", description: "帮助客户理解MarketClaw在行业背书和品牌信任上的价值。", url: "https://example.com/platform-membership-trust-value" },
  { customerType: "PLATFORM_FACTORY_OWNER", title: "客户信任建设方案", description: "围绕品牌背书、行业信任和内容资产沉淀给出增信建议。", url: "https://example.com/platform-factory-brand-trust" },
  { customerType: "PLATFORM_FACTORY_OWNER", title: "客户跟进与销售协作工作台说明", description: "说明 MarketClaw如何用内部提醒承接、销售跟进和管理看板跑清业务过程。", url: "https://example.com/platform-growth-hub" },
  { customerType: "PLATFORM_FACTORY_OWNER", title: "客户增长诊断表", description: "用于判断重点客户当前是卡在线索、承接、品牌还是成交。", url: "https://example.com/platform-growth-diagnosis" },
  { customerType: "PLATFORM_FACTORY_OWNER", title: "销售协作伙伴计划说明", description: "说明联盟合作、资源链接和产业协同的基本框架。", url: "https://example.com/platform-growth-alliance" },
  { customerType: "PLATFORM_GEO_AI_CLIENT", title: "内容增长服务说明", description: "说明 AI 搜索时代内容增长的基本思路、服务边界和适用对象。", url: "https://example.com/platform-geo-service" },
  { customerType: "PLATFORM_GEO_AI_CLIENT", title: "品牌增长方案", description: "帮助客户理解品牌信任与 AI 推荐之间的关系。", url: "https://example.com/platform-ai-brand-trust" },
  { customerType: "PLATFORM_GEO_AI_CLIENT", title: "内容可见性自查表", description: "用于判断品牌在 AI 搜索入口中的基础可见性。", url: "https://example.com/platform-ai-visibility-check" },
  { customerType: "PLATFORM_GEO_AI_CLIENT", title: "内容底座说明", description: "说明内容增长前期关键词、内容底座和品牌资料整理方法。", url: "https://example.com/platform-keyword-content-base" },
  { customerType: "PLATFORM_EVENT_RESOURCE_CLIENT", title: "活动合作说明", description: "说明活动合作合作路径、资源位和沟通边界。", url: "https://example.com/platform-wuzhen" },
  { customerType: "PLATFORM_EVENT_RESOURCE_CLIENT", title: "行业峰会资源说明", description: "梳理峰会资源、到场价值和可联动的行业资源。", url: "https://example.com/platform-summit" },
  { customerType: "PLATFORM_EVENT_RESOURCE_CLIENT", title: "榜单与趋势发布说明", description: "说明榜单、趋势发布和行业白皮书的使用场景。", url: "https://example.com/platform-ranking-trends" },
  { customerType: "PLATFORM_EVENT_RESOURCE_CLIENT", title: "品牌露出权益说明", description: "帮助客户理解活动露出与行业背书的结合方式。", url: "https://example.com/platform-brand-exposure" },
  { customerType: "PLATFORM_TRAINING_CLIENT", title: "培训课程介绍", description: "说明课程方向、适合对象和实操重点。", url: "https://example.com/platform-training-intro" },
  { customerType: "PLATFORM_TRAINING_CLIENT", title: "课程课纲", description: "展示课程核心章节、问题拆解和输出结果。", url: "https://example.com/platform-training-outline" },
  { customerType: "PLATFORM_TRAINING_CLIENT", title: "适合对象说明", description: "帮助客户判断适合老板、销售还是运营参加。", url: "https://example.com/platform-training-fit" },
  { customerType: "PLATFORM_TRAINING_CLIENT", title: "往期问题清单", description: "汇总往期课程中最常见的业务问题。", url: "https://example.com/platform-training-faq" },
  { customerType: "PLATFORM_TRAINING_CLIENT", title: "报名说明", description: "说明报名节奏、参与方式和注意事项。", url: "https://example.com/platform-training-signup" },
  { customerType: "PLATFORM_SUPPLY_CHAIN_CLIENT", title: "集采合作说明", description: "说明集采合作模式、适合品类和合作原则。", url: "https://example.com/platform-supply-chain" },
  { customerType: "PLATFORM_SUPPLY_CHAIN_CLIENT", title: "产品标准说明", description: "梳理产品标准、质量要求和适配场景。", url: "https://example.com/platform-supply-standard" },
  { customerType: "PLATFORM_SUPPLY_CHAIN_CLIENT", title: "质量保障机制", description: "说明质量保障、责任边界和问题协同方式。", url: "https://example.com/platform-supply-quality" },
  { customerType: "PLATFORM_SUPPLY_CHAIN_CLIENT", title: "合作流程说明", description: "说明集采对接、样品确认和合作推进节奏。", url: "https://example.com/platform-supply-process" },
  { customerType: "PLATFORM_AFTERMARKET_CLIENT", title: "一清一护项目说明", description: "说明一清一护项目定位、收益逻辑和合作方式。", url: "https://example.com/platform-aftermarket-project" },
  { customerType: "PLATFORM_AFTERMARKET_CLIENT", title: "门店合作模式", description: "说明门店如何接入后市场服务和承接客户。", url: "https://example.com/platform-aftermarket-store" },
  { customerType: "PLATFORM_AFTERMARKET_CLIENT", title: "上门服务 SOP", description: "说明服务节点、标准动作和交付边界。", url: "https://example.com/platform-aftermarket-sop" },
  { customerType: "PLATFORM_AFTERMARKET_CLIENT", title: "私域转化方案", description: "说明后市场服务与私域客户转化的衔接方式。", url: "https://example.com/platform-aftermarket-private-domain" },
  { customerType: "PLATFORM_AFTERMARKET_CLIENT", title: "全球严选产品说明", description: "说明项目中可配套的产品和选品标准。", url: "https://example.com/platform-aftermarket-products" },
  { customerType: "PLATFORM_PARTNER_CLIENT", title: "合作伙伴说明", description: "说明合作伙伴类型、适合边界和基本原则。", url: "https://example.com/platform-partner-overview" },
  { customerType: "PLATFORM_PARTNER_CLIENT", title: "资源共创方案", description: "说明资源互换、内容共创和客户协同思路。", url: "https://example.com/platform-partner-cocreate" },
  { customerType: "PLATFORM_PARTNER_CLIENT", title: "活动共建说明", description: "说明联合活动、共同露出和执行分工。", url: "https://example.com/platform-partner-event" },
  { customerType: "PLATFORM_PARTNER_CLIENT", title: "合作边界说明", description: "明确合作过程中的资源、分工和边界要求。", url: "https://example.com/platform-partner-boundary" },
  { customerType: "OTHER", title: "CNAS认可基础认知手册", description: "帮助客户先建立 CNAS 认可的基础认知，理解适用场景、推进节奏和常见误区。", url: "https://example.com/cnas-basic-guide" },
  { customerType: "OTHER", title: "CNAS认可和CNAS认证有什么区别", description: "用于解释认可与认证的区别，避免客户一开始就走偏方向。", url: "https://example.com/cnas-vs-certification" },
  { customerType: "OTHER", title: "CNAS认可启动前自查清单", description: "适合处于准备建设阶段的客户先核对认可目标、人员设备和准备边界。", url: "https://example.com/cnas-start-checklist" },
  { customerType: "OTHER", title: "实验室建设准备重点表", description: "围绕实验室建设阶段梳理人员、设备、环境、方法标准与运行记录重点。", url: "https://example.com/cnas-lab-preparation" },
  { customerType: "OTHER", title: "CNAS体系文件与真实运行检查表", description: "用于判断体系文件和真实运行是否一致，避免只做文档不做运行。", url: "https://example.com/cnas-system-operation-check" },
  { customerType: "OTHER", title: "CNAS评审前风险检查清单", description: "适合进入准备申请阶段的客户提前排查评审重点和返工风险。", url: "https://example.com/cnas-pre-assessment-risk-check" },
  { customerType: "OTHER", title: "CNAS整改闭环问题清单", description: "帮助评审后整改客户梳理常见问题、闭环路径和优先级。", url: "https://example.com/cnas-rectification-checklist" },
  { customerType: "OTHER", title: "CNAS企业微信欢迎语模板", description: "你好，我是CNAS认可指南的顾问。你可以先填写《CNAS认可路径判断问卷》，系统会根据你的实验室类型、当前阶段和主要担心问题给出一份初步判断结果。填写入口：/forms/cnas-path-check", url: "/forms/cnas-path-check" }
];

const platformTaskTemplateSeeds: TaskTemplateSeed[] = [
  { name: "首次沟通", title: "首次沟通MarketClaw业务客户", description: "先判断客户属于哪条业务线，再决定优先发什么资料。", type: "FIRST_FOLLOW", priority: "HIGH", defaultDueDays: 1, customerType: null },
  { name: "发送会员说明", title: "发送会员服务说明", description: "发送会员服务说明、权益和增信价值资料。", type: "SEND_MATERIAL", priority: "HIGH", defaultDueDays: 1, customerType: "PLATFORM_MEMBERSHIP_CLIENT" },
  { name: "发送内容增长方案", title: "发送内容增长说明", description: "发送内容增长服务说明和 AI 搜索可见性自查表。", type: "SEND_MATERIAL", priority: "HIGH", defaultDueDays: 1, customerType: "PLATFORM_GEO_AI_CLIENT" },
  { name: "安排增长诊断", title: "安排增长诊断沟通", description: "围绕重点客户的获客、增信和内部提醒承接做诊断。", type: "PHONE_CALL", priority: "URGENT", defaultDueDays: 2, customerType: "PLATFORM_FACTORY_OWNER" },
  { name: "发送报价", title: "发送业务合作报价", description: "针对已进入报价阶段的客户发送方案与报价说明。", type: "QUOTE_FOLLOW", priority: "HIGH", defaultDueDays: 1, customerType: null, stage: "QUOTED" },
  { name: "邀请参加活动", title: "邀请参加活动资源沟通", description: "邀请客户进入活动、峰会或活动相关沟通。", type: "VISIT_INVITE", priority: "HIGH", defaultDueDays: 2, customerType: "PLATFORM_EVENT_RESOURCE_CLIENT" },
  { name: "提醒报名课程", title: "提醒报名培训课程", description: "围绕报名节点继续推进课程报名。", type: "WECHAT_FOLLOW", priority: "NORMAL", defaultDueDays: 2, customerType: "PLATFORM_TRAINING_CLIENT" },
  { name: "活动资源跟进", title: "活动资源跟进", description: "继续确认活动资源偏好、节点和合作边界。", type: "CUSTOM", priority: "HIGH", defaultDueDays: 2, customerType: "PLATFORM_EVENT_RESOURCE_CLIENT" },
  { name: "集采合作跟进", title: "集采合作跟进", description: "跟进品类、标准、质量保障和合作流程。", type: "DEAL_PUSH", priority: "HIGH", defaultDueDays: 2, customerType: "PLATFORM_SUPPLY_CHAIN_CLIENT" },
  { name: "一清一护项目沟通", title: "一清一护项目沟通", description: "判断门店基础、服务能力和项目合作方式。", type: "PHONE_CALL", priority: "HIGH", defaultDueDays: 2, customerType: "PLATFORM_AFTERMARKET_CLIENT" },
  { name: "续费提醒", title: "续费提醒", description: "用于会员、合作伙伴或年度服务续费前提醒。", type: "REACTIVATE", priority: "NORMAL", defaultDueDays: 3, customerType: "PLATFORM_MEMBERSHIP_CLIENT" },
  { name: "沉默客户激活", title: "沉默客户激活", description: "对沉默客户做轻量激活，重新确认真实需求。", type: "REACTIVATE", priority: "NORMAL", defaultDueDays: 0, customerType: null, stage: "TO_REACTIVATE" },
  { name: "CNAS高意向路径梳理", title: "CNAS高意向路径梳理", description: "客户适合进入认可路径设计阶段，建议 15 分钟内联系，目标是约 30 分钟路径梳理。", type: "PHONE_CALL", priority: "URGENT", defaultDueDays: 0, customerType: "OTHER" },
  { name: "CNAS基础条件核对", title: "CNAS基础条件核对", description: "客户适合先准备基础条件，建议 24 小时内发送资料并判断是否可转高意向。", type: "SEND_MATERIAL", priority: "HIGH", defaultDueDays: 1, customerType: "OTHER" },
  { name: "CNAS内容培育跟进", title: "CNAS内容培育跟进", description: "客户暂不适合直接启动申请，建议进入内容培育池，后续推送流程、费用、周期和准备清单等内容。", type: "WECHAT_FOLLOW", priority: "NORMAL", defaultDueDays: 3, customerType: "OTHER" }
];

type PlatformProfile = {
  source: LeadSource;
  intentionLevel: IntentionLevel;
  stage: LeadStage;
  owner: "sales" | "admin" | "operator";
  taskStatus: FollowTaskStatus;
  taskPriority: FollowTaskPriority;
  taskType: FollowTaskType;
  dueOffsetDays: number;
  completedOffsetDays?: number | null;
  stageBefore: LeadStage;
  stageAfter: LeadStage;
  createdDaysAgo: number;
  nextFollowOffsetDays?: number | null;
};

const platformProfileSets: Record<"A" | "B", PlatformProfile[]> = {
  A: [
    {
      source: "friend_circle",
      intentionLevel: "HIGH",
      stage: "NEW",
      owner: "sales",
      taskStatus: "PENDING",
      taskPriority: "URGENT",
      taskType: "FIRST_FOLLOW",
      dueOffsetDays: 0,
      stageBefore: "NEW",
      stageAfter: "NEW",
      createdDaysAgo: 1,
      nextFollowOffsetDays: 1
    },
    {
      source: "shipinhao",
      intentionLevel: "MEDIUM",
      stage: "MATERIAL_SENT",
      owner: "sales",
      taskStatus: "PENDING",
      taskPriority: "HIGH",
      taskType: "SEND_MATERIAL",
      dueOffsetDays: 1,
      stageBefore: "NEW",
      stageAfter: "MATERIAL_SENT",
      createdDaysAgo: 2,
      nextFollowOffsetDays: 1
    },
    {
      source: "gongzhonghao",
      intentionLevel: "HIGH",
      stage: "CONTACTED",
      owner: "operator",
      taskStatus: "PENDING",
      taskPriority: "NORMAL",
      taskType: "PHONE_CALL",
      dueOffsetDays: 1,
      stageBefore: "NEW",
      stageAfter: "CONTACTED",
      createdDaysAgo: 3,
      nextFollowOffsetDays: 2
    },
    {
      source: "douyin",
      intentionLevel: "STRONG",
      stage: "DIAGNOSED",
      owner: "admin",
      taskStatus: "DONE",
      taskPriority: "HIGH",
      taskType: "CUSTOM",
      dueOffsetDays: -1,
      completedOffsetDays: 0,
      stageBefore: "CONTACTED",
      stageAfter: "DIAGNOSED",
      createdDaysAgo: 4,
      nextFollowOffsetDays: 3
    }
  ],
  B: [
    {
      source: "xiaohongshu",
      intentionLevel: "HIGH",
      stage: "QUOTED",
      owner: "sales",
      taskStatus: "PENDING",
      taskPriority: "URGENT",
      taskType: "QUOTE_FOLLOW",
      dueOffsetDays: 0,
      stageBefore: "DIAGNOSED",
      stageAfter: "QUOTED",
      createdDaysAgo: 1,
      nextFollowOffsetDays: 1
    },
    {
      source: "website",
      intentionLevel: "STRONG",
      stage: "PENDING_DEAL",
      owner: "operator",
      taskStatus: "DELAYED",
      taskPriority: "HIGH",
      taskType: "DEAL_PUSH",
      dueOffsetDays: -1,
      stageBefore: "CONTACTED",
      stageAfter: "PENDING_DEAL",
      createdDaysAgo: 3,
      nextFollowOffsetDays: -1
    },
    {
      source: "offline_event",
      intentionLevel: "MEDIUM",
      stage: "DEAL_DONE",
      owner: "sales",
      taskStatus: "DONE",
      taskPriority: "NORMAL",
      taskType: "DEAL_PUSH",
      dueOffsetDays: -2,
      completedOffsetDays: -1,
      stageBefore: "QUOTED",
      stageAfter: "DEAL_DONE",
      createdDaysAgo: 5,
      nextFollowOffsetDays: null
    },
    {
      source: "referral",
      intentionLevel: "LOW",
      stage: "TO_REACTIVATE",
      owner: "admin",
      taskStatus: "PENDING",
      taskPriority: "NORMAL",
      taskType: "REACTIVATE",
      dueOffsetDays: -3,
      stageBefore: "CONTACTED",
      stageAfter: "TO_REACTIVATE",
      createdDaysAgo: 8,
      nextFollowOffsetDays: -2
    }
  ]
};

type PlatformSeriesSeed = {
  startIndex: number;
  profile: "A" | "B";
  customerType: CustomerType;
  needType: NeedType;
  names: [string, string, string, string];
  companies: [string, string, string, string];
  cities: [string, string, string, string];
  messages: [string, string, string, string];
  followUps: [string, string, string, string];
  nextActions: [string, string, string, string];
  taskTitles: [string, string, string, string];
  taskDescriptions: [string, string, string, string];
  extraTags: [string[], string[], string[], string[]];
};

const platformLeadSeries: PlatformSeriesSeed[] = [
  {
    startIndex: 1,
    profile: "A",
    customerType: "PLATFORM_FACTORY_OWNER",
    needType: "GROWTH_SYSTEM",
    names: ["顾总", "林总", "盛总", "胡总"],
    companies: ["盛木高客单", "木境客户增长", "观木家居", "尚木重点客户"],
    cities: ["杭州", "佛山", "苏州", "成都"],
    messages: [
      "朋友圈看到MarketClaw内容，想先了解增长诊断和信任建设怎么做。",
      "视频号看到内部提醒承接内容，想判断先发什么资料更适合内部团队。",
      "公众号看完后，想继续聊管理看板、销售跟进和品牌内容协同。",
      "抖音咨询重点客户如何把内容增长、内部提醒承接和销售推进串起来。"
    ],
    followUps: [
      "客户想先看增长诊断表，再判断是先做信任建设还是先做内部提醒承接。",
      "客户已经收资料，准备内部开会讨论内部提醒承接和管理看板。",
      "客户已沟通主要渠道，希望继续梳理品牌信任和内容增长配合路径。",
      "客户已完成一轮诊断，准备继续看合作建议和落地节奏。"
    ],
    nextActions: ["安排一次增长诊断", "发送增长诊断表", "判断当前卡点", "推进诊断复盘"],
    taskTitles: ["重点客户老板首次沟通", "发送增长诊断资料", "梳理品牌与承接问题", "诊断结果复盘"],
    taskDescriptions: [
      "先收客户来源、品牌现状和销售跟进方式。",
      "发送增长诊断表、信任建设方案和企微说明。",
      "围绕信任建设、内容增长和内部提醒承接继续收口问题。",
      "对齐诊断结果，判断下一步合作方向。"
    ],
    extraTags: [["信任建设", "高意向"], ["内容增长"], ["联盟合作"], ["待激活"]]
  },
  {
    startIndex: 5,
    profile: "B",
    customerType: "PLATFORM_MEMBERSHIP_CLIENT",
    needType: "COOPERATION",
    names: ["罗总", "沈总", "邵总", "范总"],
    companies: ["名木空间", "森语高客单", "木作设计馆", "和木家居"],
    cities: ["宁波", "南京", "无锡", "嘉兴"],
    messages: [
      "小红书咨询加入MarketClaw会员后具体能带来哪些价值。",
      "官网留资，重点想看会员权益、增信服务和合作边界。",
      "线下活动后继续问会员合作和品牌露出是否适合当前阶段。",
      "老朋友转介绍，想再确认会员服务和续费机制。"
    ],
    followUps: [
      "客户先看会员说明，再决定走基础增信还是声望增长。",
      "客户已收到会员权益，正在内部评估露出和客户转化支持。",
      "客户活动后热度较高，准备继续推进会员合作。",
      "客户之前沟通过会员，近期准备重新激活判断是否续费。"
    ],
    nextActions: ["发送会员说明", "推进会员沟通", "发送报价", "续费提醒"],
    taskTitles: ["会员报价沟通", "会员合作推进", "会员成交确认", "会员续费激活"],
    taskDescriptions: [
      "围绕会员权益、增信和露出价值进入报价沟通。",
      "继续推进会员合作边界和服务层级。",
      "确认已成交客户的后续协同动作。",
      "对沉默会员客户做续费提醒和激活。"
    ],
    extraTags: [["会员服务", "高意向"], ["信任建设"], ["已成交"], ["待续费", "待激活"]]
  },
  {
    startIndex: 9,
    profile: "A",
    customerType: "PLATFORM_GEO_AI_CLIENT",
    needType: "GROWTH_SYSTEM",
    names: ["姚总", "孟总", "倪总", "宋总"],
    companies: ["观木高客单", "木言家居", "朗木整家", "木奢空间"],
    cities: ["上海", "佛山", "东莞", "郑州"],
    messages: [
      "朋友圈问什么是内容增长，为什么 AI 搜索会影响品牌咨询。",
      "视频号咨询能不能被 AI 推荐，想先看自查表。",
      "公众号继续追问内容增长、SEO 和代运营到底有什么区别。",
      "抖音咨询品牌关键词和内容底座该怎么先做。"
    ],
    followUps: [
      "客户想先做一轮 AI 可见性诊断，再判断是否启动内容增长。",
      "客户已收到自查表，准备整理品牌关键词和内容现状。",
      "客户已沟通当前搜索场景，希望继续收口可见性问题。",
      "客户已做过基础诊断，准备继续对齐关键词与内容方向。"
    ],
    nextActions: ["发送内容增长方案", "发送自查表", "判断搜索卡点", "推进诊断复盘"],
    taskTitles: ["内容增长首次沟通", "发送内容增长资料", "沟通 AI 搜索问题", "整理关键词策略"],
    taskDescriptions: [
      "先问品牌关键词、现有内容和当前搜索场景。",
      "发送内容增长服务说明和 AI 搜索可见性自查表。",
      "继续判断是在内容、收录还是推荐入口卡住。",
      "对齐诊断结果并推进下一步建议。"
    ],
    extraTags: [["内容增长", "高意向"], ["AI推广关注"], ["内容共创"], ["待激活"]]
  },
  {
    startIndex: 13,
    profile: "B",
    customerType: "PLATFORM_TRAINING_CLIENT",
    needType: "BOOK_CONSULTATION",
    names: ["程总", "詹总", "黎总", "曹总"],
    companies: ["木艺馆", "简木家居", "云木设计", "森构重点客户"],
    cities: ["武汉", "长沙", "重庆", "青岛"],
    messages: [
      "小红书咨询课程都讲什么，老板参加还是团队参加更合适。",
      "官网留资，想先看课纲和报名说明。",
      "活动现场聊过课程，想确认报名后能带回去什么。",
      "转介绍客户之前看过课程，最近准备重新启动报名。"
    ],
    followUps: [
      "客户正在评估老板班和销售班的差别，准备继续看课纲。",
      "客户已收到报名说明，准备内部确认参训人数。",
      "客户已完成报名，后续还想继续看课后辅导服务。",
      "客户之前沟通过课程，近期适合重新激活。"
    ],
    nextActions: ["发送课纲", "提醒报名课程", "课后服务沟通", "沉默客户激活"],
    taskTitles: ["课程报价沟通", "课程报名推进", "课程成交回访", "课程激活提醒"],
    taskDescriptions: [
      "围绕课纲、人数和参训角色进入报价沟通。",
      "继续确认报名信息和参训安排。",
      "对已成交课程客户做后续服务回访。",
      "对沉默课程客户重新激活。"
    ],
    extraTags: [["培训课程", "高意向"], ["课程报名关注"], ["已成交"], ["待激活"]]
  },
  {
    startIndex: 17,
    profile: "A",
    customerType: "PLATFORM_EVENT_RESOURCE_CLIENT",
    needType: "GET_MATERIAL",
    names: ["覃总", "白总", "廖总", "段总"],
    companies: ["华木高客单", "木光设计", "木域家居", "品木生活"],
    cities: ["嘉兴", "绍兴", "昆明", "泉州"],
    messages: [
      "朋友圈看到活动合作内容，想先了解参与后有什么价值。",
      "视频号咨询峰会、榜单和白皮书资源怎么配合使用。",
      "公众号咨询活动资源露出和行业链接方式。",
      "抖音问活动合作后是否还有后续资源承接。"
    ],
    followUps: [
      "客户想先看活动和峰会资源说明，再判断更适合哪一类露出。",
      "客户已收到活动资源包，准备内部确认是否参与。",
      "客户已沟通资源诉求，希望继续收口榜单和趋势发布价值。",
      "客户已做过一轮资源沟通，准备继续看活动后的承接节奏。"
    ],
    nextActions: ["邀请参加活动", "发送资源包", "活动资源跟进", "推进活动合作"],
    taskTitles: ["活动资源首次沟通", "发送活动资源包", "继续确认活动偏好", "复盘活动合作方案"],
    taskDescriptions: [
      "先判断客户更看重露出、背书还是资源链接。",
      "发送活动合作、峰会和榜单资源资料。",
      "继续确认资源偏好和合作方式。",
      "对齐活动价值和合作节奏。"
    ],
    extraTags: [["活动合作", "信任建设"], ["活动资源意向"], ["品牌露出关注"], ["待激活"]]
  },
  {
    startIndex: 21,
    profile: "B",
    customerType: "PLATFORM_SUPPLY_CHAIN_CLIENT",
    needType: "ASK_PRICE",
    names: ["侯总", "蒋总", "许总", "杜总"],
    companies: ["木仓供应链", "木和选品", "客户增长优采", "森配集采"],
    cities: ["合肥", "南通", "温州", "西安"],
    messages: [
      "小红书咨询集采合作价格和适合品类。",
      "官网留资，想继续了解产品标准和合作流程。",
      "线下活动后问质量保障机制和责任边界。",
      "转介绍客户之前了解过集采，近期准备重新推进。"
    ],
    followUps: [
      "客户先看品类和价格，再决定是否继续走集采合作。",
      "客户已收产品标准，准备内部确认流程和量级。",
      "客户已成交一单，后续还要继续做品类扩充。",
      "客户之前沟通过供应链合作，近期适合重新激活。"
    ],
    nextActions: ["确认采购品类", "集采合作跟进", "已成交回访", "沉默客户激活"],
    taskTitles: ["集采报价沟通", "供应链合作推进", "集采成交复盘", "供应链激活提醒"],
    taskDescriptions: [
      "围绕品类、量级和价格进入报价沟通。",
      "继续确认标准、流程和质量机制。",
      "对已成交客户复盘合作流程并看扩品可能。",
      "对沉默供应链客户重新激活。"
    ],
    extraTags: [["集采供应链", "已报价"], ["质量保障关注"], ["已成交"], ["待激活"]]
  },
  {
    startIndex: 25,
    profile: "A",
    customerType: "PLATFORM_AFTERMARKET_CLIENT",
    needType: "COOPERATION",
    names: ["章总", "严总", "朱总", "高总"],
    companies: ["壹清壹护门店", "净木服务", "木康管家", "家护联盟"],
    cities: ["湖州", "台州", "厦门", "济南"],
    messages: [
      "朋友圈咨询一清一护项目怎么做，门店如何承接。",
      "视频号咨询门店合作模式和上门服务标准。",
      "公众号想继续聊后市场服务和私域转化的结合。",
      "抖音问一清一护项目和普通清洁服务有什么区别。"
    ],
    followUps: [
      "客户想先看项目说明和门店合作模式，再判断是否适合试点。",
      "客户已收门店合作资料，准备继续看上门服务 SOP。",
      "客户已沟通服务流程，希望继续收口门店转化方案。",
      "客户已经做过一轮评估，准备继续看项目配合节奏。"
    ],
    nextActions: ["发送合作说明", "门店基础判断", "一清一护项目沟通", "推进项目复盘"],
    taskTitles: ["后市场首次沟通", "发送门店合作资料", "确认服务动作", "项目配合复盘"],
    taskDescriptions: [
      "先判断门店基础、服务能力和合作目标。",
      "发送项目说明、门店合作模式和 SOP。",
      "继续确认服务标准、上门能力和私域转化。",
      "对齐项目推进节奏和试点动作。"
    ],
    extraTags: [["一清一护", "高意向"], ["门店合作意向"], ["后市场意向"], ["待激活"]]
  },
  {
    startIndex: 29,
    profile: "B",
    customerType: "PLATFORM_PARTNER_CLIENT",
    needType: "COOPERATION",
    names: ["彭总", "马总", "赖总", "唐总"],
    companies: ["设计资源联盟", "家居内容社", "木作研究院", "渠道共创社"],
    cities: ["深圳", "北京", "福州", "南昌"],
    messages: [
      "小红书咨询能否做资源互换和行业内容共创。",
      "官网留资，想继续聊联合活动和客户协同边界。",
      "线下活动后推进共同开发客户和内容合作。",
      "转介绍客户之前谈过合作伙伴机制，近期准备继续收口。"
    ],
    followUps: [
      "客户想先看资源共创方案，再判断是否适合先从联合活动切入。",
      "客户已收到合作伙伴说明，准备继续确认资源清单和边界。",
      "客户已完成一轮试合作，后续还有共创机会可继续推进。",
      "客户之前谈过合作，近期适合重新激活并收口试合作范围。"
    ],
    nextActions: ["安排合作沟通", "资源边界确认", "试合作复盘", "沉默客户激活"],
    taskTitles: ["伙伴合作报价沟通", "资源共创推进", "试合作回访", "伙伴激活提醒"],
    taskDescriptions: [
      "围绕资源、分工和目标进入合作沟通。",
      "继续确认资源清单、联合活动和客户协同方式。",
      "对已合作客户复盘共创结果并看下一步。",
      "对沉默伙伴客户重新激活。"
    ],
    extraTags: [["联盟合作", "内容共创"], ["合作边界确认"], ["已成交"], ["待续费", "待激活"]]
  }
];

function padLeadNumber(value: number) {
  return value.toString().padStart(3, "0");
}

function buildPlatformLeads() {
  return platformLeadSeries.flatMap((series) =>
    platformProfileSets[series.profile].map((profile, index) => {
      const leadId = `platform-lead-${padLeadNumber(series.startIndex + index)}`;

      return {
        id: leadId,
        name: series.names[index],
        phone: `13988${padLeadNumber(series.startIndex + index).slice(-3)}${(series.startIndex + index + 10).toString().padStart(3, "0")}`,
        wechat: `platform-${padLeadNumber(series.startIndex + index)}`,
        company: series.companies[index],
        industry: "通用销售平台／产业服务",
        city: series.cities[index],
        source: profile.source,
        customerType: series.customerType,
        needType: series.needType,
        intentionLevel: profile.intentionLevel,
        stage: profile.stage,
        owner: profile.owner,
        message: series.messages[index],
        followUp: {
          content: series.followUps[index],
          nextAction: series.nextActions[index],
          stageBefore: profile.stageBefore,
          stageAfter: profile.stageAfter,
          createdDaysAgo: profile.createdDaysAgo,
          nextFollowOffsetDays: profile.nextFollowOffsetDays
        },
        task: {
          title: `${series.taskTitles[index]}：${series.names[index]}`,
          description: series.taskDescriptions[index],
          type: profile.taskType,
          status: profile.taskStatus,
          priority: profile.taskPriority,
          dueOffsetDays: profile.dueOffsetDays,
          completedOffsetDays: profile.completedOffsetDays
        },
        extraTags: series.extraTags[index]
      } satisfies LeadTemplate;
    })
  );
}

const platformLeads: LeadTemplate[] = buildPlatformLeads();

async function seedTenant({
  slug,
  name,
  industry,
  plan = "flagship",
  users,
  userNames,
  strategies = strategyTemplates,
  materials = materialTemplates,
  taskTemplates = taskTemplateSeeds,
  businessLines = demoBusinessLineSeeds,
  leads
}: SeedTenantInput) {
  const passwordHash = await bcrypt.hash("123456", 10);
  const tenant = await prisma.tenant.upsert({
    where: { slug },
    update: { name, industry, plan, status: "active" },
    create: {
      name,
      slug,
      industry,
      plan,
      expiredAt: new Date("2027-12-31T23:59:59.000Z")
    }
  });

  const admin = await prisma.user.upsert({
    where: { email: users.admin },
    update: { tenantId: tenant.id, passwordHash, role: "TENANT_ADMIN", status: "active", name: userNames?.admin ?? "企业管理员" },
    create: { tenantId: tenant.id, name: userNames?.admin ?? "企业管理员", email: users.admin, passwordHash, role: "TENANT_ADMIN" }
  });
  const operator = await prisma.user.upsert({
    where: { email: users.operator },
    update: { tenantId: tenant.id, passwordHash, role: "OPERATOR", status: "active", name: userNames?.operator ?? "运营人员" },
    create: { tenantId: tenant.id, name: userNames?.operator ?? "运营人员", email: users.operator, passwordHash, role: "OPERATOR" }
  });
  const sales = await prisma.user.upsert({
    where: { email: users.sales },
    update: { tenantId: tenant.id, passwordHash, role: "SALES", status: "active", name: userNames?.sales ?? "销售顾问" },
    create: { tenantId: tenant.id, name: userNames?.sales ?? "销售顾问", email: users.sales, passwordHash, role: "SALES" }
  });

  for (const strategy of strategies) {
    await prisma.customerTypeStrategy.upsert({
      where: { tenantId_customerType: { tenantId: tenant.id, customerType: strategy.customerType } },
      update: strategy,
      create: { tenantId: tenant.id, ...strategy }
    });
  }
  await prisma.customerTypeStrategy.deleteMany({
    where: {
      tenantId: tenant.id,
      customerType: {
        notIn: strategies.map((strategy) => strategy.customerType)
      }
    }
  });

  // 这里必须按“最下游子表 -> 上游主表”清理。
  // V2.0 引入了 BusinessLine -> MarketClaw* 的新外键链，若仍按旧顺序直接删 BusinessLine，
  // 在租户已经使用过麻虾知识库 / 训练场 / 回复草稿后会触发外键约束失败。
  await prisma.auditLog.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.communicationComplianceConfig.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.reminderQueue.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.marketClawReplyFeedback.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.replySuggestion.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.followTask.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.followUp.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.leadTag.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.leadSourceAttribution.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.intakeForm.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.importRow.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.importBatch.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.marketClawReplyDraft.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.marketClawTrainingCase.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.marketClawKnowledgeItem.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.lead.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.businessLine.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.material.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.taskTemplate.deleteMany({ where: { tenantId: tenant.id } });

  await prisma.material.createMany({
    data: materials.map((material) => ({
      tenantId: tenant.id,
      title: material.title,
      description: material.description,
      type: "link",
      url: material.url,
      customerType: material.customerType ?? null
    }))
  });

  await prisma.taskTemplate.createMany({
    data: taskTemplates.map((template) => ({
      tenantId: tenant.id,
      name: template.name,
      title: template.title,
      description: template.description,
      type: template.type,
      priority: template.priority,
      defaultDueDays: template.defaultDueDays,
      customerType: template.customerType ?? null,
      stage: template.stage ?? null,
      isActive: true
    }))
  });

  const [createdMaterials, createdTaskTemplates] = await Promise.all([
    prisma.material.findMany({
      where: { tenantId: tenant.id }
    }),
    prisma.taskTemplate.findMany({
      where: { tenantId: tenant.id }
    })
  ]);

  const resolveMaterialIds = (keywords: string[]) =>
    uniqueById(
      keywords.flatMap((keyword) =>
        createdMaterials.filter((material) => material.title.includes(keyword))
      )
    ).map((material) => material.id);

  const resolveTaskTemplateIds = (keywords: string[]) =>
    uniqueById(
      keywords.flatMap((keyword) =>
        createdTaskTemplates.filter((template) => template.name.includes(keyword) || template.title.includes(keyword))
      )
    ).map((template) => template.id);

  await prisma.businessLine.createMany({
    data: businessLines.map((businessLine) => ({
      tenantId: tenant.id,
      name: businessLine.name,
      slug: businessLine.slug,
      description: businessLine.description,
      status: businessLine.status ?? "ACTIVE",
      category: businessLine.category,
      priority: businessLine.priority,
      targetCustomerTypes: businessLine.targetCustomerTypes,
      recommendedTagNames: businessLine.recommendedTags,
      recommendedMaterialIds: resolveMaterialIds(businessLine.recommendedMaterialTitles),
      recommendedTaskTemplateIds: resolveTaskTemplateIds(businessLine.recommendedTaskTemplateNames),
      defaultNextAction: businessLine.defaultNextAction,
      notes: businessLine.notes ?? null
    }))
  });

  const ownerMap = { admin: admin.id, operator: operator.id, sales: sales.id };

  for (const lead of leads) {
    const followUpCreatedAt = daysAgo(lead.followUp.createdDaysAgo);
    const nextFollowAt =
      lead.followUp.nextFollowOffsetDays === null || lead.followUp.nextFollowOffsetDays === undefined
        ? null
        : daysFromNow(lead.followUp.nextFollowOffsetDays);

    await prisma.lead.create({
      data: {
        id: lead.id,
        tenantId: tenant.id,
        name: lead.name,
        phone: lead.phone,
        wechat: lead.wechat,
        company: lead.company,
        industry: lead.industry,
        city: lead.city,
        source: lead.source,
        customerType: lead.customerType,
        needType: lead.needType,
        intentionLevel: lead.intentionLevel,
        stage: lead.stage,
        dealStatus: lead.stage === "DEAL_DONE" ? "WON" : lead.stage === "LOST" ? "LOST" : "PENDING",
        message: lead.message,
        ownerId: ownerMap[lead.owner],
        nextFollowAt,
        lastFollowAt: followUpCreatedAt
      }
    });
  }

  await prisma.leadTag.createMany({
    data: leads.flatMap((lead) => [
      { tenantId: tenant.id, leadId: lead.id, tagName: lead.source, tagGroup: "SOURCE" as const },
      { tenantId: tenant.id, leadId: lead.id, tagName: lead.customerType, tagGroup: "CUSTOMER_TYPE" as const },
      { tenantId: tenant.id, leadId: lead.id, tagName: lead.intentionLevel, tagGroup: "INTENTION" as const },
      { tenantId: tenant.id, leadId: lead.id, tagName: lead.stage, tagGroup: "STAGE" as const },
      ...(lead.extraTags ?? []).map((tagName) => ({
        tenantId: tenant.id,
        leadId: lead.id,
        tagName,
        tagGroup: "CUSTOM" as const
      }))
    ])
  });

  await prisma.followUp.createMany({
    data: leads.map((lead) => ({
      tenantId: tenant.id,
      leadId: lead.id,
      userId: ownerMap[lead.owner],
      content: lead.followUp.content,
      nextAction: lead.followUp.nextAction,
      nextFollowAt:
        lead.followUp.nextFollowOffsetDays === null || lead.followUp.nextFollowOffsetDays === undefined
          ? null
          : daysFromNow(lead.followUp.nextFollowOffsetDays),
      stageBefore: lead.followUp.stageBefore,
      stageAfter: lead.followUp.stageAfter,
      createdAt: daysAgo(lead.followUp.createdDaysAgo)
    }))
  });

  await prisma.followTask.createMany({
    data: leads.map((lead) => {
      const dueAt = daysFromNow(lead.task.dueOffsetDays);
      const completedAt =
        lead.task.status === "DONE" && lead.task.completedOffsetDays !== null && lead.task.completedOffsetDays !== undefined
          ? daysFromNow(lead.task.completedOffsetDays, 16, 0)
          : null;

      return {
        tenantId: tenant.id,
        leadId: lead.id,
        ownerId: ownerMap[lead.owner],
        createdById: ownerMap.admin,
        title: lead.task.title,
        description: lead.task.description,
        type: lead.task.type,
        status: lead.task.status,
        priority: lead.task.priority,
        dueAt,
        completedAt,
        cancelledAt: lead.task.status === "CANCELLED" ? daysFromNow(lead.task.dueOffsetDays, 18, 0) : null
      };
    })
  });

  return { tenant, sales };
}

async function main() {
  const passwordHash = await bcrypt.hash("123456", 10);

  await prisma.user.upsert({
    where: { email: "admin@growthhub.local" },
    update: { passwordHash, role: "PLATFORM_ADMIN", tenantId: null, status: "active", name: "平台管理员" },
    create: {
      name: "平台管理员",
      email: "admin@growthhub.local",
      passwordHash,
      role: "PLATFORM_ADMIN"
    }
  });

  await seedTenant({
    slug: "zhengmu-demo",
    name: "MarketClaw 平台样板企业",
    industry: "高客单服务",
    users: {
      admin: "boss@zhengmu.local",
      operator: "operator@zhengmu.local",
      sales: "sales@zhengmu.local"
    },
    businessLines: demoBusinessLineSeeds,
    leads: zhengmuLeads
  });

  await seedTenant({
    slug: "zhengmu-platform",
    name: "MarketClaw",
    industry: "通用销售平台／产业服务",
    plan: "flagship",
    users: {
      admin: "platform-boss@zhengmu.local",
      operator: "platform-operator@zhengmu.local",
      sales: "platform-sales@zhengmu.local"
    },
    userNames: {
      admin: "平台业务管理员",
      operator: "平台运营",
      sales: "平台销售顾问"
    },
    strategies: platformStrategyTemplates,
    materials: platformMaterialTemplates,
    taskTemplates: platformTaskTemplateSeeds,
    businessLines: platformBusinessLineSeeds,
    leads: platformLeads
  });

  await seedTenant({
    slug: "isolation-demo",
    name: "隔离验证企业",
    industry: "门窗定制",
    users: {
      admin: "boss@isolation.local",
      operator: "operator@isolation.local",
      sales: "sales@isolation.local"
    },
    leads: [
      {
        id: "isolation-lead-001",
        name: "隔离客户A",
        phone: "13900000001",
        city: "上海",
        source: "website",
        customerType: "OWNER_CLIENT",
        needType: "PRODUCT_INQUIRY",
        intentionLevel: "HIGH",
        stage: "NEW",
        owner: "sales",
        message: "用于验证不同租户之间不可互相查看。",
        followUp: {
          content: "隔离租户线索，用于验证 ownerId 和 tenantId 隔离。",
          nextAction: "确认隔离验证",
          stageBefore: "NEW",
          stageAfter: "NEW",
          createdDaysAgo: 1,
          nextFollowOffsetDays: 1
        },
        task: {
          title: "隔离验证任务：隔离客户A",
          description: "用于验证第二租户任务不会出现在 zhengmu-demo。",
          type: "FIRST_FOLLOW",
          status: "PENDING",
          priority: "HIGH",
          dueOffsetDays: 1
        }
      },
      {
        id: "isolation-lead-002",
        name: "隔离客户B",
        phone: "13900000002",
        city: "无锡",
        source: "referral",
        customerType: "FACTORY_CLIENT",
        needType: "GROWTH_SYSTEM",
        intentionLevel: "MEDIUM",
        stage: "CONTACTED",
        owner: "admin",
        message: "第二租户线索，不能出现在 zhengmu-demo 后台。",
        followUp: {
          content: "第二租户重点客户，继续用于隔离验证。",
          nextAction: "确认隔离租户数据不可见",
          stageBefore: "NEW",
          stageAfter: "CONTACTED",
          createdDaysAgo: 2,
          nextFollowOffsetDays: 2
        },
        task: {
          title: "隔离验证任务：隔离客户B",
          description: "用于验证第二租户任务不会泄露到主租户。",
          type: "PHONE_CALL",
          status: "PENDING",
          priority: "NORMAL",
          dueOffsetDays: 2
        }
      }
    ]
  });

  await prisma.session.deleteMany({
    where: { expiresAt: { lt: new Date() } }
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });


