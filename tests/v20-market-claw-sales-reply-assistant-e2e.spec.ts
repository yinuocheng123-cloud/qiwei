/*
 * 文件说明：该文件覆盖 V2.0 麻虾 Market Claw 的浏览器端 E2E 验证。
 * 功能说明：验证知识投喂、回复训练、客户详情页回复草稿、标签确认、跟进保存、任务创建、权限边界与现有链路兼容。
 *
 * 结构概览：
 *   第一部分：测试数据与辅助函数
 *   第二部分：V2.0 串行回归用例
 */
import { expect, test, type Page } from "@playwright/test";

const suffix = Date.now().toString().slice(-6);
const geoKnowledgeTitle = `GEO效果边界知识${suffix}`;
const standardKnowledgeTitle = `GEO标准回复沉淀${suffix}`;
const ownLeadId = "platform-lead-009";
const otherLeadId = "platform-lead-011";
const geoQuestion = "你们 GEO 推广能保证效果吗？";

async function login(page: Page, email: string, password = "123456", nextPath?: string) {
  const loginUrl = nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : "/login";
  await page.goto(loginUrl);
  await expect(page.getByLabel("邮箱")).toBeVisible({ timeout: 120_000 });
  await page.getByLabel("邮箱").fill(email);
  await page.getByLabel("密码").fill(password);
  await page.getByRole("button", { name: "登录" }).click();
  if (nextPath) {
    await page.waitForURL(new RegExp(`${nextPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`));
  } else {
    await page.waitForURL(/\/(admin|app\/[^/]+\/dashboard)$/);
  }
  await page.waitForLoadState("networkidle");
}

function section(page: Page, title: string) {
  return page.getByRole("heading", { name: title, exact: true, level: 2 }).locator("..");
}

function draftCard(page: Page) {
  return page.locator("div.rounded-md.border.border-slate-200.bg-slate-50\\/50.p-4").first();
}

function followUpCards(page: Page) {
  return page.locator("div.rounded-md.border.border-slate-200.p-3").filter({ has: page.getByText("下一步：") });
}

test.describe.serial("V2.0 麻虾 Market Claw：销售智能回复助手", () => {
  test("TENANT_ADMIN 可访问麻虾知识库和训练场，可新增 GEO 知识并沉淀标准回复", async ({ page }) => {
    await login(page, "platform-boss@zhengmu.local", "123456", "/app/zhengmu-platform/market-claw/knowledge");

    await expect(page.getByRole("heading", { name: "Market Claw 知识库" })).toBeVisible();
    const createCard = page.locator("div.rounded-md.border.border-slate-200.bg-white").filter({
      has: page.getByRole("heading", { name: "新增知识" })
    }).first();
    await createCard.getByLabel("业务线").selectOption({ label: "GEO／AI 推广" });
    await createCard.getByLabel("知识类型").selectOption({ label: "价格边界" });
    await createCard.getByRole("textbox", { name: "标题" }).fill(geoKnowledgeTitle);
    await createCard.getByRole("textbox", { name: "正文" }).fill("GEO 方案需要先做 AI 可见性诊断，不承诺保证 AI 推荐结果，也不空口承诺绝对效果。");
    await createCard.getByRole("textbox", { name: "关键词" }).fill("GEO\nAI搜索\n保证效果");
    await createCard.getByRole("textbox", { name: "不能承诺事项" }).fill("保证 AI 推荐\n保证排名");
    await createCard.getByRole("textbox", { name: "风险提醒" }).fill("涉及效果承诺时必须人工确认，不能承诺绝对结果。");
    await createCard.getByRole("button", { name: "新增知识条目" }).click();

    await expect(page.getByText(geoKnowledgeTitle)).toBeVisible();

    await page.goto("/app/zhengmu-platform/market-claw/training");
    await expect(page.getByRole("heading", { name: "回复训练场" })).toBeVisible();
    await page.getByLabel("客户问题").fill(geoQuestion);
    await page.getByLabel("业务线").selectOption({ label: "GEO／AI 推广" });
    await page.getByRole("button", { name: "生成训练结果" }).click();

    const currentCard = page.locator("div.rounded-md.border.border-slate-200").filter({
      has: page.getByText(geoQuestion)
    }).first();
    await expect(currentCard.getByRole("heading", { name: "简短微信版", exact: true })).toBeVisible();
    await expect(currentCard.getByRole("heading", { name: "专业说明版", exact: true })).toBeVisible();
    await expect(currentCard.getByRole("heading", { name: "推进成交版", exact: true })).toBeVisible();
    await expect(currentCard.getByRole("heading", { name: "风险提醒", exact: true })).toBeVisible();
    await expect(currentCard).toContainText("不能承诺");
    await expect(currentCard).toContainText("AI");

    await currentCard.getByLabel("人工优化版本").first().fill("我们会先做 AI 可见性诊断，再判断适合的 GEO 推进方案，但不会承诺保证 AI 推荐结果。");
    await currentCard.getByLabel("禁止表达或风险提醒").fill("不能承诺保证 AI 推荐；不能承诺绝对效果。");
    await currentCard.getByRole("button", { name: "保存训练结论" }).click();

    await currentCard.getByLabel("知识标题").fill(standardKnowledgeTitle);
    await currentCard.getByRole("button", { name: "沉淀为标准回复" }).click();
    await expect(currentCard.getByText("已沉淀为标准回复")).toBeVisible();
  });

  test("SALES 可在自己负责客户详情页使用麻虾，确认标签、保存跟进并创建任务", async ({ page }) => {
    await login(page, "platform-sales@zhengmu.local", "123456", `/app/zhengmu-platform/leads/${ownLeadId}`);

    await expect(page.getByRole("heading", { name: "Market Claw 智能回复" })).toBeVisible();
    await expect(page.getByText("当前版本不接企业微信上下文")).toBeVisible();
    await expect(page.getByText("当前版本不自动发送客户消息")).toBeVisible();

    await page.getByLabel("客户问题").fill(geoQuestion);
    await page.getByLabel("业务线").selectOption({ label: "GEO／AI 推广" });
    await page.getByRole("button", { name: "生成回复草稿" }).click();

    const card = draftCard(page);
    await expect(card.getByRole("heading", { name: "简短微信版", exact: true })).toBeVisible();
    await expect(card.getByRole("heading", { name: "专业说明版", exact: true })).toBeVisible();
    await expect(card.getByRole("heading", { name: "推进成交版", exact: true })).toBeVisible();
    await expect(card.getByRole("heading", { name: "风险提醒", exact: true })).toBeVisible();
    await expect(card).toContainText("不要承诺绝对结果");
    await expect(card).toContainText("GEO意向");
    await expect(card).toContainText("AI推广关注");

    await card.getByRole("button", { name: "确认添加推荐标签" }).click();
    await expect(section(page, "标签")).toContainText("GEO意向");

    const followUpCountBefore = await followUpCards(page).count();
    await card.getByLabel("选用回复版本").selectOption({ label: "简短微信版" });
    await card.getByRole("button", { name: "保存为跟进记录" }).click();
    await expect(followUpCards(page)).toHaveCount(followUpCountBefore + 1);

    await card.getByRole("button", { name: "创建下一步任务" }).click();
    await page.goto("/app/zhengmu-platform/todos");
    await expect(page.getByText("安排诊断沟通：GEO／AI 推广").first()).toBeVisible();

    await page.goto("/app/zhengmu-platform/market-claw/replies");
    await expect(page.getByRole("heading", { name: "回复记录" })).toBeVisible();
    await expect(page.getByText(geoQuestion).first()).toBeVisible();

    await page.goto(`/app/zhengmu-platform/leads/${otherLeadId}`);
    await expect(page).toHaveURL(/\/forbidden$/);

    await page.goto("/app/zhengmu-platform/market-claw/knowledge");
    await expect(page).toHaveURL(/\/forbidden$/);
  });

  test("AuditLog 出现麻虾动作，且 CNAS、采集合规配置与 zhengmu-demo 链路不受影响", async ({ page }) => {
    await login(page, "platform-boss@zhengmu.local", "123456", "/app/zhengmu-platform/audit-logs?action=market_claw_reply_generated");
    await expect(page.getByText("market_claw_reply_generated").first()).toBeVisible();

    await page.goto("/app/zhengmu-platform/audit-logs?action=market_claw_reply_saved_as_followup");
    await expect(page.getByText("market_claw_reply_saved_as_followup").first()).toBeVisible();

    await page.goto("/app/zhengmu-platform/communication-compliance");
    await expect(page.getByRole("heading", { name: "沟通素材合规采集配置" })).toBeVisible();

    await page.goto("/forms/cnas-path-check");
    await expect(page.getByRole("heading", { name: "CNAS认可路径判断问卷" })).toBeVisible();

    await page.goto("/logout");
    await login(page, "boss@zhengmu.local", "123456", "/app/zhengmu-demo/demo-guide");
    await expect(page.getByRole("heading", { name: "整木行业演示说明" })).toBeVisible();
  });
});
