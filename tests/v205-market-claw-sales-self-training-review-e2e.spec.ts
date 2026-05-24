/*
 * 文件说明：该文件覆盖 V2.0.5 Market Claw 销售自我训练与训练审核机制的浏览器端验证。
 * 功能说明：验证销售个人训练、个人话术保存、提交审核、管理员采纳与驳回、客户详情页新入口，以及旧链路不受影响。
 *
 * 结构概览：
 *   第一部分：登录与定位辅助函数
 *   第二部分：V2.0.5 串行回归用例
 */
import { expect, test, type Page } from "@playwright/test";

const suffix = Date.now().toString().slice(-6);
const ownLeadId = "platform-lead-009";
const trainingQuestion = `V205 销售自训问题 ${suffix}`;
const rejectQuestion = `V205 驳回训练问题 ${suffix}`;
const leadDraftQuestion = `V205 客户详情训练问题 ${suffix}`;

async function login(page: Page, email: string, password = "123456", nextPath?: string) {
  const loginUrl = nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : "/login";
  await page.goto(loginUrl);
  await expect(page.getByLabel("邮箱")).toBeVisible({ timeout: 120_000 });
  await page.getByLabel("邮箱").fill(email);
  await page.getByLabel("密码").fill(password);
  await page.getByRole("button", { name: "登录" }).click();
  if (nextPath) {
    await page.waitForURL(new RegExp(`${nextPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
  } else {
    await page.waitForURL(/\/(admin|app\/[^/]+\/dashboard)$/);
  }
  await page.waitForLoadState("networkidle");
}

function trainingCard(page: Page, question: string) {
  return page.locator("div.rounded-md.border.border-slate-200.bg-white").filter({ has: page.getByText(question) }).first();
}

function reviewCard(page: Page, question: string) {
  return page.locator("div.rounded-md.border.border-slate-200.bg-white").filter({ has: page.getByText(question) }).first();
}

function draftCard(page: Page, question: string) {
  return page.locator("div.rounded-md.border.border-slate-200.bg-slate-50\\/50.p-4").filter({ has: page.getByText(question) }).first();
}

test.describe.serial("V2.0.5 Market Claw：销售自我训练与训练审核机制", () => {
  test("SALES 可以进入我的训练、保存个人话术并提交审核，且高权限页仍然拒绝", async ({ page }) => {
    await login(page, "platform-sales@zhengmu.local", "123456", "/app/zhengmu-platform/market-claw/training");

    await expect(page.getByRole("heading", { name: "Market Claw 我的训练", level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: "我的训练", exact: true }).first()).toBeVisible();

    await page.getByLabel("客户真实问题").fill(trainingQuestion);
    await page.getByLabel("业务线").selectOption({ label: "内容增长" });
    await page.getByRole("button", { name: "生成我的训练回复" }).click();

    const currentCard = trainingCard(page, trainingQuestion);
    await expect(currentCard.getByRole("heading", { name: "简短微信版", exact: true })).toBeVisible();
    await expect(currentCard.getByRole("heading", { name: "专业说明版", exact: true })).toBeVisible();
    await expect(currentCard.getByRole("heading", { name: "推进成交版", exact: true })).toBeVisible();

    await currentCard.getByRole("button", { name: "保存为个人常用话术" }).click();
    await expect(currentCard).toContainText("个人常用");

    await currentCard.getByRole("button", { name: "提交训练结果审核" }).click();
    await expect(currentCard).toContainText("待审核");

    await page.goto("/app/zhengmu-platform/market-claw/knowledge");
    await expect(page).toHaveURL(/\/forbidden$/);

    await page.goto("/app/zhengmu-platform/market-claw/training/review");
    await expect(page).toHaveURL(/\/forbidden$/);
  });

  test("TENANT_ADMIN 可以看到待审核训练，采纳为团队标准、企业标准，并驳回另一个销售训练", async ({ page }) => {
    await login(page, "platform-sales@zhengmu.local", "123456", "/app/zhengmu-platform/market-claw/training");
    await page.getByLabel("客户真实问题").fill(rejectQuestion);
    await page.getByLabel("业务线").selectOption({ label: "内容增长" });
    await page.getByRole("button", { name: "生成我的训练回复" }).click();
    const rejectTrainingCard = trainingCard(page, rejectQuestion);
    await rejectTrainingCard.getByRole("button", { name: "提交训练结果审核" }).click();
    await expect(rejectTrainingCard).toContainText("待审核");

    await login(page, "platform-boss@zhengmu.local", "123456", "/app/zhengmu-platform/market-claw/training/review");

    const pendingCard = reviewCard(page, trainingQuestion);
    await expect(pendingCard).toContainText("待审核");
    await pendingCard.getByRole("button", { name: "采纳为团队标准" }).click();
    await expect(pendingCard).toContainText("团队可用");

    await pendingCard.getByRole("button", { name: "采纳为企业标准" }).click();
    await expect(pendingCard).toContainText("企业标准");

    const rejectedCard = reviewCard(page, rejectQuestion);
    await rejectedCard.getByLabel("审核状态").selectOption("REJECTED");
    await rejectedCard.getByLabel("审核意见或驳回原因").fill("这条回复边界不清，先驳回重练。");
    await rejectedCard.getByRole("button", { name: "保存审核结论" }).click();
    await expect(rejectedCard).toContainText("已驳回");
    await expect(rejectedCard.getByText("这条回复边界不清，先驳回重练。")).toBeVisible();

    await page.goto("/app/zhengmu-platform/market-claw/knowledge?scopeLevel=ENTERPRISE");
    await expect(page.getByRole("heading", { name: "Market Claw 知识库" })).toBeVisible();
    await expect(page.locator("span").filter({ hasText: "企业标准" }).first()).toBeVisible();

    await page.goto("/app/zhengmu-platform/audit-logs?action=market_claw_training_adopted_as_enterprise");
    await expect(page.getByText("market_claw_training_adopted_as_enterprise").first()).toBeVisible();
  });

  test("客户详情页仍可生成回复，并可保存为个人话术或提交训练审核", async ({ page }) => {
    await login(page, "platform-sales@zhengmu.local", "123456", `/app/zhengmu-platform/leads/${ownLeadId}`);

    await expect(page.getByRole("heading", { name: "Market Claw 智能回复", exact: true })).toBeVisible();
    await page.getByLabel("客户问题").fill(leadDraftQuestion);
    await page.getByLabel("业务线").selectOption({ label: "内容增长" });
    await page.getByRole("button", { name: "生成回复草稿" }).click();

    const card = draftCard(page, leadDraftQuestion);
    await expect(card.getByRole("heading", { name: "简短微信版", exact: true })).toBeVisible();
    await expect(card.getByRole("button", { name: "保存为个人常用话术" })).toBeVisible();
    await expect(card.getByRole("button", { name: "提交为训练样本审核" })).toBeVisible();

    await card.getByRole("button", { name: "保存为个人常用话术" }).click();
    await card.getByRole("button", { name: "提交为训练样本审核" }).click();
    await expect(card.getByText("这条回复已经提交审核。")).toBeVisible();

    await page.goto("/app/zhengmu-platform/market-claw/replies?submitted=yes");
    await expect(page.getByText(leadDraftQuestion).first()).toBeVisible();
    await expect(page.getByText("是否提交审核").first()).toBeVisible();
  });

  test("V2.0.4 导航和既有链路不受影响：总览、CNAS、采集合规与 demo-guide 仍可访问", async ({ page }) => {
    await login(page, "platform-boss@zhengmu.local", "123456", "/app/zhengmu-platform/market-claw");
    await expect(page.getByText("Market Claw 不是 AI 客服，是懂业务的销售智能助手。")).toBeVisible();
    await expect(page.getByRole("link", { name: "训练审核", exact: true }).first()).toBeVisible();

    await page.goto("/app/zhengmu-platform/communication-compliance");
    await expect(page.getByRole("heading", { name: "沟通素材合规采集配置" })).toBeVisible();

    await page.goto("/forms/cnas-path-check");
    await expect(page.getByRole("heading", { name: "CNAS认可路径判断问卷" })).toBeVisible();

    await page.goto("/logout");
    await login(page, "boss@zhengmu.local", "123456", "/app/zhengmu-demo/demo-guide");
    await expect(page.getByRole("heading", { name: "MarketClaw 销售助手平台说明" })).toBeVisible();
  });
});

