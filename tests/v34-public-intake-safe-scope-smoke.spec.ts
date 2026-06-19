/*
 * 文件说明：该文件提供 MarketClaw V3.4 公开表单 scope 安全 smoke 测试。
 * 功能说明：验证 public intake / CNAS path check 只通过安全业务 key 落库，并确认人工 FollowUp 以 Lead 自身归属写入。
 *
 * 结构概览：
 *   第一部分：导入依赖与测试常量
 *   第二部分：测试数据清理、登录和表单工具
 *   第三部分：public intake / CNAS / FollowUp scope 安全断言
 */
import { expect, test, type Page } from "@playwright/test";
import { LeadStage, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const testRun = "v34-public-intake-safe-scope-smoke";
const phonePrefix = "199340";

async function scopeByKeys(enterpriseKey: string, businessLineKey: string) {
  const businessLine = await prisma.businessLine.findFirst({
    where: {
      enterprise: { key: enterpriseKey },
      key: businessLineKey
    },
    include: { enterprise: true }
  });

  if (!businessLine) {
    throw new Error(`未找到测试所需业务线：${enterpriseKey}/${businessLineKey}`);
  }

  return {
    enterpriseId: businessLine.enterpriseId,
    businessLineId: businessLine.id,
    enterpriseKey: businessLine.enterprise.key,
    businessLineKey: businessLine.key
  };
}

async function cleanupSmokeData() {
  const leads = await prisma.lead.findMany({
    where: {
      OR: [{ phone: { startsWith: phonePrefix } }, { message: { contains: testRun } }, { name: { contains: testRun } }]
    },
    select: { id: true, contactId: true }
  });
  const leadIds = leads.map((lead) => lead.id);
  const contactIds = leads.map((lead) => lead.contactId).filter((id): id is string => Boolean(id));

  const contacts = await prisma.contact.findMany({
    where: {
      OR: [{ phone: { startsWith: phonePrefix } }, { notes: { contains: testRun } }, { name: { contains: testRun } }]
    },
    select: { id: true }
  });
  contacts.forEach((contact) => contactIds.push(contact.id));

  const intakeForms = await prisma.intakeForm.findMany({
    where: {
      OR: [{ phone: { startsWith: phonePrefix } }, { message: { contains: testRun } }, leadIds.length ? { createdLeadId: { in: leadIds } } : { id: "__never__" }]
    },
    select: { id: true }
  });
  const intakeFormIds = intakeForms.map((item) => item.id);

  const followTasks = await prisma.followTask.findMany({
    where: {
      OR: [leadIds.length ? { leadId: { in: leadIds } } : { id: "__never__" }, { description: { contains: testRun } }]
    },
    select: { id: true }
  });
  const taskIds = followTasks.map((task) => task.id);

  const followUps = await prisma.followUp.findMany({
    where: {
      OR: [leadIds.length ? { leadId: { in: leadIds } } : { id: "__never__" }, { content: { contains: testRun } }]
    },
    select: { id: true }
  });
  const followUpIds = followUps.map((item) => item.id);

  if (taskIds.length) await prisma.reminderQueue.deleteMany({ where: { taskId: { in: taskIds } } });
  await prisma.auditLog.deleteMany({
    where: {
      OR: [
        leadIds.length ? { entityId: { in: leadIds } } : { id: "__never__" },
        intakeFormIds.length ? { entityId: { in: intakeFormIds } } : { id: "__never__" },
        followUpIds.length ? { entityId: { in: followUpIds } } : { id: "__never__" },
        taskIds.length ? { entityId: { in: taskIds } } : { id: "__never__" }
      ]
    }
  });
  if (taskIds.length) await prisma.followTask.deleteMany({ where: { id: { in: taskIds } } });
  if (followUpIds.length) await prisma.followUp.deleteMany({ where: { id: { in: followUpIds } } });
  if (leadIds.length) await prisma.leadSourceAttribution.deleteMany({ where: { leadId: { in: leadIds } } });
  if (leadIds.length) await prisma.leadTag.deleteMany({ where: { leadId: { in: leadIds } } });
  if (intakeFormIds.length) await prisma.intakeForm.deleteMany({ where: { id: { in: intakeFormIds } } });
  if (leadIds.length) await prisma.lead.deleteMany({ where: { id: { in: leadIds } } });
  if (contactIds.length) await prisma.contact.deleteMany({ where: { id: { in: [...new Set(contactIds)] } } });
}

async function login(page: Page) {
  await page.goto("/login");
  await expect(page.locator('input[name="email"]')).toBeVisible();
  await page.locator('input[name="email"]').fill("boss");
  await page.locator('input[name="password"]').fill("c123456");
  await Promise.all([
    page.waitForURL((url) => /^\/app\/[^/]+\/dashboard$/.test(url.pathname)),
    page.locator("form button").click()
  ]);
}

async function addHiddenInputs(page: Page, values: Record<string, string>) {
  await page.locator("form").first().evaluate((form, entries) => {
    for (const [name, value] of Object.entries(entries as Record<string, string>)) {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = name;
      input.value = value;
      form.appendChild(input);
    }
  }, values);
}

async function findLeadByPhone(phone: string) {
  const lead = await prisma.lead.findFirst({
    where: { phone },
    include: {
      contact: true,
      intakeForms: true,
      sourceAttribution: true,
      enterprise: true,
      businessLine: true
    }
  });
  expect(lead).toBeTruthy();
  return lead!;
}

test.describe.serial("V3.4 public intake / CNAS scope 安全 smoke", () => {
  test.beforeAll(async () => {
    await cleanupSmokeData();
  });

  test.afterAll(async () => {
    await cleanupSmokeData();
    await prisma.$disconnect();
  });

  test("public intake 忽略伪造 ID，默认落到 youshi / zhengmu 并写入 Contact / Lead / IntakeForm", async ({ page }) => {
    const defaultScope = await scopeByKeys("youshi", "zhengmu");
    const wrongScope = await scopeByKeys("hangyu", "cnas");
    const phone = `${phonePrefix}0001`;

    await page.goto("/t/zhengmu-platform/diagnosis?source=douyin");
    await addHiddenInputs(page, {
      enterpriseId: wrongScope.enterpriseId,
      businessLineId: wrongScope.businessLineId
    });
    await page.locator('input[name="name"]').fill(`${testRun}-default-scope`);
    await page.locator('input[name="phone"]').fill(phone);
    await page.locator('input[name="company"]').fill(`${testRun}-company`);
    await page.locator('textarea[name="message"]').fill(`${testRun} fake ids must be ignored`);
    await Promise.all([
      page.waitForURL(/\/t\/zhengmu-platform\/thanks/),
      page.getByRole("button", { name: "提交诊断" }).click()
    ]);

    const lead = await findLeadByPhone(phone);
    expect(lead.enterpriseId).toBe(defaultScope.enterpriseId);
    expect(lead.businessLineId).toBe(defaultScope.businessLineId);
    expect(lead.contactId).toBeTruthy();
    expect(lead.contact?.enterpriseId).toBe(defaultScope.enterpriseId);
    expect(lead.intakeForms).toHaveLength(1);
    expect(lead.intakeForms[0].enterpriseId).toBe(defaultScope.enterpriseId);
    expect(lead.intakeForms[0].businessLineId).toBe(defaultScope.businessLineId);
    expect(lead.intakeForms[0].contactId).toBe(lead.contactId);
  });

  test("public intake 只通过 enterpriseKey / businessLineKey 安全解析到 youshi / youxi", async ({ page }) => {
    const youxiScope = await scopeByKeys("youshi", "youxi");
    const wrongScope = await scopeByKeys("hangyu", "cnas");
    const phone = `${phonePrefix}0002`;

    await page.goto("/t/zhengmu-platform/material?source=wechat");
    await addHiddenInputs(page, {
      enterpriseKey: "youshi",
      businessLineKey: "youxi",
      enterpriseId: wrongScope.enterpriseId,
      businessLineId: wrongScope.businessLineId
    });
    await page.locator('input[name="name"]').fill(`${testRun}-key-scope`);
    await page.locator('input[name="phone"]').fill(phone);
    await page.locator('input[name="company"]').fill(`${testRun}-youxi-company`);
    await page.locator('textarea[name="message"]').fill(`${testRun} safe keys should win over fake ids`);
    await Promise.all([
      page.waitForURL(/\/t\/zhengmu-platform\/thanks/),
      page.getByRole("button", { name: "领取资料" }).click()
    ]);

    const lead = await findLeadByPhone(phone);
    expect(lead.enterpriseId).toBe(youxiScope.enterpriseId);
    expect(lead.businessLineId).toBe(youxiScope.businessLineId);
    expect(lead.contact?.enterpriseId).toBe(youxiScope.enterpriseId);
    expect(lead.intakeForms[0].businessLineId).toBe(youxiScope.businessLineId);
  });

  test("CNAS path check 固定写入 hangyu / cnas，且不会污染同手机号的其它业务线 Lead", async ({ page }) => {
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { slug: "zhengmu-platform" } });
    const cnasScope = await scopeByKeys("hangyu", "cnas");
    const youxiScope = await scopeByKeys("youshi", "youxi");
    const phone = `${phonePrefix}0003`;
    const existing = await prisma.lead.create({
      data: {
        tenantId: tenant.id,
        enterpriseId: youxiScope.enterpriseId,
        businessLineId: youxiScope.businessLineId,
        name: `${testRun}-existing-youxi`,
        phone,
        company: `${testRun}-shared-phone`,
        message: `${testRun} should not be overwritten by CNAS`,
        stage: LeadStage.NEW
      }
    });

    await page.goto("/forms/cnas-path-check");
    await addHiddenInputs(page, {
      enterpriseId: youxiScope.enterpriseId,
      businessLineId: youxiScope.businessLineId,
      enterpriseKey: "youshi",
      businessLineKey: "youxi"
    });
    await page.locator('input[name="company"]').fill(`${testRun}-cnas-lab`);
    await page.locator('input[name="contactName"]').fill(`${testRun}-cnas-contact`);
    await page.locator('input[name="phone"]').fill(phone);
    await page.locator('textarea[name="note"]').fill(`${testRun} fixed CNAS scope`);
    await Promise.all([
      page.waitForURL(/\/forms\/cnas-path-check\/result/),
      page.getByRole("button", { name: "提交问卷并生成初步判断" }).click()
    ]);

    const unchangedExisting = await prisma.lead.findUniqueOrThrow({ where: { id: existing.id } });
    expect(unchangedExisting.enterpriseId).toBe(youxiScope.enterpriseId);
    expect(unchangedExisting.businessLineId).toBe(youxiScope.businessLineId);
    expect(unchangedExisting.message).toContain("should not be overwritten");

    const cnasLead = await prisma.lead.findFirst({
      where: {
        phone,
        enterpriseId: cnasScope.enterpriseId,
        businessLineId: cnasScope.businessLineId
      },
      include: { contact: true, intakeForms: true, sourceAttribution: true }
    });
    expect(cnasLead).toBeTruthy();
    expect(cnasLead?.contact?.enterpriseId).toBe(cnasScope.enterpriseId);
    expect(cnasLead?.intakeForms[0].enterpriseId).toBe(cnasScope.enterpriseId);
    expect(cnasLead?.intakeForms[0].businessLineId).toBe(cnasScope.businessLineId);
    expect(cnasLead?.sourceAttribution?.enterpriseId).toBe(cnasScope.enterpriseId);
    expect(cnasLead?.sourceAttribution?.businessLineId).toBe(cnasScope.businessLineId);
  });

  test("普通 FollowUp 以 Lead 自身 enterprise / businessLine scope 写入", async ({ page }) => {
    const lead = await prisma.lead.findFirstOrThrow({
      where: { name: `${testRun}-key-scope` }
    });
    const content = `${testRun} manual followup should keep lead scope`;

    await login(page);
    await page.goto(`/app/zhengmu-platform/leads/${lead.id}`);
    await page.locator('textarea[name="content"]').fill(content);
    await page.locator('input[name="nextAction"]').fill("继续人工跟进 V3.4 scope");
    await Promise.all([
      page.waitForLoadState("networkidle"),
      page.getByRole("button", { name: "保存跟进" }).click()
    ]);
    await expect(page.getByText(content).first()).toBeVisible();

    const followUp = await prisma.followUp.findFirst({
      where: { leadId: lead.id, content },
      orderBy: { createdAt: "desc" }
    });
    expect(followUp).toBeTruthy();
    expect(followUp?.enterpriseId).toBe(lead.enterpriseId);
    expect(followUp?.businessLineId).toBe(lead.businessLineId);

    const auditLog = await prisma.auditLog.findFirst({
      where: { action: "followup_created", entityType: "FollowUp", entityId: followUp!.id },
      orderBy: { createdAt: "desc" }
    });
    expect(auditLog?.metadata).toMatchObject({
      leadId: lead.id,
      enterpriseId: lead.enterpriseId,
      businessLineId: lead.businessLineId,
      contactId: lead.contactId
    });
  });
});
