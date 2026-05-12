/*
 * 文件说明：该文件为 V1.1 本地开发环境写入可验证的演示数据。
 * 功能说明：创建平台管理员、两个租户、企业角色账号、策略库、资料包和多来源线索。
 *
 * 结构概览：
 *   第一部分：导入依赖
 *   第二部分：策略模板与线索模板
 *   第三部分：租户数据写入函数
 *   第四部分：主种子流程
 */
import { PrismaClient, type CustomerType, type IntentionLevel, type LeadSource, type LeadStage, type NeedType } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const strategyTemplates = [
  {
    customerType: "OWNER_CLIENT" as CustomerType,
    name: "业主客户转化策略",
    painPoints: ["效果", "环保", "价格", "交付", "售后"],
    firstMaterials: ["案例图册", "避坑清单", "交付流程", "环保说明"],
    welcomeScript: "您好，已收到您的整木定制需求。我们先发您案例图册和避坑清单，方便您快速判断风格、预算和交付重点。",
    day3Script: "您看过案例后，比较关注效果、预算还是环保？我可以按您的房屋情况先给一个初步建议。",
    day7Script: "如果您方便发一下户型或面积，我们可以帮您判断适合的整木方案和大致推进节奏。",
    day15Script: "之前给您的资料是否有帮助？近期如果有装修计划，可以先预约一次初步方案沟通。",
    manualTriggerRules: ["提供房屋信息", "询问价格", "预约设计", "发送户型图", "询问到店"],
    recommendedNextAction: "预约初步方案",
    recommendedPrivateContent: "真实交付案例、环保检测说明、工地节点记录"
  },
  {
    customerType: "DEALER_CLIENT" as CustomerType,
    name: "经销商客户转化策略",
    painPoints: ["利润", "政策", "区域", "支持", "样板", "风险"],
    firstMaterials: ["招商手册", "产品体系", "政策说明", "样板门店案例"],
    welcomeScript: "您好，感谢关注合作加盟。先发您招商手册和产品体系，您可以先看品牌支持、区域政策和样板案例。",
    day3Script: "您目前主要关注代理利润、区域保护，还是门店落地支持？我可以按城市情况给您说明。",
    day7Script: "如果您已有意向城市，我们可以进一步确认区域政策和样板支持方式。",
    day15Script: "近期是否方便安排一次招商沟通？也可以先预约到厂或线上看样板案例。",
    manualTriggerRules: ["提供城市", "询问代理", "询问利润", "询问区域保护", "想看工厂"],
    recommendedNextAction: "安排招商沟通或到厂考察",
    recommendedPrivateContent: "样板门店案例、经销商扶持政策、招商答疑"
  },
  {
    customerType: "DESIGNER_CLIENT" as CustomerType,
    name: "设计师客户转化策略",
    painPoints: ["审美", "落地", "配合", "材料", "案例", "客户背书"],
    firstMaterials: ["高定案例", "工艺节点", "材料样册", "设计师合作说明"],
    welcomeScript: "您好，已收到您的合作需求。先发您高定案例和工艺节点资料，方便评估风格、材料和落地配合。",
    day3Script: "您近期是否有项目需要整木配合？如果有图纸或风格方向，我们可以先做工艺和材料建议。",
    day7Script: "我们可以按项目阶段配合报价、深化和交付节点，您更需要哪一块支持？",
    day15Script: "如果近期有客户在看高定方案，可以先建立项目沟通，避免后期材料和工艺返工。",
    manualTriggerRules: ["有项目", "发图纸", "问报价", "问工艺", "想看样板"],
    recommendedNextAction: "建立项目合作沟通",
    recommendedPrivateContent: "高定落地案例、材料样册、设计师合作案例"
  },
  {
    customerType: "FACTORY_CLIENT" as CustomerType,
    name: "工厂客户增长策略",
    painPoints: ["获客", "招商", "品牌", "成交", "企业微信", "AI推广"],
    firstMaterials: ["增长诊断表", "企业微信承接自查表", "品牌增信方案"],
    welcomeScript: "您好，已收到您的增长系统咨询。先发您增长诊断表和企微承接自查表，方便判断当前获客与转化断点。",
    day3Script: "您现在更卡在获客、承接、招商还是销售跟进？我可以先按现状给您一个诊断方向。",
    day7Script: "如果方便说一下企业规模和主要渠道，我们可以判断适合先搭企微承接还是先做内容获客。",
    day15Script: "近期如果准备系统化做增长，建议先做一次深度诊断，把渠道、企微、销售跟进和看板串起来。",
    manualTriggerRules: ["说企业规模", "问合作费用", "问系统怎么做", "想做推广", "想看案例"],
    recommendedNextAction: "安排深度诊断",
    recommendedPrivateContent: "增长案例、企微承接流程、老板看板样例"
  }
];

type LeadTemplate = {
  id: string;
  name: string;
  phone: string;
  source: LeadSource;
  customerType: CustomerType;
  needType: NeedType;
  intentionLevel: IntentionLevel;
  stage: LeadStage;
  message: string;
  city: string;
  owner: "sales" | "admin" | "operator";
};

const zhengmuLeads: LeadTemplate[] = [
  { id: "demo-lead-001", name: "陈先生", phone: "13800000001", source: "douyin", customerType: "OWNER_CLIENT", needType: "BOOK_CONSULTATION", intentionLevel: "STRONG", stage: "NEW", city: "杭州", owner: "sales", message: "抖音看到整木案例，想尽快沟通别墅定制方案。" },
  { id: "demo-lead-002", name: "李女士", phone: "13800000002", source: "xiaohongshu", customerType: "OWNER_CLIENT", needType: "GET_MATERIAL", intentionLevel: "HIGH", stage: "MATERIAL_SENT", city: "苏州", owner: "sales", message: "想领取环保说明和避坑清单。" },
  { id: "demo-lead-003", name: "周总", phone: "13800000003", source: "shipinhao", customerType: "DEALER_CLIENT", needType: "INVESTMENT_JOIN", intentionLevel: "HIGH", stage: "CONTACTED", city: "合肥", owner: "sales", message: "关注区域代理政策和样板店投入。" },
  { id: "demo-lead-004", name: "王设计", phone: "13800000004", source: "gongzhonghao", customerType: "DESIGNER_CLIENT", needType: "COOPERATION", intentionLevel: "MEDIUM", stage: "DIAGNOSED", city: "南京", owner: "operator", message: "手上有一个高定项目，需要确认材料和工艺节点。" },
  { id: "demo-lead-005", name: "赵厂长", phone: "13800000005", source: "website", customerType: "FACTORY_CLIENT", needType: "GROWTH_SYSTEM", intentionLevel: "STRONG", stage: "QUOTED", city: "佛山", owner: "admin", message: "想搭企业微信承接和销售跟进看板。" },
  { id: "demo-lead-006", name: "吴经理", phone: "13800000006", source: "friend_circle", customerType: "DEALER_CLIENT", needType: "ASK_PRICE", intentionLevel: "MEDIUM", stage: "PENDING_DEAL", city: "成都", owner: "sales", message: "想了解代理利润和区域保护。" },
  { id: "demo-lead-007", name: "郑先生", phone: "13800000007", source: "offline_event", customerType: "OWNER_CLIENT", needType: "PRODUCT_INQUIRY", intentionLevel: "LOW", stage: "TO_REACTIVATE", city: "宁波", owner: "sales", message: "展会留资，暂时还在比较品牌。" },
  { id: "demo-lead-008", name: "孙总", phone: "13800000008", source: "referral", customerType: "FACTORY_CLIENT", needType: "BOOK_CONSULTATION", intentionLevel: "HIGH", stage: "DEAL_DONE", city: "湖州", owner: "sales", message: "老客户转介绍，已完成增长诊断合作。" }
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
    update: { tenantId: tenant.id, passwordHash, role: "TENANT_ADMIN", status: "active" },
    create: { tenantId: tenant.id, name: "企业管理员", email: users.admin, passwordHash, role: "TENANT_ADMIN" }
  });
  const operator = await prisma.user.upsert({
    where: { email: users.operator },
    update: { tenantId: tenant.id, passwordHash, role: "OPERATOR", status: "active" },
    create: { tenantId: tenant.id, name: "运营人员", email: users.operator, passwordHash, role: "OPERATOR" }
  });
  const sales = await prisma.user.upsert({
    where: { email: users.sales },
    update: { tenantId: tenant.id, passwordHash, role: "SALES", status: "active" },
    create: { tenantId: tenant.id, name: "销售顾问", email: users.sales, passwordHash, role: "SALES" }
  });

  for (const strategy of strategyTemplates) {
    await prisma.customerTypeStrategy.upsert({
      where: { tenantId_customerType: { tenantId: tenant.id, customerType: strategy.customerType } },
      update: strategy,
      create: { tenantId: tenant.id, ...strategy }
    });
  }

  await prisma.material.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.material.createMany({
    data: [
      { tenantId: tenant.id, title: "业主案例图册", description: "适合业主客户首轮领取。", type: "link", url: "https://example.com/owner-cases", customerType: "OWNER_CLIENT" },
      { tenantId: tenant.id, title: "招商合作手册", description: "适合经销商客户查看政策。", type: "link", url: "https://example.com/dealer-book", customerType: "DEALER_CLIENT" },
      { tenantId: tenant.id, title: "设计师合作说明", description: "适合设计师客户评估项目协作。", type: "link", url: "https://example.com/designer-kit", customerType: "DESIGNER_CLIENT" },
      { tenantId: tenant.id, title: "企微增长诊断表", description: "适合工厂客户做增长自查。", type: "link", url: "https://example.com/growth-check", customerType: "FACTORY_CLIENT" }
    ]
  });

  await prisma.taskTemplate.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.taskTemplate.createMany({
    data: [
      {
        tenantId: tenant.id,
        name: "首次沟通模板",
        title: "首次沟通客户需求",
        description: "确认客户当前需求、预算、时间计划和下一步资料发送。",
        type: "FIRST_FOLLOW",
        priority: "NORMAL",
        defaultDueDays: 1,
        customerType: null,
        stage: "NEW"
      },
      {
        tenantId: tenant.id,
        name: "报价后跟进模板",
        title: "报价反馈跟进",
        description: "跟进客户对报价的反馈，识别成交阻力并约定下一步。",
        type: "QUOTE_FOLLOW",
        priority: "HIGH",
        defaultDueDays: 2,
        customerType: null,
        stage: "QUOTED"
      },
      {
        tenantId: tenant.id,
        name: "高意向推进模板",
        title: "高意向客户推进",
        description: "优先推进高意向客户，明确下一步沟通或到店安排。",
        type: "DEAL_PUSH",
        priority: "HIGH",
        defaultDueDays: 0,
        customerType: null,
        stage: null
      }
    ]
  });

  await prisma.reminderQueue.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.followTask.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.followUp.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.leadTag.deleteMany({ where: { tenantId: tenant.id } });

  const ownerMap = { admin: admin.id, operator: operator.id, sales: sales.id };
  for (const lead of leads) {
    await prisma.lead.upsert({
      where: { id: lead.id },
      update: {
        tenantId: tenant.id,
        name: lead.name,
        phone: lead.phone,
        source: lead.source,
        customerType: lead.customerType,
        needType: lead.needType,
        intentionLevel: lead.intentionLevel,
        stage: lead.stage,
        dealStatus: lead.stage === "DEAL_DONE" ? "WON" : lead.stage === "LOST" ? "LOST" : "NONE",
        city: lead.city,
        message: lead.message,
        ownerId: ownerMap[lead.owner]
      },
      create: {
        id: lead.id,
        tenantId: tenant.id,
        name: lead.name,
        phone: lead.phone,
        source: lead.source,
        customerType: lead.customerType,
        needType: lead.needType,
        intentionLevel: lead.intentionLevel,
        stage: lead.stage,
        dealStatus: lead.stage === "DEAL_DONE" ? "WON" : lead.stage === "LOST" ? "LOST" : "NONE",
        city: lead.city,
        message: lead.message,
        ownerId: ownerMap[lead.owner]
      }
    });
    await prisma.leadTag.createMany({
      data: [
        { tenantId: tenant.id, leadId: lead.id, tagName: lead.source, tagGroup: "SOURCE" },
        { tenantId: tenant.id, leadId: lead.id, tagName: lead.customerType, tagGroup: "CUSTOMER_TYPE" },
        { tenantId: tenant.id, leadId: lead.id, tagName: lead.intentionLevel, tagGroup: "INTENTION" }
      ]
    });
  }

  const now = new Date();
  const today = new Date(now);
  today.setHours(10, 0, 0, 0);
  const overdue = new Date(today);
  overdue.setDate(overdue.getDate() - 1);
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 3);
  await prisma.followTask.createMany({
    data: leads
      .filter((lead) => lead.stage !== "DEAL_DONE" && lead.stage !== "LOST")
      .map((lead, index) => ({
        tenantId: tenant.id,
        leadId: lead.id,
        ownerId: ownerMap[lead.owner],
        createdById: ownerMap.admin,
        title: lead.stage === "QUOTED" ? `报价跟进：${lead.name}` : lead.stage === "TO_REACTIVATE" ? `客户激活：${lead.name}` : `跟进任务：${lead.name}`,
        description: "seed 生成的 V1.3 销售工作台演示任务。",
        type: lead.stage === "QUOTED" ? "QUOTE_FOLLOW" : lead.stage === "TO_REACTIVATE" ? "REACTIVATE" : "FIRST_FOLLOW",
        status: index === 1 ? "DONE" : "PENDING",
        priority: lead.intentionLevel === "STRONG" ? "URGENT" : lead.intentionLevel === "HIGH" ? "HIGH" : "NORMAL",
        dueAt: index === 2 ? overdue : index === 3 ? nextWeek : today,
        completedAt: index === 1 ? now : null
      }))
  });

  await prisma.followUp.create({
    data: {
      tenantId: tenant.id,
      leadId: leads[0].id,
      userId: sales.id,
      content: "已发送首发资料，客户希望三天内安排一次初步方案沟通。",
      nextAction: "预约初步方案",
      stageBefore: "NEW",
      stageAfter: "MATERIAL_SENT",
      nextFollowAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
    }
  });

  return { tenant, sales };
}

async function main() {
  const passwordHash = await bcrypt.hash("123456", 10);

  await prisma.user.upsert({
    where: { email: "admin@growthhub.local" },
    update: { passwordHash, role: "PLATFORM_ADMIN", tenantId: null, status: "active" },
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
      { id: "isolation-lead-001", name: "隔离客户A", phone: "13900000001", source: "website", customerType: "OWNER_CLIENT", needType: "PRODUCT_INQUIRY", intentionLevel: "HIGH", stage: "NEW", city: "上海", owner: "sales", message: "用于验证不同租户之间不可互相查看。" },
      { id: "isolation-lead-002", name: "隔离客户B", phone: "13900000002", source: "referral", customerType: "FACTORY_CLIENT", needType: "GROWTH_SYSTEM", intentionLevel: "MEDIUM", stage: "CONTACTED", city: "无锡", owner: "admin", message: "第二租户线索，不能出现在 zhengmu-demo 后台。" }
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
