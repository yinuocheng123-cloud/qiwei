/*
 * 文件说明：该文件提供 MarketClaw V3.2 智能跟进助手采纳闭环 smoke 测试。
 * 功能说明：验证销售采纳智能建议后，FollowUp / FollowTask 与审计 metadata 始终以 Lead 自身企业 / 业务线归属为准，并清理测试写入数据。
 *
 * 结构概览：
 *   第一部分：导入依赖与验收样本定义
 *   第二部分：登录、Lead 查询、测试数据清理与 metadata 工具
 *   第三部分：采纳为跟进记录写入与审计断言
 *   第四部分：采纳并创建下一步任务写入与审计断言
 */
import { expect, test, type Page } from "@playwright/test";
import { PrismaClient, type AuditLog, type Lead } from "@prisma/client";

const prisma = new PrismaClient();
const testRun = "v32-followup-copilot-adoption-loop-smoke";
const questionPrefix = `[${testRun}]`;

type LeadScope = Pick<Lead, "id" | "name" | "enterpriseId" | "businessLineId" | "contactId" | "ownerId"> & {
  enterprise: { name: string; key: string } | null;
  businessLine: { name: string; key: string } | null;
};

type AdoptionCase = {
  label: string;
  leadName: string;
  question: string;
  expectedBusinessLineKey: string;
  wrongScope?: string;
};

const followUpCases: AdoptionCase[] = [
  {
    label: "张总整木网 GEO Lead 采纳后写入整木网",
    leadName: "张总 - GEO推广意向",
    question: "我们想做 GEO 推广，请帮我整理官网诊断和行业排名内容的下一步。",
    expectedBusinessLineKey: "zhengmu",
    wrongScope: "?enterpriseKey=hangyu&businessLineKey=cnas"
  },
  {
    label: "张总整木网会员 Lead 采纳后不写入 CNAS / 柚喜",
    leadName: "张总 - 整木网会员意向",
    question: "会员权益、品牌展示和优选联盟资料，下一步应该怎么发给我？",
    expectedBusinessLineKey: "zhengmu"
  },
  {
    label: "李设计师柚喜 Lead 采纳后只写入柚喜饰界",
    leadName: "李设计师 - 柚木整装咨询",
    question: "我想了解柚木空间案例、材料支持和设计师合作规则。",
    expectedBusinessLineKey: "youxi"
  },
  {
    label: "王主任 CNAS Lead 采纳后只写入 CNAS",
    leadName: "王主任 - CNAS认可咨询",
    question: "我们实验室想先判断 CNAS 认可路径和准备清单。",
    expectedBusinessLineKey: "cnas"
  }
];

function metadataOf(log: Pick<AuditLog, "metadata">) {
  return log.metadata && typeof log.metadata === "object" && !Array.isArray(log.metadata) ? (log.metadata as Record<string, unknown>) : {};
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

async function findLeadScope(leadName: string): Promise<LeadScope> {
  const lead = await prisma.lead.findFirst({
    where: { name: leadName },
    select: {
      id: true,
      name: true,
      enterpriseId: true,
      businessLineId: true,
      contactId: true,
      ownerId: true,
      enterprise: { select: { name: true, key: true } },
      businessLine: { select: { name: true, key: true } }
    }
  });

  if (!lead?.enterpriseId || !lead.businessLineId || !lead.businessLine) {
    throw new Error(`未找到带完整企业 / 业务线归属的 V3.2 验收样本 Lead：${leadName}`);
  }

  return lead;
}

async function cleanupSmokeData() {
  const auditLogs = await prisma.auditLog.findMany({
    where: {
      OR: [
        { metadata: { path: ["testRun"], equals: testRun } },
        { metadata: { path: ["source"], equals: "copilot" }, entityType: "FollowTask", action: "copilot_task_created" }
      ]
    },
    select: { id: true, entityId: true, entityType: true, metadata: true }
  });

  const followUpIds = new Set<string>();
  const taskIds = new Set<string>();
  const suggestionIds = new Set<string>();

  for (const log of auditLogs) {
    const metadata = metadataOf(log);
    if (metadata.testRun === testRun) {
      if (log.entityType === "FollowUp" && log.entityId) followUpIds.add(log.entityId);
      if (log.entityType === "FollowTask" && log.entityId) taskIds.add(log.entityId);
      if (log.entityType === "ReplySuggestion" && log.entityId) suggestionIds.add(log.entityId);
      if (typeof metadata.followUpId === "string") followUpIds.add(metadata.followUpId);
      if (typeof metadata.taskId === "string") taskIds.add(metadata.taskId);
      if (typeof metadata.suggestionId === "string") suggestionIds.add(metadata.suggestionId);
    }
  }

  const [markedFollowUps, markedTasks, markedSuggestions] = await Promise.all([
    prisma.followUp.findMany({ where: { content: { contains: `[${testRun}]` } }, select: { id: true } }),
    prisma.followTask.findMany({ where: { description: { contains: `testRun：${testRun}` } }, select: { id: true } }),
    prisma.replySuggestion.findMany({ where: { customerQuestion: { startsWith: questionPrefix } }, select: { id: true } })
  ]);

  markedFollowUps.forEach((item) => followUpIds.add(item.id));
  markedTasks.forEach((item) => taskIds.add(item.id));
  markedSuggestions.forEach((item) => suggestionIds.add(item.id));

  if (taskIds.size) {
    await prisma.reminderQueue.deleteMany({ where: { taskId: { in: [...taskIds] } } });
  }
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

async function generateSuggestion(page: Page, lead: LeadScope, question: string, wrongScope = "") {
  await page.goto(`/app/zhengmu-platform/leads/${lead.id}${wrongScope}`);
  await expect(page.getByText("V3.1 智能跟进助手")).toBeVisible();
  await expect(page.getByText("不会自动发送到企微")).toBeVisible();
  await page.getByLabel("客户刚问了什么").fill(`${questionPrefix} ${question}`);
  await page.getByRole("button", { name: "生成建议回复" }).click();
  await expect(page.getByText("回复话术").first()).toBeVisible();
  const assistantLinks = await page
    .locator("aside")
    .filter({ hasText: "V3.1 智能跟进助手" })
    .locator("a")
    .evaluateAll((links) => links.map((link) => (link as HTMLAnchorElement).href));
  expect(assistantLinks.filter((href) => /^https?:\/\//.test(href))).toEqual([]);
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

async function findAuditLog(action: string, entityType: string, entityId: string) {
  let log: AuditLog | null = null;
  await expect.poll(async () => {
    log = await prisma.auditLog.findFirst({
      where: {
        action,
        entityType,
        entityId,
        metadata: { path: ["testRun"], equals: testRun }
      },
      orderBy: { createdAt: "desc" }
    });
    return Boolean(log);
  }).toBe(true);
  expect(log, `${action} 审计日志应存在`).toBeTruthy();
  return log!;
}

function assertCopilotMetadata(log: AuditLog, lead: LeadScope) {
  const metadata = metadataOf(log);
  expect(metadata.source).toBe("copilot");
  expect(metadata.testRun).toBe(testRun);
  expect(metadata.leadId).toBe(lead.id);
  expect(metadata.contactId).toBe(lead.contactId);
  expect(metadata.enterpriseId).toBe(lead.enterpriseId);
  expect(metadata.businessLineId).toBe(lead.businessLineId);
}

test.describe.serial("V3.2 智能跟进助手采纳闭环防跨业务线串线 smoke", () => {
  test.beforeAll(async () => {
    await cleanupSmokeData();
  });

  test.afterAll(async () => {
    await cleanupSmokeData();
    await prisma.$disconnect();
  });

  for (const item of followUpCases) {
    test(`${item.label}：采纳为 FollowUp 并校验审计 metadata`, async ({ page }) => {
      await login(page);
      const lead = await findLeadScope(item.leadName);
      expect(lead.businessLine?.key).toBe(item.expectedBusinessLineKey);

      const beforeCount = await prisma.followUp.count({ where: { content: { contains: `[${testRun}]` } } });
      await generateSuggestion(page, lead, item.question, item.wrongScope);
      await submitAdoption(page, "采纳为跟进记录");
      await expect.poll(() => prisma.followUp.count({ where: { content: { contains: `[${testRun}]` } } })).toBeGreaterThan(beforeCount);

      const followUp = await prisma.followUp.findFirst({
        where: { leadId: lead.id, content: { contains: `[${testRun}]` } },
        orderBy: { createdAt: "desc" }
      });

      expect(followUp?.enterpriseId).toBe(lead.enterpriseId);
      expect(followUp?.businessLineId).toBe(lead.businessLineId);
      expect(followUp?.nextAction).toBeTruthy();

      const followUpAuditLog = await findAuditLog("followup_created", "FollowUp", followUp!.id);
      const suggestionAuditLog = await prisma.auditLog.findFirst({
        where: {
          action: "reply_suggestion_saved_as_followup",
          entityType: "ReplySuggestion",
          metadata: { path: ["testRun"], equals: testRun }
        },
        orderBy: { createdAt: "desc" }
      });

      assertCopilotMetadata(followUpAuditLog, lead);
      expect(suggestionAuditLog).toBeTruthy();
      assertCopilotMetadata(suggestionAuditLog!, lead);

      const leakingFollowUps = await prisma.followUp.count({
        where: {
          content: { contains: `[${testRun}]` },
          leadId: lead.id,
          OR: [{ enterpriseId: { not: lead.enterpriseId } }, { businessLineId: { not: lead.businessLineId } }]
        }
      });
      expect(leakingFollowUps).toBe(0);
    });
  }

  test("URL 传入错误 scope 时，采纳并创建下一步任务仍以张总 GEO Lead 自身归属为准", async ({ page }) => {
    await login(page);
    const lead = await findLeadScope("张总 - GEO推广意向");
    expect(lead.businessLine?.key).toBe("zhengmu");

    const beforeFollowUpCount = await prisma.followUp.count({ where: { content: { contains: `[${testRun}]` } } });
    const beforeTaskCount = await prisma.followTask.count({ where: { description: { contains: `testRun：${testRun}` } } });

    await generateSuggestion(page, lead, "我们要推进 GEO 官网诊断，请生成下一步跟进任务。", "?enterpriseKey=hangyu&businessLineKey=cnas");
    await submitAdoption(page, "采纳并创建下一步任务");

    await expect.poll(() => prisma.followUp.count({ where: { content: { contains: `[${testRun}]` } } })).toBeGreaterThan(beforeFollowUpCount);
    await expect.poll(() => prisma.followTask.count({ where: { description: { contains: `testRun：${testRun}` } } })).toBeGreaterThan(beforeTaskCount);
    await expect(page.getByText(`testRun：${testRun}`).first()).toBeVisible();

    const [followUp, task] = await Promise.all([
      prisma.followUp.findFirst({ where: { leadId: lead.id, content: { contains: `[${testRun}]` } }, orderBy: { createdAt: "desc" } }),
      prisma.followTask.findFirst({ where: { leadId: lead.id, description: { contains: `testRun：${testRun}` } }, orderBy: { createdAt: "desc" } })
    ]);

    expect(followUp?.enterpriseId).toBe(lead.enterpriseId);
    expect(followUp?.businessLineId).toBe(lead.businessLineId);
    expect(followUp?.nextFollowAt).toBeTruthy();
    expect(task?.enterpriseId).toBe(lead.enterpriseId);
    expect(task?.businessLineId).toBe(lead.businessLineId);
    expect(task?.ownerId).toBeTruthy();
    expect(task?.status).toBe("PENDING");
    expect(task?.description).toContain("来源：copilot");
    expect(task?.description).toContain(`testRun：${testRun}`);
    expect(task?.description).not.toContain("自动发送");

    const [followUpAuditLog, taskAuditLog, adoptedWithTaskAuditLog] = await Promise.all([
      findAuditLog("followup_created", "FollowUp", followUp!.id),
      findAuditLog("copilot_task_created", "FollowTask", task!.id),
      prisma.auditLog.findFirst({
        where: {
          action: "reply_suggestion_adopted_with_task",
          entityType: "ReplySuggestion",
          metadata: { path: ["testRun"], equals: testRun }
        },
        orderBy: { createdAt: "desc" }
      })
    ]);

    assertCopilotMetadata(followUpAuditLog, lead);
    assertCopilotMetadata(taskAuditLog, lead);
    expect(adoptedWithTaskAuditLog).toBeTruthy();
    assertCopilotMetadata(adoptedWithTaskAuditLog!, lead);

    const leakingTasks = await prisma.followTask.count({
      where: {
        description: { contains: `testRun：${testRun}` },
        leadId: lead.id,
        OR: [{ enterpriseId: { not: lead.enterpriseId } }, { businessLineId: { not: lead.businessLineId } }]
      }
    });
    expect(leakingTasks).toBe(0);
  });
});
