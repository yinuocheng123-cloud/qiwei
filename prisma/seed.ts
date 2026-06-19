/*
 * 文件说明：该文件重写为 MarketClaw V3.0 最小演示种子。
 * 功能说明：创建平台管理员、单租户、两个企业、三条业务线，并写入 Contact + 多 Lead、资料、策略、任务模板与跟进演示数据。
 *
 * 结构概览：
 *   第一部分：导入依赖与基础类型
 *   第二部分：V3.0 演示配置
 *   第三部分：清理与基础账号写入
 *   第四部分：企业、业务线、资料、策略与任务模板写入
 *   第五部分：Contact / Lead / FollowUp / FollowTask 演示样本写入
 */
import { PrismaClient, type CustomerType, type FollowTaskPriority, type FollowTaskType, type IntentionLevel, type LeadSource, type LeadStage, type NeedType } from "@prisma/client";
import bcrypt from "bcryptjs";
import { CNAS_BUSINESS_LINE_SLUG } from "@/lib/cnas";

const prisma = new PrismaClient();
const LOCAL_TEST_PASSWORD = "c123456";
const TENANT_SLUG = "zhengmu-platform";

type EnterpriseSeed = {
  key: "hangyu" | "youshi";
  name: string;
  description: string;
  sortOrder: number;
};

type BusinessLineSeed = {
  enterpriseKey: EnterpriseSeed["key"];
  key: "cnas" | "zhengmu" | "youxi";
  name: string;
  slug: string;
  description: string;
  customerTypes: Array<{ value: CustomerType; label: string }>;
  materials: Array<{ title: string; description: string; customerType: CustomerType }>;
  taskTemplates: Array<{
    name: string;
    title: string;
    description: string;
    type: FollowTaskType;
    priority: FollowTaskPriority;
    defaultDueDays: number;
    customerType: CustomerType;
    stage?: LeadStage;
  }>;
  strategies: Array<{
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
  }>;
  defaultNextAction: string;
  recommendedTags: Array<{ tagName: string; tagGroup: "业务标签" | "需求标签" | "阶段标签" }>;
};

type ContactLeadSeed = {
  contact: {
    name: string;
    company?: string;
    phone: string;
    wechat?: string;
    city?: string;
    industry?: string;
    notes?: string;
    enterpriseKey: EnterpriseSeed["key"];
  };
  leads: Array<{
    name: string;
    businessLineKey: BusinessLineSeed["key"];
    customerType: CustomerType;
    source: LeadSource;
    needType: NeedType;
    intentionLevel: IntentionLevel;
    stage: LeadStage;
    owner: "admin" | "operator" | "sales";
    message: string;
    nextFollowAtOffsetDays: number;
    lastFollowAtOffsetDays: number;
    followUp: {
      content: string;
      nextAction: string;
      stageBefore: LeadStage;
      stageAfter: LeadStage;
    };
    task: {
      title: string;
      description: string;
      type: FollowTaskType;
      priority: FollowTaskPriority;
      dueOffsetDays: number;
    };
  }>;
};

function daysFromNow(days: number, hour = 10, minute = 0) {
  const value = new Date();
  value.setDate(value.getDate() + days);
  value.setHours(hour, minute, 0, 0);
  return value;
}

const enterprises: EnterpriseSeed[] = [
  {
    key: "hangyu",
    name: "杭育公司",
    description: "承接 CNAS 认可咨询、实验室诊断与跟进推进。",
    sortOrder: 10
  },
  {
    key: "youshi",
    name: "优势文化",
    description: "承接整木网与柚喜饰界两条业务线的客户工作台。",
    sortOrder: 20
  }
];

const businessLineSeeds: BusinessLineSeed[] = [
  {
    enterpriseKey: "hangyu",
    key: "cnas",
    name: "CNAS认可指南",
    slug: CNAS_BUSINESS_LINE_SLUG,
    description: "面向实验室认可咨询与诊断承接，按认可阶段推进资料、评估和诊断建议。",
    customerTypes: [
      { value: "CNAS_LAB_OWNER", label: "实验室负责人" },
      { value: "CNAS_BUSINESS_OWNER", label: "企业老板" },
      { value: "CNAS_QUALITY_OWNER", label: "质量负责人" },
      { value: "CNAS_TECH_OWNER", label: "技术负责人" },
      { value: "CNAS_TESTING_AGENCY", label: "检测机构客户" },
      { value: "CNAS_CONSULTING_INTENT", label: "咨询意向客户" }
    ],
    materials: [
      { title: "认可路径判断表", description: "用于判断当前实验室处于哪一类认可启动阶段。", customerType: "CNAS_LAB_OWNER" },
      { title: "实验室状态诊断表", description: "梳理人员、设备、文件与运行记录准备情况。", customerType: "CNAS_QUALITY_OWNER" },
      { title: "认可准备清单", description: "梳理启动前必须优先准备的基础项。", customerType: "CNAS_CONSULTING_INTENT" }
    ],
    taskTemplates: [
      {
        name: "发送认可路径表",
        title: "发送认可路径判断表",
        description: "先让客户判断当前认可阶段，再进入电话评估。",
        type: "SEND_MATERIAL",
        priority: "HIGH",
        defaultDueDays: 0,
        customerType: "CNAS_LAB_OWNER",
        stage: "NEW"
      },
      {
        name: "电话评估",
        title: "安排 CNAS 电话评估",
        description: "围绕人员、设备、文件与认可目标做电话评估。",
        type: "PHONE_CALL",
        priority: "HIGH",
        defaultDueDays: 1,
        customerType: "CNAS_LAB_OWNER",
        stage: "MATERIAL_SENT"
      }
    ],
    strategies: [
      {
        customerType: "CNAS_LAB_OWNER",
        name: "实验室负责人承接策略",
        painPoints: ["认可范围不清", "准备顺序不清", "资料准备不足"],
        firstMaterials: ["认可路径判断表", "实验室状态诊断表"],
        welcomeScript: "先帮您判断当前实验室更适合走哪一类认可路径，再决定资料准备顺序。",
        day3Script: "如果方便，我先根据人员、设备和现有文件情况做一次基础判断。",
        day7Script: "建议先把认可范围、运行记录和文件准备顺序收口，避免返工。",
        day15Script: "如果近期要推进申请，可以安排一次电话评估，把节奏梳理清楚。",
        manualTriggerRules: ["询问认可流程", "询问准备清单", "询问评估顺序"],
        recommendedNextAction: "先发送认可路径判断表，再安排电话评估。",
        recommendedPrivateContent: "优先判断客户属于待初步判断、待电话评估还是待出诊断建议。"
      }
    ],
    defaultNextAction: "先判断认可阶段，再补发路径表和诊断建议。",
    recommendedTags: [
      { tagName: "CNAS客户", tagGroup: "业务标签" },
      { tagName: "待初步判断", tagGroup: "阶段标签" }
    ]
  },
  {
    enterpriseKey: "youshi",
    key: "zhengmu",
    name: "整木网",
    slug: "zhengmu-growth",
    description: "面向整木行业会员、GEO 推广、门店和供应链合作承接。",
    customerTypes: [
      { value: "ZHENGMU_FACTORY_OWNER", label: "整木工厂老板" },
      { value: "ZHENGMU_GEO_INTENT", label: "GEO意向客户" },
      { value: "ZHENGMU_MEMBERSHIP_INTENT", label: "会员意向客户" },
      { value: "ZHENGMU_STORE_CLIENT", label: "门店客户" },
      { value: "ZHENGMU_SUPPLIER_CLIENT", label: "供应商客户" },
      { value: "ZHENGMU_TIANTUAN_CLIENT", label: "天团客户" }
    ],
    materials: [
      { title: "整木网会员权益", description: "介绍会员展示、联盟权益与品牌曝光方式。", customerType: "ZHENGMU_MEMBERSHIP_INTENT" },
      { title: "行业排名内容样稿", description: "用于展示 GEO 与行业排名内容包装方式。", customerType: "ZHENGMU_GEO_INTENT" },
      { title: "官网诊断表", description: "用于诊断官网、收录与搜索承接基础情况。", customerType: "ZHENGMU_GEO_INTENT" },
      { title: "品牌展示案例", description: "展示会员品牌与整木工厂案例呈现方式。", customerType: "ZHENGMU_FACTORY_OWNER" },
      { title: "优选联盟说明", description: "介绍联盟合作、供应链协同与资源置换。", customerType: "ZHENGMU_TIANTUAN_CLIENT" }
    ],
    taskTemplates: [
      {
        name: "发送会员权益",
        title: "发送整木网会员权益",
        description: "先给客户看会员权益与品牌展示案例。",
        type: "SEND_MATERIAL",
        priority: "HIGH",
        defaultDueDays: 0,
        customerType: "ZHENGMU_MEMBERSHIP_INTENT",
        stage: "NEW"
      },
      {
        name: "发送 GEO 诊断表",
        title: "发送官网诊断表",
        description: "先诊断客户官网与收录情况，再推进 GEO 说明。",
        type: "SEND_MATERIAL",
        priority: "HIGH",
        defaultDueDays: 0,
        customerType: "ZHENGMU_GEO_INTENT",
        stage: "NEW"
      }
    ],
    strategies: [
      {
        customerType: "ZHENGMU_GEO_INTENT",
        name: "整木网 GEO 意向承接策略",
        painPoints: ["不知道 GEO 是什么", "官网收录差", "内容样稿不足"],
        firstMaterials: ["行业排名内容样稿", "官网诊断表"],
        welcomeScript: "先用官网诊断表判断现状，再看 GEO 推广说明和行业排名样稿。",
        day3Script: "如果方便，把官网链接发我，我先判断搜索承接基础。",
        day7Script: "建议先补官网承接页和行业内容样稿，再谈预算更有效。",
        day15Script: "如果准备推进，可以安排一次诊断沟通，把 GEO 路径讲清楚。",
        manualTriggerRules: ["询问 GEO", "询问官网", "询问搜索排名"],
        recommendedNextAction: "先发 GEO 推广说明、行业排名内容样稿和官网诊断表。",
        recommendedPrivateContent: "优先看客户是否已有官网、样稿和收录基础。"
      },
      {
        customerType: "ZHENGMU_MEMBERSHIP_INTENT",
        name: "整木网会员意向承接策略",
        painPoints: ["会员权益不清", "不知道能带来什么展示", "联盟价值模糊"],
        firstMaterials: ["整木网会员权益", "品牌展示案例", "优选联盟说明"],
        welcomeScript: "先让客户看会员权益、品牌展示案例和联盟说明，再判断推进重点。",
        day3Script: "如果方便，先说下更在意展示、线索还是联盟合作。",
        day7Script: "建议先结合品牌展示案例判断匹配度，再谈会员节奏。",
        day15Script: "如果准备加入，可以安排一次权益说明，把价值边界讲清楚。",
        manualTriggerRules: ["询问会员", "询问展示案例", "询问联盟说明"],
        recommendedNextAction: "先发会员权益、品牌展示案例和优选联盟说明。",
        recommendedPrivateContent: "优先判断客户更看重展示曝光还是联盟合作。"
      },
      {
        customerType: "ZHENGMU_TIANTUAN_CLIENT",
        name: "整木网天团合作承接策略",
        painPoints: ["合作边界不清", "资源置换方式模糊", "案例支撑不足"],
        firstMaterials: ["优选联盟说明", "品牌展示案例"],
        welcomeScript: "先用联盟说明和案例说明合作边界，再决定下一步对接方式。",
        day3Script: "先判断客户更关心资源置换、联名活动还是渠道合作。",
        day7Script: "建议先用案例讲清合作形式，再推进具体动作。",
        day15Script: "如果准备推进，可安排一次合作沟通，把规则和边界讲清楚。",
        manualTriggerRules: ["询问合作规则", "询问资源置换", "询问联名活动"],
        recommendedNextAction: "先发优选联盟说明和品牌展示案例。",
        recommendedPrivateContent: "优先收口合作边界与责任分工。"
      }
    ],
    defaultNextAction: "先判断客户属于会员、GEO、门店还是供应链场景，再发对应资料。",
    recommendedTags: [
      { tagName: "整木网客户", tagGroup: "业务标签" },
      { tagName: "高意向", tagGroup: "需求标签" }
    ]
  },
  {
    enterpriseKey: "youshi",
    key: "youxi",
    name: "柚喜饰界",
    slug: "youxi-decoration",
    description: "面向柚木地板、整装、家具与设计师合作承接。",
    customerTypes: [
      { value: "YOUXI_FLOORING_CLIENT", label: "柚木地板客户" },
      { value: "YOUXI_WHOLE_HOME_CLIENT", label: "柚木整装客户" },
      { value: "YOUXI_FURNITURE_CLIENT", label: "柚木家具客户" },
      { value: "YOUXI_DESIGNER_CLIENT", label: "设计师客户" },
      { value: "YOUXI_VENDOR_CLIENT", label: "推荐厂商客户" },
      { value: "YOUXI_COMMUNITY_CLIENT", label: "社群交流客户" }
    ],
    materials: [
      { title: "柚木空间案例", description: "展示柚木空间与整装案例。", customerType: "YOUXI_DESIGNER_CLIENT" },
      { title: "材料说明", description: "介绍柚木材料、稳定性与使用场景。", customerType: "YOUXI_DESIGNER_CLIENT" },
      { title: "供应链能力介绍", description: "说明交付、产能与供应链协同能力。", customerType: "YOUXI_VENDOR_CLIENT" },
      { title: "合作规则", description: "介绍设计合作、推荐规则与协作边界。", customerType: "YOUXI_DESIGNER_CLIENT" }
    ],
    taskTemplates: [
      {
        name: "发送设计合作资料",
        title: "发送设计合作资料包",
        description: "给设计师客户发送案例、材料与合作规则。",
        type: "SEND_MATERIAL",
        priority: "HIGH",
        defaultDueDays: 0,
        customerType: "YOUXI_DESIGNER_CLIENT",
        stage: "NEW"
      }
    ],
    strategies: [
      {
        customerType: "YOUXI_DESIGNER_CLIENT",
        name: "柚喜饰界设计师承接策略",
        painPoints: ["案例不足", "材料说明不清", "合作规则不清"],
        firstMaterials: ["柚木空间案例", "材料说明", "供应链能力介绍", "合作规则"],
        welcomeScript: "先看案例、材料说明和合作规则，再判断项目是否适合协同推进。",
        day3Script: "如果方便，先说下项目类型和设计方向，我帮您匹配案例。",
        day7Script: "建议先把材料边界、供应链能力和合作规则说清楚，再推进报价。",
        day15Script: "如果准备合作，可安排一次项目沟通，把节奏和边界讲清楚。",
        manualTriggerRules: ["询问案例", "询问材料", "询问合作方式"],
        recommendedNextAction: "先发柚木空间案例、材料说明、供应链能力介绍和合作规则。",
        recommendedPrivateContent: "优先判断客户属于设计合作、整装咨询还是推荐转介绍场景。"
      }
    ],
    defaultNextAction: "先判断客户属于地板、整装、家具还是设计合作，再发对应资料。",
    recommendedTags: [
      { tagName: "柚喜饰界客户", tagGroup: "业务标签" },
      { tagName: "待进群", tagGroup: "阶段标签" }
    ]
  }
];

const contactLeadSeeds: ContactLeadSeed[] = [
  {
    contact: {
      enterpriseKey: "youshi",
      name: "张总",
      company: "某整木工厂",
      phone: "13800000001",
      wechat: "zhangzong-zhengmu",
      city: "湖州南浔",
      industry: "整木制造",
      notes: "同一 Contact 对应多个整木网业务线索演示样本。"
    },
    leads: [
      {
        name: "张总 - 整木网会员意向",
        businessLineKey: "zhengmu",
        customerType: "ZHENGMU_MEMBERSHIP_INTENT",
        source: "website",
        needType: "COOPERATION",
        intentionLevel: "HIGH",
        stage: "MATERIAL_SENT",
        owner: "sales",
        message: "关注整木网会员权益、品牌展示案例和优选联盟说明。",
        nextFollowAtOffsetDays: 1,
        lastFollowAtOffsetDays: -1,
        followUp: {
          content: "已发送会员权益、品牌展示案例和优选联盟说明，客户准备内部讨论。",
          nextAction: "确认更在意展示曝光还是联盟合作。",
          stageBefore: "NEW",
          stageAfter: "MATERIAL_SENT"
        },
        task: {
          title: "跟进张总会员意向",
          description: "确认会员权益包是否看完，并收口下一步沟通重点。",
          type: "SEND_MATERIAL",
          priority: "HIGH",
          dueOffsetDays: 1
        }
      },
      {
        name: "张总 - GEO推广意向",
        businessLineKey: "zhengmu",
        customerType: "ZHENGMU_GEO_INTENT",
        source: "referral",
        needType: "GROWTH_SYSTEM",
        intentionLevel: "STRONG",
        stage: "CONTACTED",
        owner: "operator",
        message: "想了解 GEO 推广说明、行业排名内容样稿和官网诊断表。",
        nextFollowAtOffsetDays: 0,
        lastFollowAtOffsetDays: -1,
        followUp: {
          content: "已完成首轮诊断沟通，客户会补充官网与样稿现状。",
          nextAction: "等待官网信息后输出诊断建议。",
          stageBefore: "NEW",
          stageAfter: "CONTACTED"
        },
        task: {
          title: "跟进张总 GEO 诊断",
          description: "收集官网信息并准备 GEO 诊断建议。",
          type: "PHONE_CALL",
          priority: "URGENT",
          dueOffsetDays: 0
        }
      },
      {
        name: "张总 - 天团合作意向",
        businessLineKey: "zhengmu",
        customerType: "ZHENGMU_TIANTUAN_CLIENT",
        source: "offline_event",
        needType: "COOPERATION",
        intentionLevel: "MEDIUM",
        stage: "NEW",
        owner: "admin",
        message: "对天团合作与优选联盟说明有兴趣，想先看合作边界。",
        nextFollowAtOffsetDays: 2,
        lastFollowAtOffsetDays: -2,
        followUp: {
          content: "活动后补发合作说明，客户先内部评估合作边界。",
          nextAction: "确认资源置换与联名活动意向。",
          stageBefore: "NEW",
          stageAfter: "NEW"
        },
        task: {
          title: "跟进张总天团合作",
          description: "围绕资源置换和合作规则做二次沟通。",
          type: "WECHAT_FOLLOW",
          priority: "NORMAL",
          dueOffsetDays: 2
        }
      }
    ]
  },
  {
    contact: {
      enterpriseKey: "youshi",
      name: "李设计师",
      company: "南浔木作设计工作室",
      phone: "13800000002",
      wechat: "li-designer",
      city: "杭州",
      industry: "设计服务",
      notes: "柚喜饰界设计师客户演示样本。"
    },
    leads: [
      {
        name: "李设计师 - 柚木整装咨询",
        businessLineKey: "youxi",
        customerType: "YOUXI_DESIGNER_CLIENT",
        source: "xiaohongshu",
        needType: "PRODUCT_INQUIRY",
        intentionLevel: "HIGH",
        stage: "MATERIAL_SENT",
        owner: "sales",
        message: "想看柚木空间案例、材料说明、供应链能力介绍和合作规则。",
        nextFollowAtOffsetDays: 1,
        lastFollowAtOffsetDays: -1,
        followUp: {
          content: "已发送柚木空间案例、材料说明和合作规则，客户在准备项目图纸。",
          nextAction: "等待项目图纸后安排项目沟通。",
          stageBefore: "NEW",
          stageAfter: "MATERIAL_SENT"
        },
        task: {
          title: "跟进李设计师整装咨询",
          description: "确认资料阅读情况并推动项目沟通。",
          type: "SEND_MATERIAL",
          priority: "HIGH",
          dueOffsetDays: 1
        }
      }
    ]
  },
  {
    contact: {
      enterpriseKey: "hangyu",
      name: "王主任",
      company: "华检实验室",
      phone: "13800000003",
      wechat: "wang-cnac",
      city: "苏州",
      industry: "实验室服务",
      notes: "CNAS 实验室负责人演示样本。"
    },
    leads: [
      {
        name: "王主任 - CNAS认可咨询",
        businessLineKey: "cnas",
        customerType: "CNAS_LAB_OWNER",
        source: "gongzhonghao",
        needType: "BOOK_CONSULTATION",
        intentionLevel: "HIGH",
        stage: "DIAGNOSED",
        owner: "operator",
        message: "已做初步路径判断，待电话评估实验室准备状态。",
        nextFollowAtOffsetDays: 1,
        lastFollowAtOffsetDays: 0,
        followUp: {
          content: "已发送认可路径判断表和实验室状态诊断表，客户待补充设备与记录情况。",
          nextAction: "安排电话评估，确认认可范围与资料准备顺序。",
          stageBefore: "MATERIAL_SENT",
          stageAfter: "DIAGNOSED"
        },
        task: {
          title: "跟进王主任 CNAS 评估",
          description: "电话评估人员、设备、文件与申请节奏。",
          type: "PHONE_CALL",
          priority: "HIGH",
          dueOffsetDays: 1
        }
      }
    ]
  }
];

async function clearTenantData(tenantId: string) {
  await prisma.auditLog.deleteMany({ where: { tenantId } });
  await prisma.wecomCallbackEvent.deleteMany({ where: { tenantId } });
  await prisma.communicationComplianceConfig.deleteMany({ where: { tenantId } });
  await prisma.reminderQueue.deleteMany({ where: { tenantId } });
  await prisma.marketClawReplyFeedback.deleteMany({ where: { tenantId } });
  await prisma.replySuggestion.deleteMany({ where: { tenantId } });
  await prisma.followTask.deleteMany({ where: { tenantId } });
  await prisma.followUp.deleteMany({ where: { tenantId } });
  await prisma.leadTag.deleteMany({ where: { tenantId } });
  await prisma.leadSourceAttribution.deleteMany({ where: { tenantId } });
  await prisma.intakeForm.deleteMany({ where: { tenantId } });
  await prisma.importRow.deleteMany({ where: { tenantId } });
  await prisma.importBatch.deleteMany({ where: { tenantId } });
  await prisma.marketClawReplyDraft.deleteMany({ where: { tenantId } });
  await prisma.marketClawTrainingCase.deleteMany({ where: { tenantId } });
  await prisma.marketClawKnowledgeItem.deleteMany({ where: { tenantId } });
  await prisma.lead.deleteMany({ where: { tenantId } });
  await prisma.contact.deleteMany({ where: { tenantId } });
  await prisma.customerTypeStrategy.deleteMany({ where: { tenantId } });
  await prisma.material.deleteMany({ where: { tenantId } });
  await prisma.taskTemplate.deleteMany({ where: { tenantId } });
  await prisma.businessLine.deleteMany({ where: { tenantId } });
  await prisma.enterprise.deleteMany({ where: { tenantId } });
}

async function main() {
  const passwordHash = await bcrypt.hash(LOCAL_TEST_PASSWORD, 10);

  await prisma.user.upsert({
    where: { email: "admin@marketclaw.local" },
    update: {
      passwordHash,
      role: "PLATFORM_ADMIN",
      tenantId: null,
      status: "active",
      name: "内部管理员"
    },
    create: {
      email: "admin@marketclaw.local",
      passwordHash,
      role: "PLATFORM_ADMIN",
      name: "内部管理员"
    }
  });

  const tenant = await prisma.tenant.upsert({
    where: { slug: TENANT_SLUG },
    update: {
      name: "MarketClaw",
      industry: "多企业多业务线客户承接工作台",
      templateKey: "marketclaw-v3-foundation",
      templateName: "V3.0 企业 / 业务线 / Contact / Lead 基础演示",
      plan: "flagship",
      status: "active"
    },
    create: {
      name: "MarketClaw",
      slug: TENANT_SLUG,
      industry: "多企业多业务线客户承接工作台",
      templateKey: "marketclaw-v3-foundation",
      templateName: "V3.0 企业 / 业务线 / Contact / Lead 基础演示",
      plan: "flagship",
      expiredAt: new Date("2027-12-31T23:59:59.000Z")
    }
  });

  const admin = await prisma.user.upsert({
    where: { email: "boss@marketclaw.local" },
    update: { tenantId: tenant.id, passwordHash, role: "TENANT_ADMIN", status: "active", name: "老板端" },
    create: { tenantId: tenant.id, email: "boss@marketclaw.local", passwordHash, role: "TENANT_ADMIN", name: "老板端" }
  });
  const operator = await prisma.user.upsert({
    where: { email: "opr@marketclaw.local" },
    update: { tenantId: tenant.id, passwordHash, role: "OPERATOR", status: "active", name: "运营端" },
    create: { tenantId: tenant.id, email: "opr@marketclaw.local", passwordHash, role: "OPERATOR", name: "运营端" }
  });
  const sales = await prisma.user.upsert({
    where: { email: "sale@marketclaw.local" },
    update: { tenantId: tenant.id, passwordHash, role: "SALES", status: "active", name: "销售端" },
    create: { tenantId: tenant.id, email: "sale@marketclaw.local", passwordHash, role: "SALES", name: "销售端" }
  });

  await clearTenantData(tenant.id);

  const ownerMap = {
    admin: admin.id,
    operator: operator.id,
    sales: sales.id
  } as const;

  const createdEnterprises = new Map<string, string>();
  for (const enterprise of enterprises) {
    const created = await prisma.enterprise.create({
      data: {
        tenantId: tenant.id,
        key: enterprise.key,
        name: enterprise.name,
        description: enterprise.description,
        sortOrder: enterprise.sortOrder,
        status: "ACTIVE"
      }
    });
    createdEnterprises.set(enterprise.key, created.id);
  }

  const createdBusinessLines = new Map<string, { id: string; enterpriseId: string; name: string }>();
  for (const line of businessLineSeeds) {
    const enterpriseId = createdEnterprises.get(line.enterpriseKey)!;
    const created = await prisma.businessLine.create({
      data: {
        tenantId: tenant.id,
        enterpriseId,
        key: line.key,
        name: line.name,
        slug: line.slug,
        description: line.description,
        status: "ACTIVE",
        category: line.key === "cnas" ? "SERVICE" : line.key === "zhengmu" ? "MEMBERSHIP" : "PRODUCT",
        priority: line.key === "cnas" ? 10 : line.key === "zhengmu" ? 20 : 30,
        targetCustomerTypes: line.customerTypes.map((item) => item.value),
        recommendedTagNames: line.recommendedTags,
        defaultNextAction: line.defaultNextAction,
        notes: `${line.name} 演示业务线`
      }
    });
    createdBusinessLines.set(line.key, { id: created.id, enterpriseId, name: line.name });
  }

  const materialIdsByBusinessLine = new Map<string, string[]>();
  for (const line of businessLineSeeds) {
    const scope = createdBusinessLines.get(line.key)!;
    const ids: string[] = [];
    for (const material of line.materials) {
      const created = await prisma.material.create({
        data: {
          tenantId: tenant.id,
          enterpriseId: scope.enterpriseId,
          businessLineId: scope.id,
          title: material.title,
          description: material.description,
          type: "link",
          url: `https://example.com/${line.key}/${encodeURIComponent(material.title)}`,
          customerType: material.customerType
        }
      });
      ids.push(created.id);
    }
    materialIdsByBusinessLine.set(line.key, ids);
  }

  const taskTemplateIdsByBusinessLine = new Map<string, string[]>();
  for (const line of businessLineSeeds) {
    const scope = createdBusinessLines.get(line.key)!;
    const ids: string[] = [];
    for (const template of line.taskTemplates) {
      const created = await prisma.taskTemplate.create({
        data: {
          tenantId: tenant.id,
          enterpriseId: scope.enterpriseId,
          businessLineId: scope.id,
          name: template.name,
          title: template.title,
          description: template.description,
          type: template.type,
          priority: template.priority,
          defaultDueDays: template.defaultDueDays,
          customerType: template.customerType,
          stage: template.stage ?? null,
          isActive: true
        }
      });
      ids.push(created.id);
    }
    taskTemplateIdsByBusinessLine.set(line.key, ids);
  }

  for (const line of businessLineSeeds) {
    const scope = createdBusinessLines.get(line.key)!;
    for (const strategy of line.strategies) {
      await prisma.customerTypeStrategy.create({
        data: {
          tenantId: tenant.id,
          enterpriseId: scope.enterpriseId,
          businessLineId: scope.id,
          customerType: strategy.customerType,
          name: strategy.name,
          painPoints: strategy.painPoints,
          firstMaterials: strategy.firstMaterials,
          welcomeScript: strategy.welcomeScript,
          day3Script: strategy.day3Script,
          day7Script: strategy.day7Script,
          day15Script: strategy.day15Script,
          manualTriggerRules: strategy.manualTriggerRules,
          recommendedNextAction: strategy.recommendedNextAction,
          recommendedPrivateContent: strategy.recommendedPrivateContent
        }
      });
    }

    await prisma.businessLine.update({
      where: { id: scope.id },
      data: {
        recommendedMaterialIds: materialIdsByBusinessLine.get(line.key) ?? [],
        recommendedTaskTemplateIds: taskTemplateIdsByBusinessLine.get(line.key) ?? []
      }
    });
  }

  for (const seed of contactLeadSeeds) {
    const enterpriseId = createdEnterprises.get(seed.contact.enterpriseKey)!;
    const contact = await prisma.contact.create({
      data: {
        tenantId: tenant.id,
        enterpriseId,
        name: seed.contact.name,
        company: seed.contact.company,
        phone: seed.contact.phone,
        wechat: seed.contact.wechat,
        city: seed.contact.city,
        industry: seed.contact.industry,
        notes: seed.contact.notes
      }
    });

    for (const leadSeed of seed.leads) {
      const scope = createdBusinessLines.get(leadSeed.businessLineKey)!;
      const nextFollowAt = daysFromNow(leadSeed.nextFollowAtOffsetDays, 18, 0);
      const lastFollowAt = daysFromNow(leadSeed.lastFollowAtOffsetDays, 10, 0);
      const lead = await prisma.lead.create({
        data: {
          tenantId: tenant.id,
          enterpriseId: scope.enterpriseId,
          businessLineId: scope.id,
          contactId: contact.id,
          name: leadSeed.name,
          phone: contact.phone,
          wechat: contact.wechat,
          company: contact.company,
          industry: contact.industry,
          city: contact.city,
          source: leadSeed.source,
          customerType: leadSeed.customerType,
          needType: leadSeed.needType,
          intentionLevel: leadSeed.intentionLevel,
          stage: leadSeed.stage,
          dealStatus: leadSeed.stage === "DEAL_DONE" ? "WON" : leadSeed.stage === "LOST" ? "LOST" : "PENDING",
          message: leadSeed.message,
          ownerId: ownerMap[leadSeed.owner],
          nextFollowAt,
          lastFollowAt
        }
      });

      await prisma.leadTag.createMany({
        data: [
          { tenantId: tenant.id, leadId: lead.id, tagName: leadSeed.source, tagGroup: "SOURCE" },
          { tenantId: tenant.id, leadId: lead.id, tagName: leadSeed.customerType, tagGroup: "CUSTOMER_TYPE" },
          { tenantId: tenant.id, leadId: lead.id, tagName: leadSeed.stage, tagGroup: "STAGE" },
          { tenantId: tenant.id, leadId: lead.id, tagName: scope.name, tagGroup: "BUSINESS_LINE" }
        ]
      });

      await prisma.followUp.create({
        data: {
          tenantId: tenant.id,
          enterpriseId: scope.enterpriseId,
          businessLineId: scope.id,
          leadId: lead.id,
          userId: ownerMap[leadSeed.owner],
          content: leadSeed.followUp.content,
          nextAction: leadSeed.followUp.nextAction,
          nextFollowAt,
          stageBefore: leadSeed.followUp.stageBefore,
          stageAfter: leadSeed.followUp.stageAfter,
          createdAt: lastFollowAt
        }
      });

      await prisma.followTask.create({
        data: {
          tenantId: tenant.id,
          enterpriseId: scope.enterpriseId,
          businessLineId: scope.id,
          leadId: lead.id,
          ownerId: ownerMap[leadSeed.owner],
          createdById: admin.id,
          title: leadSeed.task.title,
          description: leadSeed.task.description,
          type: leadSeed.task.type,
          status: "PENDING",
          priority: leadSeed.task.priority,
          dueAt: daysFromNow(leadSeed.task.dueOffsetDays, 18, 0)
        }
      });

      await prisma.leadSourceAttribution.create({
        data: {
          tenantId: tenant.id,
          enterpriseId: scope.enterpriseId,
          businessLineId: scope.id,
          leadId: lead.id,
          sourceChannel: leadSeed.source,
          sourceProject: scope.name,
          sourceCampaign: `${scope.name} 演示种子`,
          sourceScene: "seed-demo",
          sourceTouchpoint: "seed.ts",
          sourceStaffName: leadSeed.owner === "sales" ? "销售端" : leadSeed.owner === "operator" ? "运营端" : "老板端",
          sourceStaffId: ownerMap[leadSeed.owner],
          sourcePage: `/app/${TENANT_SLUG}/leads`,
          sourceContent: leadSeed.message,
          utmSource: "seed",
          utmMedium: "local",
          utmCampaign: scope.name,
          utmContent: leadSeed.customerType,
          firstSeenAt: lastFollowAt,
          submittedAt: lastFollowAt
        }
      });
    }
  }

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
