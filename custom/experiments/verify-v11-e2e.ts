/*
 * 文件说明：该文件用于 V1.1 本地数据库端到端验证。
 * 功能说明：检查 seed 账号、双租户、策略库、线索数据，并模拟公开表单写入 Lead 与 IntakeForm。
 *
 * 结构概览：
 *   第一部分：导入依赖
 *   第二部分：断言工具
 *   第三部分：数据库验证流程
 *   第四部分：结果输出与退出
 */
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const demoCustomerTypes = ["OWNER_CLIENT", "DEALER_CLIENT", "DESIGNER_CLIENT", "FACTORY_CLIENT"] as const;
const requiredSources = ["douyin", "xiaohongshu", "shipinhao", "gongzhonghao", "website", "friend_circle", "offline_event", "referral"] as const;
const requiredStages = ["NEW", "MATERIAL_SENT", "CONTACTED", "DIAGNOSED", "QUOTED", "PENDING_DEAL", "DEAL_DONE", "TO_REACTIVATE"] as const;

function assert(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertDefined<T>(value: T | null | undefined, message: string): T {
  if (!value) {
    throw new Error(message);
  }
  return value;
}

async function main() {
  const platformAdmin = assertDefined(await prisma.user.findUnique({ where: { email: "admin@growthhub.local" } }), "平台管理员账号不存在。");
  assert(platformAdmin?.role === "PLATFORM_ADMIN", "平台管理员账号不存在或角色错误。");
  assert(await bcrypt.compare("123456", platformAdmin.passwordHash), "平台管理员密码 hash 校验失败。");

  const tenant = assertDefined(await prisma.tenant.findUnique({ where: { slug: "zhengmu-demo" } }), "zhengmu-demo 租户不存在。");
  const isolationTenant = assertDefined(await prisma.tenant.findUnique({ where: { slug: "isolation-demo" } }), "isolation-demo 租户不存在。");

  const zhengmuUsers = await prisma.user.findMany({ where: { tenantId: tenant.id } });
  assert(zhengmuUsers.some((user) => user.email === "boss@zhengmu.local" && user.role === "TENANT_ADMIN"), "企业管理员账号缺失。");
  assert(zhengmuUsers.some((user) => user.email === "operator@zhengmu.local" && user.role === "OPERATOR"), "运营账号缺失。");
  const sales = assertDefined(
    zhengmuUsers.find((user) => user.email === "sales@zhengmu.local" && user.role === "SALES"),
    "销售账号缺失。"
  );

  const strategyCount = await prisma.customerTypeStrategy.count({ where: { tenantId: tenant.id } });
  assert(strategyCount >= 4, "客户类型策略不足 4 条。");
  for (const customerType of demoCustomerTypes) {
    const strategy = await prisma.customerTypeStrategy.findUnique({
      where: { tenantId_customerType: { tenantId: tenant.id, customerType } }
    });
    assert(strategy, `${customerType} 的策略缺失。`);
  }

  const materialCounts = await Promise.all(
    demoCustomerTypes.map(async (customerType) => ({
      customerType,
      count: await prisma.material.count({ where: { tenantId: tenant.id, customerType } })
    }))
  );
  materialCounts.forEach((item) => assert(item.count >= 1, `${item.customerType} 的资料包缺失。`));

  const taskTemplateCounts = await Promise.all(
    demoCustomerTypes.map(async (customerType) => ({
      customerType,
      count: await prisma.taskTemplate.count({ where: { tenantId: tenant.id, customerType, isActive: true } })
    }))
  );
  taskTemplateCounts.forEach((item) => assert(item.count >= 1, `${item.customerType} 的任务模板缺失。`));

  const leadCountBefore = await prisma.lead.count({ where: { tenantId: tenant.id } });
  assert(leadCountBefore >= 16, "zhengmu-demo 样板线索不足 16 条。");

  const leadCountsByType = await Promise.all(
    demoCustomerTypes.map(async (customerType) => ({
      customerType,
      count: await prisma.lead.count({ where: { tenantId: tenant.id, customerType } })
    }))
  );
  leadCountsByType.forEach((item) => assert(item.count >= 4, `${item.customerType} 的样板线索不足 4 条。`));

  const sourceGroups = await prisma.lead.groupBy({ by: ["source"], where: { tenantId: tenant.id }, _count: true });
  requiredSources.forEach((source) => assert(sourceGroups.some((item) => item.source === source), `样板线索缺少来源 ${source}。`));

  const stageGroups = await prisma.lead.groupBy({ by: ["stage"], where: { tenantId: tenant.id }, _count: true });
  requiredStages.forEach((stage) => assert(stageGroups.some((item) => item.stage === stage), `样板线索缺少阶段 ${stage}。`));

  const isolationLeadCount = await prisma.lead.count({ where: { tenantId: isolationTenant.id } });
  assert(isolationLeadCount >= 2, "第二租户隔离验证线索不足。");

  const salesVisibleCount = await prisma.lead.count({ where: { tenantId: tenant.id, ownerId: sales.id } });
  const allTenantLeadCount = await prisma.lead.count({ where: { tenantId: tenant.id } });
  assert(salesVisibleCount < allTenantLeadCount, "销售可见范围没有形成 ownerId 子集，无法验证销售隔离。");
  assert(salesVisibleCount >= 6, "销售账号可见样板客户过少，不足以演示工作台。");

  const followUpCountsByType = await Promise.all(
    demoCustomerTypes.map(async (customerType) => ({
      customerType,
      count: await prisma.followUp.count({ where: { tenantId: tenant.id, lead: { customerType } } })
    }))
  );
  followUpCountsByType.forEach((item) => assert(item.count >= 1, `${item.customerType} 缺少跟进记录。`));

  const followTaskCountsByType = await Promise.all(
    demoCustomerTypes.map(async (customerType) => ({
      customerType,
      count: await prisma.followTask.count({ where: { tenantId: tenant.id, lead: { customerType } } })
    }))
  );
  followTaskCountsByType.forEach((item) => assert(item.count >= 1, `${item.customerType} 缺少任务。`));

  const salesPendingTaskCount = await prisma.followTask.count({
    where: { tenantId: tenant.id, ownerId: sales.id, status: { in: ["PENDING", "DELAYED"] } }
  });
  assert(salesPendingTaskCount >= 1, "销售账号没有待办任务。");

  const todayTaskCount = await prisma.followTask.count({
    where: { tenantId: tenant.id, dueAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)), lt: new Date(new Date().setHours(24, 0, 0, 0)) } }
  });
  const overdueTaskCount = await prisma.followTask.count({
    where: { tenantId: tenant.id, dueAt: { lt: new Date(new Date().setHours(0, 0, 0, 0)) }, status: { in: ["PENDING", "DELAYED"] } }
  });
  const doneTaskCount = await prisma.followTask.count({ where: { tenantId: tenant.id, status: "DONE" } });
  assert(todayTaskCount >= 1, "样板数据缺少今日任务。");
  assert(overdueTaskCount >= 1, "样板数据缺少逾期任务。");
  assert(doneTaskCount >= 1, "样板数据缺少已完成任务。");

  const demoLead = assertDefined(
    await prisma.lead.findUnique({ where: { id: "demo-lead-001" } }),
    "演示客户 demo-lead-001 不存在。"
  );
  const demoMaterials = await prisma.material.count({ where: { tenantId: tenant.id, customerType: demoLead.customerType } });
  const demoTemplates = await prisma.taskTemplate.count({ where: { tenantId: tenant.id, customerType: demoLead.customerType, isActive: true } });
  const demoTasks = await prisma.followTask.count({ where: { tenantId: tenant.id, leadId: demoLead.id } });
  assert(demoMaterials >= 1, "演示客户缺少可展示资料。");
  assert(demoTemplates >= 1, "演示客户缺少可选任务模板。");
  assert(demoTasks >= 1, "演示客户缺少当前任务。");

  const createdLead = await prisma.lead.create({
    data: {
      tenantId: tenant.id,
      name: "端到端表单测试客户",
      phone: `137${Date.now().toString().slice(-8)}`,
      source: "douyin",
      customerType: "OWNER_CLIENT",
      needType: "BOOK_CONSULTATION",
      intentionLevel: "STRONG",
      stage: "NEW",
      message: "模拟公开诊断表单提交后生成的线索。",
      ownerId: sales.id
    }
  });

  await prisma.intakeForm.create({
    data: {
      tenantId: tenant.id,
      formType: "diagnosis",
      source: "douyin",
      name: createdLead.name,
      phone: createdLead.phone,
      customerType: "OWNER_CLIENT",
      needType: "BOOK_CONSULTATION",
      message: "模拟公开诊断表单提交后生成的表单记录。",
      createdLeadId: createdLead.id
    }
  });

  await prisma.followUp.create({
    data: {
      tenantId: tenant.id,
      leadId: createdLead.id,
      userId: sales.id,
      content: "端到端验证跟进记录。",
      nextAction: "预约初步方案",
      stageBefore: "NEW",
      stageAfter: "CONTACTED",
      nextFollowAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
    }
  });

  await prisma.lead.update({
    where: { id: createdLead.id },
    data: {
      stage: "CONTACTED",
      lastFollowAt: new Date(),
      nextFollowAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
    }
  });

  const followUpCount = await prisma.followUp.count({ where: { leadId: createdLead.id, tenantId: tenant.id } });
  assert(followUpCount === 1, "跟进记录写入失败。");

  const leadCountAfter = await prisma.lead.count({ where: { tenantId: tenant.id } });
  assert(leadCountAfter === leadCountBefore + 1, "模拟公开表单提交后线索数量没有增加。");

  await prisma.auditLog.create({
    data: {
      tenantId: tenant.id,
      userId: sales.id,
      action: "verification_audit_log_created",
      entityType: "Lead",
      entityId: createdLead.id,
      metadata: {
        source: "custom/experiments/verify-v11-e2e.ts"
      }
    }
  });
  const auditLogCount = await prisma.auditLog.count({ where: { tenantId: tenant.id } });
  assert(auditLogCount >= 1, "AuditLog 写入验证失败。");

  console.log(
    JSON.stringify(
      {
        ok: true,
        platformAdmin: platformAdmin.email,
        tenant: tenant.slug,
        isolationTenant: isolationTenant.slug,
        strategyCount,
        materialCounts,
        taskTemplateCounts,
        leadCountBefore,
        leadCountAfter,
        leadCountsByType,
        salesVisibleCount,
        salesPendingTaskCount,
        isolationLeadCount,
        followUpCountsByType,
        followTaskCountsByType,
        todayTaskCount,
        overdueTaskCount,
        doneTaskCount,
        auditLogCount,
        createdLeadId: createdLead.id
      },
      null,
      2
    )
  );
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
