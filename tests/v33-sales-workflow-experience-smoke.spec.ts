/*
 * 文件说明：该文件提供 MarketClaw V3.3 销售工作流体验 smoke 测试。
 * 功能说明：验证三条业务线的 Lead 详情工作流：入口保留 scope、智能建议不串线、采纳写入 FollowUp / FollowTask、返回待办。
 *
 * 结构概览：
 *   第一部分：导入依赖、测试标识与样本配置
 *   第二部分：登录、样本查询、页面入口和测试数据清理
 *   第三部分：三业务线销售工作流 smoke
 */
import { expect, test, type Page } from "@playwright/test";
import { PrismaClient, type AuditLog, type CustomerType } from "@prisma/client";

const prisma = new PrismaClient();
const testRun = "v33-sales-workflow-experience-smoke";
const questionPrefix = `[${testRun}]`;

type WorkflowSample = {
  title: string;
  login: string;
  leadName: string;
  enterpriseKey: string;
  enterpriseName: string;
  businessLineKey: string;
  businessLineName: string;
  customerType: CustomerType;
  customerTypeLabel: string;
  entry: "todos" | "leads" | "dashboard";
  question: string;
  taskQuestion: string;
  expectedKeywords: string[];
  forbiddenKeywords: string[];
};

type LeadRecord = {
  id: string;
  name: string;
  enterpriseId: string | null;
  businessLineId: string | null;
  contactId: string | null;
  customerType: CustomerType;
};

const samples: WorkflowSample[] = [
  {
    title: "张总 / 整木网",
    login: "sale",
    leadName: "张总 - 整木网会员意向",
    enterpriseKey: "youshi",
    enterpriseName: "优势文化",
    businessLineKey: "zhengmu",
    businessLineName: "整木网",
    customerType: "ZHENGMU_MEMBERSHIP_INTENT",
    customerTypeLabel: "会员意向客户",
    entry: "todos",
    question: "会员权益和品牌展示资料我看完后，下一步应该怎么推进？",
    taskQuestion: "请再帮我生成一个整木网会员下一步跟进任务。",
    expectedKeywords: ["整木网会员权益", "品牌展示案例", "优选联盟说明"],
    forbiddenKeywords: ["认可路径判断表", "实验室状态诊断表", "柚木空间案例", "供应链能力介绍"]
  },
  {
    title: "李设计师 / 柚喜饰界",
    login: "sale",
    leadName: "李设计师 - 柚木整装咨询",
    enterpriseKey: "youshi",
    enterpriseName: "优势文化",
    businessLineKey: "youxi",
    businessLineName: "柚喜饰界",
    customerType: "YOUXI_DESIGNER_CLIENT",
    customerTypeLabel: "设计师客户",
    entry: "leads",
    question: "设计师想看柚木空间案例、材料说明、供应链能力和合作规则，怎么回复更稳？",
    taskQuestion: "请再帮我生成一个柚喜设计师下一步跟进任务。",
    expectedKeywords: ["柚木空间案例", "材料说明", "供应链能力介绍"],
    forbiddenKeywords: ["认可路径判断表", "整木网会员权益", "官网诊断表", "整木天团"]
  },
  {
    title: "王主任 / CNAS认可指南",
    login: "opr",
    leadName: "王主任 - CNAS认可咨询",
    enterpriseKey: "hangyu",
    enterpriseName: "杭育公司",
    businessLineKey: "cnas",
    businessLineName: "CNAS认可指南",
    customerType: "CNAS_LAB_OWNER",
    customerTypeLabel: "实验室负责人",
    entry: "dashboard",
    question: "实验室负责人想确认 CNAS 认可路径、实验室状态和认可准备清单，怎么回复？",
    taskQuestion: "请再帮我生成一个 CNAS 电话评估下一步任务。",
    expectedKeywords: ["认可路径判断表", "实验室状态诊断表", "认可准备清单"],
    forbiddenKeywords: ["整木网会员权益", "官网诊断表", "柚木空间案例", "供应链能力介绍"]
  }
];

function metadataOf(log: Pick<AuditLog, "metadata">) {
  return log.metadata && typeof log.metadata === "object" && !Array.isArray(log.metadata) ? (log.metadata as Record<string, unknown>) : {};
}

async function loginAs(page: Page, account: string) {
  await page.goto("/login");
  await expect(page.locator('input[name="email"]')).toBeVisible();
  await page.locator('input[name="email"]').fill(account);
  await page.locator('input[name="password"]').fill("c123456");
  await Promise.all([
    page.waitForURL((url) => /^\/app\/[^/]+\/dashboard$/.test(url.pathname)),
    page.locator("form button").click()
  ]);
}

async function findLead(sample: WorkflowSample): Promise<LeadRecord> {
  const lead = await prisma.lead.findFirst({
    where: {
      name: sample.leadName,
      businessLine: { key: sample.businessLineKey },
      enterprise: { key: sample.enterpriseKey }
    },
    select: {
      id: true,
      name: true,
      enterpriseId: true,
      businessLineId: true,
      contactId: true,
      customerType: true
    }
  });

  if (!lead) throw new Error(`未找到 V3.3.1 smoke 样本 Lead：${sample.leadName}`);
  return lead;
}

async function cleanupSmokeData() {
  const auditLogs = await prisma.auditLog.findMany({
    where: { metadata: { path: ["testRun"], equals: testRun } },
    select: { entityId: true, entityType: true, metadata: true }
  });

  const followUpIds = new Set<string>();
  const taskIds = new Set<string>();
  const suggestionIds = new Set<string>();

  for (const log of auditLogs) {
    const metadata = metadataOf(log);
    if (log.entityType === "FollowUp" && log.entityId) followUpIds.add(log.entityId);
    if (log.entityType === "FollowTask" && log.entityId) taskIds.add(log.entityId);
    if (log.entityType === "ReplySuggestion" && log.entityId) suggestionIds.add(log.entityId);
    if (typeof metadata.followUpId === "string") followUpIds.add(metadata.followUpId);
    if (typeof metadata.taskId === "string") taskIds.add(metadata.taskId);
    if (typeof metadata.suggestionId === "string") suggestionIds.add(metadata.suggestionId);
  }

  const [markedFollowUps, markedTasks, markedSuggestions] = await Promise.all([
    prisma.followUp.findMany({ where: { content: { contains: `[${testRun}]` } }, select: { id: true } }),
    prisma.followTask.findMany({ where: { description: { contains: `testRun：${testRun}` } }, select: { id: true } }),
    prisma.replySuggestion.findMany({ where: { customerQuestion: { startsWith: questionPrefix } }, select: { id: true } })
  ]);

  markedFollowUps.forEach((item) => followUpIds.add(item.id));
  markedTasks.forEach((item) => taskIds.add(item.id));
  markedSuggestions.forEach((item) => suggestionIds.add(item.id));

  if (taskIds.size) await prisma.reminderQueue.deleteMany({ where: { taskId: { in: [...taskIds] } } });
  await prisma.auditLog.deleteMany({
    where: {
      OR: [
        { metadata: { path: ["testRun"], equals: testRun } },
        followUpIds.size ? { entityId: { in: [...followUpIds] } } : { id: "__never__" },
        taskIds.size ? { entityId: { in: [...taskIds] } } : { id: "__never__" },
        suggestionIds.size ? { entityId: { in: [...suggestionIds] } } : { id: "__never__" }
      ]
    }
  });
  if (taskIds.size) await prisma.followTask.deleteMany({ where: { id: { in: [...taskIds] } } });
  if (followUpIds.size) await prisma.followUp.deleteMany({ where: { id: { in: [...followUpIds] } } });
  if (suggestionIds.size) await prisma.replySuggestion.deleteMany({ where: { id: { in: [...suggestionIds] } } });
}

async function openLeadFromEntry(page: Page, sample: WorkflowSample, lead: LeadRecord) {
  const scopedQuery = `enterpriseKey=${sample.enterpriseKey}&businessLineKey=${sample.businessLineKey}`;

  if (sample.entry === "todos") {
    await page.goto(`/app/zhengmu-platform/todos?${scopedQuery}`);
    await expect(page.getByRole("heading", { name: "今天必须跟" })).toBeVisible();
    await page.getByRole("link", { name: "去跟进" }).first().click();
  }

  if (sample.entry === "leads") {
    await page.goto(`/app/zhengmu-platform/leads?${scopedQuery}`);
    await expect(page.getByText(sample.leadName)).toBeVisible();
    await page.getByRole("link", { name: "去跟进" }).first().click();
  }

  if (sample.entry === "dashboard") {
    await page.goto(`/app/zhengmu-platform/dashboard?${scopedQuery}`);
    await expect(page.getByText(sample.leadName).first()).toBeVisible();
    await page.getByRole("link", { name: new RegExp(sample.leadName) }).first().click();
  }

  await page.waitForURL((url) => url.pathname.includes(`/leads/${lead.id}`));
  expect(page.url()).toContain(`enterpriseKey=${sample.enterpriseKey}`);
  expect(page.url()).toContain(`businessLineKey=${sample.businessLineKey}`);
}

async function submitAdoption(page: Page, buttonName: string) {
  await page
    .getByRole("button", { name: buttonName })
    .first()
    .evaluate((button, value) => {
      const form = button.closest("form");
      if (!form) throw new Error("未找到采纳按钮所在表单。");
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = "testRun";
      input.value = value as string;
      form.appendChild(input);
    }, testRun);
  await page.getByRole("button", { name: buttonName }).first().click();
}

async function runWorkflow(page: Page, sample: WorkflowSample) {
  const lead = await findLead(sample);
  expect(lead.customerType).toBe(sample.customerType);

  await loginAs(page, sample.login);
  await openLeadFromEntry(page, sample, lead);

  await expect(page.getByText(sample.leadName).first()).toBeVisible();
  await expect(page.locator("nav select").nth(0)).toHaveValue(sample.enterpriseKey);
  await expect(page.locator("nav select").nth(1)).toHaveValue(sample.businessLineKey);
  await expect(page.getByText(sample.customerTypeLabel).first()).toBeVisible();
  await expect(page.getByText(sample.login === "sale" ? "最近一次跟进记录" : "销售跟进记录")).toBeVisible();
  await expect(page.getByText("V3.1 智能跟进助手")).toBeVisible();
  await expect(page.getByText("不会自动发送到企微")).toBeVisible();

  const assistant = page.locator("aside").filter({ hasText: "V3.1 智能跟进助手" });
  const assistantLinks = await assistant.locator("a").evaluateAll((links) => links.map((link) => (link as HTMLAnchorElement).href));
  expect(assistantLinks.filter((href) => /^https?:\/\//.test(href))).toEqual([]);

  await page.getByLabel("客户刚问了什么").fill(`${questionPrefix} ${sample.question}`);
  await page.getByRole("button", { name: "生成建议回复" }).click();
  await expect(page.getByText("回复话术").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "复制建议回复" }).first()).toBeVisible();

  for (const keyword of sample.expectedKeywords) {
    await expect(assistant.getByText(keyword).first()).toBeVisible();
  }
  for (const keyword of sample.forbiddenKeywords) {
    await expect(assistant.getByText(keyword).first()).toHaveCount(0);
  }

  await submitAdoption(page, "采纳为跟进记录");
  await expect(page.getByText(`[${testRun}]`).first()).toBeVisible();
  await expect(page.getByText("已写入跟进记录：来自智能建议采纳").first()).toBeVisible();
  expect(page.url()).toContain(`enterpriseKey=${sample.enterpriseKey}`);
  expect(page.url()).toContain(`businessLineKey=${sample.businessLineKey}`);

  await page.getByLabel("客户刚问了什么").fill(`${questionPrefix} ${sample.taskQuestion}`);
  await page.getByRole("button", { name: "生成建议回复" }).click();
  await expect(page.getByText("回复话术").first()).toBeVisible();
  await submitAdoption(page, "采纳并创建下一步任务");
  await expect(page.getByText(`testRun：${testRun}`).first()).toBeVisible();
  await expect(page.getByText("已创建下一步任务：来自智能建议采纳").first()).toBeVisible();
  expect(page.url()).toContain(`enterpriseKey=${sample.enterpriseKey}`);
  expect(page.url()).toContain(`businessLineKey=${sample.businessLineKey}`);

  const [followUp, task] = await Promise.all([
    prisma.followUp.findFirst({ where: { leadId: lead.id, content: { contains: `[${testRun}]` } }, orderBy: { createdAt: "desc" } }),
    prisma.followTask.findFirst({ where: { leadId: lead.id, description: { contains: `testRun：${testRun}` } }, orderBy: { createdAt: "desc" } })
  ]);

  expect(followUp?.enterpriseId).toBe(lead.enterpriseId);
  expect(followUp?.businessLineId).toBe(lead.businessLineId);
  expect(task?.enterpriseId).toBe(lead.enterpriseId);
  expect(task?.businessLineId).toBe(lead.businessLineId);

  await page.getByRole("link", { name: "返回待办" }).first().click();
  await page.waitForURL((url) => url.pathname.endsWith("/todos"));
  expect(page.url()).toContain(`enterpriseKey=${sample.enterpriseKey}`);
  expect(page.url()).toContain(`businessLineKey=${sample.businessLineKey}`);
}

test.describe.serial("V3.3.1 三业务线销售工作流体验 smoke", () => {
  test.beforeAll(async () => {
    await cleanupSmokeData();
  });

  test.afterAll(async () => {
    await cleanupSmokeData();
    await prisma.$disconnect();
  });

  for (const sample of samples) {
    test(`${sample.title}：入口到 Lead 详情、复制入口、采纳闭环和返回待办不跨业务线`, async ({ page }) => {
      await runWorkflow(page, sample);
    });
  }
});
