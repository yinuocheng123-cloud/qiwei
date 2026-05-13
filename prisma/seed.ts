/*
 * 文件说明：该文件为 V1.4 本地开发环境写入可演示的整木行业样板数据。
 * 功能说明：创建平台管理员、两个租户、企业角色账号、四类客户策略、资料包、任务模板、线索、跟进记录和任务。
 *
 * 结构概览：
 *   第一部分：导入依赖与基础类型
 *   第二部分：整木行业策略、资料和模板数据
 *   第三部分：线索与任务样板数据
 *   第四部分：租户数据写入函数
 *   第五部分：主种子流程
 */
import {
  PrismaClient,
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
  customerType: CustomerType;
};

type TaskTemplateSeed = {
  name: string;
  title: string;
  description: string;
  type: FollowTaskType;
  priority: FollowTaskPriority;
  defaultDueDays: number;
  customerType: CustomerType;
  stage?: LeadStage | null;
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

const strategyTemplates: StrategyTemplate[] = [
  {
    customerType: "OWNER_CLIENT",
    name: "业主客户转化策略",
    painPoints: ["效果", "环保", "价格", "交付", "售后", "设计落地"],
    firstMaterials: ["整木定制避坑清单", "真实案例图册", "交付流程说明", "环保与售后说明"],
    welcomeScript: "您好，已收到您的整木定制需求。我们先发您真实案例和避坑清单，方便您快速判断风格、预算和落地节奏。",
    day3Script: "您目前更关注整体效果、环保材料还是预算控制？我可以按您的房屋情况先给一版建议。",
    day7Script: "如果方便发一下户型、面积或装修阶段，我们可以进一步判断更适合的整木方案和交付节奏。",
    day15Script: "前面发您的案例和说明是否有帮助？如果近期准备推进装修，可以先预约一次初步方案沟通。",
    manualTriggerRules: ["发送户型图", "询问价格", "咨询环保", "关注交付周期", "预约到店沟通"],
    recommendedNextAction: "预约初步方案",
    recommendedPrivateContent: "别墅整木案例、环保说明、交付节点记录、售后服务说明"
  },
  {
    customerType: "DEALER_CLIENT",
    name: "经销商客户转化策略",
    painPoints: ["利润", "政策", "区域保护", "总部支持", "样板门店", "风险"],
    firstMaterials: ["招商手册", "产品体系说明", "合作政策说明", "样板门店案例", "到厂考察邀请"],
    welcomeScript: "您好，感谢关注整木合作。先发您招商手册和产品体系，您可以先看利润空间、区域政策和总部支持方式。",
    day3Script: "您现在更关注利润模型、区域保护，还是样板门店和落地支持？我可以按您所在城市给您说明。",
    day7Script: "如果您方便提供城市和门店情况，我们可以进一步判断合作政策、样板支持和到厂考察安排。",
    day15Script: "近期如果还在评估项目，可以先安排一次招商负责人沟通，把政策和投入边界讲清楚。",
    manualTriggerRules: ["询问代理政策", "提供城市信息", "了解门店情况", "关注利润模型", "预约到厂"],
    recommendedNextAction: "安排招商负责人沟通",
    recommendedPrivateContent: "样板门店案例、合作政策说明、经销商答疑纪要"
  },
  {
    customerType: "DESIGNER_CLIENT",
    name: "设计师客户转化策略",
    painPoints: ["审美", "落地", "工艺", "材料", "案例", "项目配合"],
    firstMaterials: ["高定案例图册", "工艺节点说明", "材料样册", "设计师合作机制", "项目配合流程"],
    welcomeScript: "您好，已收到您的设计合作需求。先发您高定案例、工艺节点和材料样册，方便您判断审美方向和落地配合。",
    day3Script: "您近期主要在做哪类项目？如果有图纸或风格方向，我们可以先给一版材料与工艺建议。",
    day7Script: "我们可以配合报价、深化、材料确认和交付节点，您更希望先从哪一块开始沟通？",
    day15Script: "如果近期有项目在推进，可以先建立项目群或项目协作沟通，避免后期工艺和报价来回反复。",
    manualTriggerRules: ["发送图纸", "询问工艺", "想看案例", "询问材料", "需要项目报价配合"],
    recommendedNextAction: "建立项目合作沟通",
    recommendedPrivateContent: "高定案例图册、材料样册、设计师合作案例、工艺落地说明"
  },
  {
    customerType: "FACTORY_CLIENT",
    name: "工厂客户增长策略",
    painPoints: ["获客", "招商", "品牌", "成交", "企业微信", "AI推广", "GEO"],
    firstMaterials: ["企业微信承接自查表", "整木企业增长诊断表", "品牌增信方案", "GEO推广说明", "业务增长中台合作建议"],
    welcomeScript: "您好，已收到您的增长咨询。先发您企业微信承接自查表和增长诊断表，方便判断当前获客、承接和成交的主要断点。",
    day3Script: "您现在更卡在获客、招商、承接还是老板看板？我可以先按现状给您一个诊断方向。",
    day7Script: "如果方便说一下企业规模和主要渠道，我们可以判断先做企微承接、品牌增信，还是先做 GEO 推广更合适。",
    day15Script: "近期如果准备系统化推进增长，建议安排一次深度诊断，把渠道、企微、销售跟进和看板串起来。",
    manualTriggerRules: ["询问合作费用", "介绍企业规模", "希望做推广", "想看企微方案", "安排老板沟通"],
    recommendedNextAction: "安排深度诊断",
    recommendedPrivateContent: "增长中台案例、企微承接流程、品牌增信方案、GEO 推广思路"
  }
];

const materialTemplates: MaterialTemplate[] = [
  { customerType: "OWNER_CLIENT", title: "整木定制避坑清单", description: "帮助业主快速排查预算、工艺和交付常见风险。", url: "https://example.com/owner-avoid-pitfalls" },
  { customerType: "OWNER_CLIENT", title: "真实案例图册", description: "展示别墅、大平层和整木空间的真实落地案例。", url: "https://example.com/owner-casebook" },
  { customerType: "OWNER_CLIENT", title: "交付流程说明", description: "说明从测量、深化、生产到安装交付的完整流程。", url: "https://example.com/owner-delivery-flow" },
  { customerType: "OWNER_CLIENT", title: "环保与售后说明", description: "适合业主客户重点了解环保、售后和材料边界。", url: "https://example.com/owner-service" },
  { customerType: "DEALER_CLIENT", title: "招商手册", description: "帮助经销商快速了解品牌定位、利润模型和合作方式。", url: "https://example.com/dealer-investment-book" },
  { customerType: "DEALER_CLIENT", title: "产品体系说明", description: "覆盖整木产品线、客单结构和样板空间组合。", url: "https://example.com/dealer-product-system" },
  { customerType: "DEALER_CLIENT", title: "合作政策说明", description: "讲清区域保护、返利和总部支持方式。", url: "https://example.com/dealer-policy" },
  { customerType: "DEALER_CLIENT", title: "样板门店案例", description: "展示门店落地效果和招商转化案例。", url: "https://example.com/dealer-showroom" },
  { customerType: "DEALER_CLIENT", title: "到厂考察邀请", description: "适合推动经销商客户进入考察和政策确认阶段。", url: "https://example.com/dealer-factory-visit" },
  { customerType: "DESIGNER_CLIENT", title: "高定案例图册", description: "适合设计师筛选审美方向和风格落地样本。", url: "https://example.com/designer-casebook" },
  { customerType: "DESIGNER_CLIENT", title: "工艺节点说明", description: "帮助设计师确认工艺可行性和施工衔接。", url: "https://example.com/designer-craft" },
  { customerType: "DESIGNER_CLIENT", title: "材料样册", description: "展示常用整木材料、饰面和五金搭配。", url: "https://example.com/designer-material-swatch" },
  { customerType: "DESIGNER_CLIENT", title: "设计师合作机制", description: "说明项目合作、报价支持和设计协同方式。", url: "https://example.com/designer-cooperation" },
  { customerType: "DESIGNER_CLIENT", title: "项目配合流程", description: "帮助设计师判断从深化到交付的协作节奏。", url: "https://example.com/designer-project-flow" },
  { customerType: "FACTORY_CLIENT", title: "企业微信承接自查表", description: "帮助工厂客户排查企微承接和线索分配断点。", url: "https://example.com/factory-wecom-check" },
  { customerType: "FACTORY_CLIENT", title: "整木企业增长诊断表", description: "用于梳理获客、招商、内容和成交的系统问题。", url: "https://example.com/factory-growth-diagnosis" },
  { customerType: "FACTORY_CLIENT", title: "品牌增信方案", description: "帮助工厂客户理解老板 IP、品牌内容和增信路径。", url: "https://example.com/factory-brand-trust" },
  { customerType: "FACTORY_CLIENT", title: "GEO 推广说明", description: "介绍本地搜索、地图和内容分发的增长方式。", url: "https://example.com/factory-geo" },
  { customerType: "FACTORY_CLIENT", title: "业务增长中台合作建议", description: "适合工厂客户评估企微承接和老板看板合作。", url: "https://example.com/factory-growth-hub" }
];

const taskTemplateSeeds: TaskTemplateSeed[] = [
  { customerType: "OWNER_CLIENT", name: "首次沟通", title: "首次沟通业主客户", description: "确认房屋面积、装修阶段、预算和风格偏好。", type: "FIRST_FOLLOW", priority: "HIGH", defaultDueDays: 1 },
  { customerType: "OWNER_CLIENT", name: "发送案例图册", title: "发送业主案例图册", description: "发送真实案例图册和避坑清单，建立初步信任。", type: "SEND_MATERIAL", priority: "NORMAL", defaultDueDays: 1 },
  { customerType: "OWNER_CLIENT", name: "了解房屋面积和装修阶段", title: "了解房屋面积和装修阶段", description: "收集户型、面积和当前装修进度。", type: "PHONE_CALL", priority: "NORMAL", defaultDueDays: 2 },
  { customerType: "OWNER_CLIENT", name: "预约初步方案", title: "预约初步方案沟通", description: "推动客户进入一对一方案沟通。", type: "PHONE_CALL", priority: "HIGH", defaultDueDays: 3 },
  { customerType: "OWNER_CLIENT", name: "报价后跟进", title: "报价后跟进业主客户", description: "跟进业主对报价、环保和交付的反馈。", type: "QUOTE_FOLLOW", priority: "HIGH", defaultDueDays: 2, stage: "QUOTED" },
  { customerType: "OWNER_CLIENT", name: "15 天沉默激活", title: "15 天沉默激活业主客户", description: "对沉默客户重新激活并引导二次沟通。", type: "REACTIVATE", priority: "NORMAL", defaultDueDays: 0, stage: "TO_REACTIVATE" },
  { customerType: "DEALER_CLIENT", name: "发送招商资料", title: "发送招商资料包", description: "发送招商手册、产品体系和合作政策。", type: "SEND_MATERIAL", priority: "HIGH", defaultDueDays: 1 },
  { customerType: "DEALER_CLIENT", name: "了解所在城市和门店情况", title: "了解城市和门店情况", description: "确认客户所在城市、门店现状和团队基础。", type: "PHONE_CALL", priority: "NORMAL", defaultDueDays: 2 },
  { customerType: "DEALER_CLIENT", name: "招商负责人沟通", title: "安排招商负责人沟通", description: "由招商主管进一步判断合作可行性。", type: "PHONE_CALL", priority: "HIGH", defaultDueDays: 3 },
  { customerType: "DEALER_CLIENT", name: "邀约到厂考察", title: "邀约到厂考察", description: "推动经销商客户到厂考察样板和政策。", type: "VISIT_INVITE", priority: "HIGH", defaultDueDays: 5 },
  { customerType: "DEALER_CLIENT", name: "政策确认跟进", title: "政策确认跟进", description: "跟进利润模型、区域保护和签约条件。", type: "DEAL_PUSH", priority: "HIGH", defaultDueDays: 2, stage: "PENDING_DEAL" },
  { customerType: "DESIGNER_CLIENT", name: "发送案例图册", title: "发送设计师案例图册", description: "发送高定案例图册，帮助对齐审美方向。", type: "SEND_MATERIAL", priority: "NORMAL", defaultDueDays: 1 },
  { customerType: "DESIGNER_CLIENT", name: "了解设计师项目类型", title: "了解设计师项目类型", description: "确认设计师当前项目类型、客户层级和合作边界。", type: "PHONE_CALL", priority: "NORMAL", defaultDueDays: 2 },
  { customerType: "DESIGNER_CLIENT", name: "建立项目合作沟通", title: "建立项目合作沟通", description: "建立项目群或专项协作沟通。", type: "WECHAT_FOLLOW", priority: "HIGH", defaultDueDays: 2 },
  { customerType: "DESIGNER_CLIENT", name: "发送工艺节点", title: "发送工艺节点说明", description: "补充工艺节点和材料搭配说明。", type: "SEND_MATERIAL", priority: "NORMAL", defaultDueDays: 1 },
  { customerType: "DESIGNER_CLIENT", name: "项目报价配合", title: "项目报价配合", description: "在设计师项目推进阶段配合报价和深化。", type: "QUOTE_FOLLOW", priority: "HIGH", defaultDueDays: 2, stage: "PENDING_DEAL" },
  { customerType: "FACTORY_CLIENT", name: "发送增长诊断表", title: "发送增长诊断表", description: "发送企微承接自查表和增长诊断表。", type: "SEND_MATERIAL", priority: "HIGH", defaultDueDays: 1 },
  { customerType: "FACTORY_CLIENT", name: "了解企业获客方式", title: "了解企业获客方式", description: "确认企业当前获客、招商和销售协作方式。", type: "PHONE_CALL", priority: "NORMAL", defaultDueDays: 2 },
  { customerType: "FACTORY_CLIENT", name: "判断承接问题", title: "判断承接问题", description: "识别获客到企微承接、销售跟进的主要堵点。", type: "CUSTOM", priority: "HIGH", defaultDueDays: 2 },
  { customerType: "FACTORY_CLIENT", name: "安排深度诊断", title: "安排深度诊断", description: "推进老板或负责人进入深度诊断沟通。", type: "PHONE_CALL", priority: "URGENT", defaultDueDays: 3 },
  { customerType: "FACTORY_CLIENT", name: "推动合作沟通", title: "推动合作沟通", description: "围绕品牌增信、企微和老板看板推进合作。", type: "DEAL_PUSH", priority: "URGENT", defaultDueDays: 2, stage: "QUOTED" }
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
    message: "抖音看到别墅整木案例，希望尽快沟通整体效果和环保方案。",
    followUp: {
      content: "客户已经确认想先看真实案例，并愿意补充户型图和装修时间表。",
      nextAction: "发送案例图册并收集户型",
      stageBefore: "NEW",
      stageAfter: "NEW",
      createdDaysAgo: 1,
      nextFollowOffsetDays: 1
    },
    task: {
      title: "业主首次沟通：陈先生",
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
    message: "小红书咨询环保与售后，希望先看案例图册和交付说明。",
    followUp: {
      content: "已发送案例图册和环保说明，客户正在确认房屋面积和装修阶段。",
      nextAction: "了解房屋面积和装修阶段",
      stageBefore: "NEW",
      stageAfter: "MATERIAL_SENT",
      createdDaysAgo: 2,
      nextFollowOffsetDays: 0
    },
    task: {
      title: "发送案例图册：李女士",
      description: "继续跟进业主客户对案例、环保和售后说明的反馈。",
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
    company: "合肥某高定馆",
    industry: "整木门店",
    city: "合肥",
    source: "shipinhao",
    customerType: "DEALER_CLIENT",
    needType: "INVESTMENT_JOIN",
    intentionLevel: "HIGH",
    stage: "CONTACTED",
    owner: "sales",
    message: "视频号看到招商内容，重点关注区域政策、利润和样板门店支持。",
    followUp: {
      content: "已沟通所在城市和门店现状，客户希望先看招商资料和合作政策。",
      nextAction: "发送招商资料",
      stageBefore: "NEW",
      stageAfter: "CONTACTED",
      createdDaysAgo: 3,
      nextFollowOffsetDays: 0
    },
    task: {
      title: "发送招商资料：周总",
      description: "发送招商手册、产品体系和合作政策，并约定下一次沟通。",
      type: "SEND_MATERIAL",
      status: "PENDING",
      priority: "HIGH",
      dueOffsetDays: 0
    }
  },
  {
    id: "demo-lead-004",
    name: "王设计",
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
    message: "朋友圈咨询高定项目配合，希望确认工艺节点和设计落地能力。",
    followUp: {
      content: "已经确认项目在方案阶段，设计师希望先看工艺节点和材料样册。",
      nextAction: "发送工艺节点说明",
      stageBefore: "CONTACTED",
      stageAfter: "DIAGNOSED",
      createdDaysAgo: 2,
      nextFollowOffsetDays: 2
    },
    task: {
      title: "发送案例图册：王设计",
      description: "补充设计师案例、材料样册和项目配合机制。",
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
    company: "佛山某整木工厂",
    industry: "整木制造",
    city: "佛山",
    source: "website",
    customerType: "FACTORY_CLIENT",
    needType: "GROWTH_SYSTEM",
    intentionLevel: "STRONG",
    stage: "QUOTED",
    owner: "admin",
    message: "官网留资，想搭企业微信承接、老板看板和内容增长协同。",
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
      description: "围绕企微承接、老板看板和 GEO 推广推进深度诊断。",
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
    company: "成都某整木馆",
    industry: "经销商",
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
      description: "重新唤醒业主客户，确认近期装修进展和沟通意愿。",
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
    company: "湖州某木作工厂",
    industry: "整木制造",
    city: "湖州",
    source: "referral",
    customerType: "FACTORY_CLIENT",
    needType: "BOOK_CONSULTATION",
    intentionLevel: "HIGH",
    stage: "DEAL_DONE",
    owner: "sales",
    message: "转介绍客户，已完成增长诊断合作，准备进入系统搭建阶段。",
    followUp: {
      content: "已确认老板看板和企微承接方案，客户对阶段合作结果满意。",
      nextAction: "沉淀案例并准备二期方案",
      stageBefore: "PENDING_DEAL",
      stageAfter: "DEAL_DONE",
      createdDaysAgo: 3,
      nextFollowOffsetDays: null
    },
    task: {
      title: "推动合作沟通：孙总",
      description: "该工厂客户已进入已成交状态，任务用于演示已完成阶段。",
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
    message: "官网咨询整木报价，重点比较效果落地、环保等级和预算边界。",
    followUp: {
      content: "已完成报价说明，客户正在和设计师确认材料与预算方案。",
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
    company: "苏南某整木馆",
    industry: "经销门店",
    city: "无锡",
    source: "gongzhonghao",
    customerType: "DEALER_CLIENT",
    needType: "COOPERATION",
    intentionLevel: "STRONG",
    stage: "DIAGNOSED",
    owner: "operator",
    message: "公众号看完招商文章后留资，想评估样板门店和总部支持力度。",
    followUp: {
      content: "已沟通门店现状和预算，下一步要安排招商主管深聊合作条件。",
      nextAction: "招商负责人沟通",
      stageBefore: "CONTACTED",
      stageAfter: "DIAGNOSED",
      createdDaysAgo: 1,
      nextFollowOffsetDays: 3
    },
    task: {
      title: "招商负责人沟通：何总",
      description: "安排招商主管进一步讲解合作政策和样板门店支持。",
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
    company: "鲁南某高定馆",
    industry: "经销门店",
    city: "临沂",
    source: "offline_event",
    customerType: "DEALER_CLIENT",
    needType: "INVESTMENT_JOIN",
    intentionLevel: "LOW",
    stage: "DEAL_DONE",
    owner: "admin",
    message: "展会成交客户，已经完成到厂考察和签约演示案例。",
    followUp: {
      content: "已完成到厂考察和政策确认，客户进入签约落地阶段。",
      nextAction: "交接总部启动支持",
      stageBefore: "PENDING_DEAL",
      stageAfter: "DEAL_DONE",
      createdDaysAgo: 5,
      nextFollowOffsetDays: null
    },
    task: {
      title: "邀约到厂考察：马总",
      description: "该经销商客户已成交，任务用于演示经销商路线的已完成状态。",
      type: "VISIT_INVITE",
      status: "DONE",
      priority: "NORMAL",
      dueOffsetDays: -4,
      completedOffsetDays: -3
    }
  },
  {
    id: "demo-lead-012",
    name: "许设计",
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
    message: "小红书看到高定案例，希望先看案例图册和合作机制。",
    followUp: {
      content: "设计师先想看项目案例和材料样册，后续再评估是否建立项目合作沟通。",
      nextAction: "发送案例图册",
      stageBefore: "NEW",
      stageAfter: "NEW",
      createdDaysAgo: 1,
      nextFollowOffsetDays: 0
    },
    task: {
      title: "发送案例图册：许设计",
      description: "先发案例图册和设计师合作机制，帮助设计师建立第一印象。",
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
      content: "已确认近期有高定项目在推进，希望建立专项沟通并共享工艺节点。",
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
    name: "唐设计",
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
      title: "项目报价配合：唐设计",
      description: "配合设计师完成项目报价和材料细节确认。",
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
    company: "广州某整木工厂",
    industry: "整木制造",
    city: "广州",
    source: "gongzhonghao",
    customerType: "FACTORY_CLIENT",
    needType: "GROWTH_SYSTEM",
    intentionLevel: "MEDIUM",
    stage: "MATERIAL_SENT",
    owner: "sales",
    message: "公众号咨询品牌增信和 GEO 推广，希望先看诊断表和承接自查表。",
    followUp: {
      content: "已经发送增长诊断表和企微承接自查表，客户准备梳理现有渠道数据。",
      nextAction: "了解企业获客方式",
      stageBefore: "NEW",
      stageAfter: "MATERIAL_SENT",
      createdDaysAgo: 2,
      nextFollowOffsetDays: 2
    },
    task: {
      title: "发送增长诊断表：宋总",
      description: "继续跟进工厂客户对承接自查表和诊断表的反馈。",
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
    company: "绍兴某木作工厂",
    industry: "整木制造",
    city: "绍兴",
    source: "shipinhao",
    customerType: "FACTORY_CLIENT",
    needType: "GROWTH_SYSTEM",
    intentionLevel: "LOW",
    stage: "TO_REACTIVATE",
    owner: "sales",
    message: "视频号咨询过老板看板和 GEO 推广，但近期沟通中断，需要重新激活。",
    followUp: {
      content: "客户暂时搁置项目，近期重新启动品牌增信和渠道承接梳理。",
      nextAction: "判断承接问题",
      stageBefore: "CONTACTED",
      stageAfter: "TO_REACTIVATE",
      createdDaysAgo: 8,
      nextFollowOffsetDays: -3
    },
    task: {
      title: "判断承接问题：吕厂",
      description: "重新梳理工厂客户的企微承接和销售协作问题。",
      type: "CUSTOM",
      status: "PENDING",
      priority: "LOW",
      dueOffsetDays: -3
    }
  }
];

async function seedTenant({
  slug,
  name,
  industry,
  users,
  leads
}: {
  slug: string;
  name: string;
  industry: string;
  users: { admin: string; operator: string; sales: string };
  leads: LeadTemplate[];
}) {
  const passwordHash = await bcrypt.hash("123456", 10);
  const tenant = await prisma.tenant.upsert({
    where: { slug },
    update: { name, industry, status: "active" },
    create: {
      name,
      slug,
      industry,
      expiredAt: new Date("2027-12-31T23:59:59.000Z")
    }
  });

  const admin = await prisma.user.upsert({
    where: { email: users.admin },
    update: { tenantId: tenant.id, passwordHash, role: "TENANT_ADMIN", status: "active", name: "企业管理员" },
    create: { tenantId: tenant.id, name: "企业管理员", email: users.admin, passwordHash, role: "TENANT_ADMIN" }
  });
  const operator = await prisma.user.upsert({
    where: { email: users.operator },
    update: { tenantId: tenant.id, passwordHash, role: "OPERATOR", status: "active", name: "运营人员" },
    create: { tenantId: tenant.id, name: "运营人员", email: users.operator, passwordHash, role: "OPERATOR" }
  });
  const sales = await prisma.user.upsert({
    where: { email: users.sales },
    update: { tenantId: tenant.id, passwordHash, role: "SALES", status: "active", name: "销售顾问" },
    create: { tenantId: tenant.id, name: "销售顾问", email: users.sales, passwordHash, role: "SALES" }
  });

  for (const strategy of strategyTemplates) {
    await prisma.customerTypeStrategy.upsert({
      where: { tenantId_customerType: { tenantId: tenant.id, customerType: strategy.customerType } },
      update: strategy,
      create: { tenantId: tenant.id, ...strategy }
    });
  }

  await prisma.reminderQueue.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.followTask.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.followUp.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.leadTag.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.intakeForm.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.lead.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.material.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.taskTemplate.deleteMany({ where: { tenantId: tenant.id } });

  await prisma.material.createMany({
    data: materialTemplates.map((material) => ({
      tenantId: tenant.id,
      title: material.title,
      description: material.description,
      type: "link",
      url: material.url,
      customerType: material.customerType
    }))
  });

  await prisma.taskTemplate.createMany({
    data: taskTemplateSeeds.map((template) => ({
      tenantId: tenant.id,
      name: template.name,
      title: template.title,
      description: template.description,
      type: template.type,
      priority: template.priority,
      defaultDueDays: template.defaultDueDays,
      customerType: template.customerType,
      stage: template.stage ?? null,
      isActive: true
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
      { tenantId: tenant.id, leadId: lead.id, tagName: lead.stage, tagGroup: "STAGE" as const }
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
    name: "整木样板企业",
    industry: "整木高定",
    users: {
      admin: "boss@zhengmu.local",
      operator: "operator@zhengmu.local",
      sales: "sales@zhengmu.local"
    },
    leads: zhengmuLeads
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
          content: "第二租户工厂客户，继续用于隔离验证。",
          nextAction: "确认隔离租户数据不可见",
          stageBefore: "NEW",
          stageAfter: "CONTACTED",
          createdDaysAgo: 2,
          nextFollowOffsetDays: 2
        },
        task: {
          title: "隔离验证任务：隔离客户B",
          description: "用于验证第二租户任务不会泄露到主样板企业。",
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
