/*
 * 文件说明：该文件提供 MarketClaw V3.1 智能跟进助手业务线隔离 smoke 测试。
 * 功能说明：验证张总、李设计师、王主任样本的回复建议、资料、任务、策略、知识与草稿不会跨业务线串线。
 *
 * 结构概览：
 *   第一部分：导入依赖与验收样本定义
 *   第二部分：页面登录、文本读取与只读查询工具
 *   第三部分：LeadReplyAssistant 运行态隔离 smoke
 *   第四部分：Prisma 只读隔离断言
 *   第五部分：MarketClawReplyDraft 表单 scope 覆盖保护 smoke
 */
import { expect, test, type Page } from "@playwright/test";
import { PrismaClient, type Lead } from "@prisma/client";

const prisma = new PrismaClient();

type LeadCase = {
  label: string;
  leadName: string;
  question: string;
  requiredTexts: string[];
  forbiddenTexts: string[];
};

type LeadScope = Pick<Lead, "id" | "name" | "enterpriseId" | "businessLineId" | "customerType" | "stage"> & {
  enterprise: { name: string; key: string } | null;
  businessLine: { name: string; key: string } | null;
};

const leadCases: LeadCase[] = [
  {
    label: "张总 - 整木网会员意向",
    leadName: "张总 - 整木网会员意向",
    question: "整木网会员具体有哪些权益，能不能给我看看品牌展示和联盟合作资料？",
    requiredTexts: ["优势文化", "整木网", "整木网会员权益", "品牌展示案例", "优选联盟说明"],
    forbiddenTexts: ["CNAS", "认可路径判断表", "实验室状态诊断表", "柚木空间案例", "材料说明"]
  },
  {
    label: "张总 - GEO推广意向",
    leadName: "张总 - GEO推广意向",
    question: "我们想做 GEO 推广，先看看官网诊断和行业排名内容怎么做。",
    requiredTexts: ["优势文化", "整木网", "行业排名内容样稿", "官网诊断表"],
    forbiddenTexts: ["CNAS", "认可路径判断表", "实验室状态诊断表", "柚木空间案例", "合作规则"]
  },
  {
    label: "张总 - 天团合作意向",
    leadName: "张总 - 天团合作意向",
    question: "整木天团、城市伙伴和共创合作怎么推进？",
    requiredTexts: ["优势文化", "整木网", "优选联盟说明", "天团合作"],
    forbiddenTexts: ["CNAS", "认可路径判断表", "实验室状态诊断表", "柚木空间案例", "材料说明"]
  },
  {
    label: "李设计师 - 柚木整装咨询",
    leadName: "李设计师 - 柚木整装咨询",
    question: "我是设计师，想看柚木空间案例、材料支持、供应链能力和合作规则。",
    requiredTexts: ["优势文化", "柚喜饰界", "设计师客户", "柚木空间案例", "材料说明", "合作规则"],
    forbiddenTexts: ["CNAS", "认可路径判断表", "整木网会员权益", "行业排名内容样稿", "官网诊断表", "优选联盟说明"]
  },
  {
    label: "王主任 - CNAS认可咨询",
    leadName: "王主任 - CNAS认可咨询",
    question: "我们实验室想做 CNAS 认可，先判断当前状态和认可准备清单。",
    requiredTexts: ["杭育公司", "CNAS认可指南", "实验室负责人", "认可路径判断表", "实验室状态诊断表", "认可准备清单"],
    forbiddenTexts: ["整木网会员权益", "行业排名内容样稿", "官网诊断表", "柚木空间案例", "材料说明", "合作规则"]
  }
];

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
      customerType: true,
      stage: true,
      enterprise: { select: { name: true, key: true } },
      businessLine: { select: { name: true, key: true } }
    }
  });

  if (!lead?.enterpriseId || !lead.businessLineId) {
    throw new Error(`未找到带完整企业 / 业务线归属的验收样本 Lead：${leadName}`);
  }

  return lead;
}

async function pageText(page: Page) {
  return (await page.locator("body").innerText()).replace(/\s+/g, " ");
}

async function assistantText(page: Page) {
  const assistant = page.locator("aside").filter({ hasText: "V3.1 智能跟进助手" });
  return (await assistant.innerText()).replace(/\s+/g, " ");
}

async function assertReadOnlyScopedRecords(lead: LeadScope) {
  const scopeWhere = {
    enterpriseId: lead.enterpriseId,
    businessLineId: lead.businessLineId
  };

  const [materials, leakingMaterials, taskTemplates, leakingTaskTemplates, strategy, leakingStrategies, knowledgeItems, leakingKnowledgeItems] = await Promise.all([
    prisma.material.findMany({
      where: {
        ...scopeWhere,
        OR: [{ customerType: lead.customerType }, { customerType: null }]
      },
      select: { id: true, title: true, enterpriseId: true, businessLineId: true }
    }),
    prisma.material.findMany({
      where: {
        businessLineId: { not: lead.businessLineId },
        OR: [{ customerType: lead.customerType }, { title: { contains: lead.businessLine?.name ?? "__never__" } }]
      },
      select: { id: true }
    }),
    prisma.taskTemplate.findMany({
      where: {
        ...scopeWhere,
        isActive: true,
        AND: [{ OR: [{ customerType: lead.customerType }, { customerType: null }] }, { OR: [{ stage: lead.stage }, { stage: null }] }]
      },
      select: { id: true, title: true, enterpriseId: true, businessLineId: true }
    }),
    prisma.taskTemplate.findMany({
      where: {
        businessLineId: { not: lead.businessLineId },
        customerType: lead.customerType
      },
      select: { id: true }
    }),
    prisma.customerTypeStrategy.findFirst({
      where: {
        ...scopeWhere,
        customerType: lead.customerType
      },
      select: { id: true, enterpriseId: true, businessLineId: true }
    }),
    prisma.customerTypeStrategy.findMany({
      where: {
        businessLineId: { not: lead.businessLineId },
        customerType: lead.customerType
      },
      select: { id: true }
    }),
    prisma.marketClawKnowledgeItem.findMany({
      where: {
        status: "ACTIVE",
        OR: [{ businessLineId: lead.businessLineId }, { businessLineId: null }]
      },
      select: { id: true, businessLineId: true }
    }),
    prisma.marketClawKnowledgeItem.findMany({
      where: {
        status: "ACTIVE",
        businessLineId: { not: lead.businessLineId }
      },
      select: { id: true, businessLineId: true }
    })
  ]);

  expect(materials.every((item) => item.enterpriseId === lead.enterpriseId && item.businessLineId === lead.businessLineId)).toBe(true);
  expect(leakingMaterials).toHaveLength(0);
  expect(taskTemplates.every((item) => item.enterpriseId === lead.enterpriseId && item.businessLineId === lead.businessLineId)).toBe(true);
  expect(leakingTaskTemplates).toHaveLength(0);
  expect(strategy?.enterpriseId).toBe(lead.enterpriseId);
  expect(strategy?.businessLineId).toBe(lead.businessLineId);
  expect(leakingStrategies).toHaveLength(0);
  expect(knowledgeItems.every((item) => item.businessLineId === lead.businessLineId || item.businessLineId === null)).toBe(true);
  expect(leakingKnowledgeItems.every((item) => item.businessLineId !== lead.businessLineId)).toBe(true);
}

test.describe("V3.1 智能跟进助手防跨业务线串线 smoke", () => {
  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("LeadReplyAssistant 对张总、李设计师、王主任样本按业务线隔离建议和资料", async ({ page }) => {
    await login(page);

    const seenSuggestionTexts = new Map<string, string>();

    for (const item of leadCases) {
      const lead = await findLeadScope(item.leadName);
      await page.goto(`/app/zhengmu-platform/leads/${lead.id}`);
      await expect(page.getByText("V3.1 智能跟进助手")).toBeVisible();
      await expect(page.getByText("不会自动发送到企微")).toBeVisible();
      await expect(page.getByRole("complementary").getByText("当前业务线", { exact: true })).toBeVisible();

      await page.getByLabel("客户刚问了什么").fill(item.question);
      await page.getByRole("button", { name: "生成建议回复" }).click();
      await expect(page.getByText("回复话术").first()).toBeVisible();

      const text = await assistantText(page);
      const fullPageText = await pageText(page);
      for (const requiredText of item.requiredTexts) {
        expect(fullPageText, `${item.label} 应出现：${requiredText}`).toContain(requiredText);
      }
      for (const forbiddenText of item.forbiddenTexts) {
        expect(text, `${item.label} 不应出现：${forbiddenText}`).not.toContain(forbiddenText);
      }

      expect(text).toContain("推荐资料");
      expect(text).toContain("下一步动作");
      expect(text).toContain("最近跟进上下文");
      expect(text).toContain("复制");
      expect(text).not.toContain("自动发送企微");
      expect(text).not.toContain("自动回复客户");

      const assistantLinks = await page
        .locator("aside")
        .filter({ hasText: "V3.1 智能跟进助手" })
        .locator("a")
        .evaluateAll((links) => links.map((link) => (link as HTMLAnchorElement).href));
      expect(assistantLinks.filter((href) => /^https?:\/\//.test(href))).toEqual([]);

      const suggestionText = await page.locator("textarea").filter({ hasText: /./ }).nth(1).inputValue();
      seenSuggestionTexts.set(item.label, suggestionText);
    }

    expect(seenSuggestionTexts.get("张总 - 整木网会员意向")).not.toEqual(seenSuggestionTexts.get("张总 - GEO推广意向"));
    expect(seenSuggestionTexts.get("张总 - GEO推广意向")).not.toEqual(seenSuggestionTexts.get("张总 - 天团合作意向"));
  });

  test("Prisma 只读断言覆盖资料、任务模板、客户策略和知识的 Lead scope 隔离", async () => {
    for (const item of leadCases) {
      const lead = await findLeadScope(item.leadName);
      await assertReadOnlyScopedRecords(lead);
    }
  });

  test("MarketClawReplyDraft 以 Lead 归属为准并忽略 URL 与表单业务线覆盖", async ({ page }) => {
    await login(page);

    const geoLead = await findLeadScope("张总 - GEO推广意向");
    const cnasLead = await findLeadScope("王主任 - CNAS认可咨询");

    await page.goto(`/app/zhengmu-platform/leads/${geoLead.id}?enterpriseKey=hangyu&businessLineKey=cnas`);
    await page.locator('textarea[name="customerQuestion"]').first().fill("我们想做 GEO 推广，先看看官网诊断和行业排名内容怎么做。");
    await page.locator('input[name="businessLineId"]').evaluate((input, value) => {
      (input as HTMLInputElement).value = value as string;
    }, cnasLead.businessLineId);
    await page.getByRole("button", { name: "生成回复草稿" }).click();
    await expect(page.getByText("客户问题：我们想做 GEO 推广").first()).toBeVisible();

    const draft = await prisma.marketClawReplyDraft.findFirst({
      where: { leadId: geoLead.id },
      orderBy: { createdAt: "desc" },
      include: { businessLine: { select: { name: true, key: true } } }
    });

    expect(draft?.businessLineId).toBe(geoLead.businessLineId);
    expect(draft?.businessLine?.key).toBe("zhengmu");
    expect(draft?.businessLine?.name).toBe("整木网");
  });
});
