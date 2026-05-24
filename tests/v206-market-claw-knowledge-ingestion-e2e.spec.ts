/*
 * 文件说明：该文件覆盖 V2.0.6 Market Claw 资料投喂与候选知识生成的浏览器端验证。
 * 功能说明：验证管理员资料投喂、候选知识生成与采纳、运营可访问、销售被拒绝，以及既有 Market Claw 链路不受影响。
 *
 * 结构概览：
 *   第一部分：登录与定位辅助函数
 *   第二部分：V2.0.6 串行回归用例
 */
import { expect, test, type Page } from "@playwright/test";

const suffix = Date.now().toString().slice(-6);
const ingestionTitle = `V206 资料投喂 ${suffix}`;
const faqQuestion = `V206 FAQ 问题 ${suffix}`;
const priceMarker = `V206 价格边界 ${suffix}`;
const riskMarker = `V206 风险提醒 ${suffix}`;

const ingestionText = `
问：${faqQuestion}
答：GEO 方案会先看品牌在 AI 搜索里的可见性，再决定是先补内容底座还是先做分发策略。

${priceMarker}：
内容增长不会先空口报死价，需要结合品牌现状、内容体量和目标范围先判断，再给出报价边界。

${riskMarker}：
不能保证一定被 AI 推荐，也不能承诺固定排名、固定名额或绝对效果。
`.trim();

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

function candidateCard(page: Page, text: string) {
  return page.locator("div.rounded-md.border.border-slate-200.bg-white").filter({ has: page.getByText(text) }).first();
}

test.describe.serial("V2.0.6 Market Claw：资料投喂与候选知识生成", () => {
  test("TENANT_ADMIN 可投喂资料、生成候选知识并采纳入库", async ({ page }) => {
    await login(page, "platform-boss@zhengmu.local", "123456", "/app/zhengmu-platform/market-claw/ingestion");

    await expect(page.getByRole("heading", { name: "Market Claw 资料投喂", level: 1 })).toBeVisible();
    await page.getByLabel("资料标题").fill(ingestionTitle);
    await page.getByLabel("文本粘贴区").fill(ingestionText);
    await page.getByRole("button", { name: "生成候选知识" }).click();

    await expect(page.getByRole("heading", { name: `FAQ：${faqQuestion}` })).toBeVisible();
    await expect(page.getByRole("heading", { name: `价格边界：${priceMarker}` })).toBeVisible();
    await expect(page.getByRole("heading", { name: `风险提醒：${riskMarker}` })).toBeVisible();

    const faqCard = candidateCard(page, `FAQ：${faqQuestion}`);
    await faqCard.getByRole("button", { name: "采纳入库" }).click();
    await expect(faqCard.getByText("已生成知识条目")).toBeVisible();

    await page.goto("/app/zhengmu-platform/market-claw/knowledge");
    await expect(page.getByRole("heading", { name: "Market Claw 知识库" })).toBeVisible();
    await expect(page.getByText(`FAQ：${faqQuestion}`).first()).toBeVisible();

    await page.goto("/app/zhengmu-platform/audit-logs?action=market_claw_knowledge_candidate_adopted");
    await expect(page.getByText("market_claw_knowledge_candidate_adopted").first()).toBeVisible();

    await page.goto("/app/zhengmu-platform/market-claw/training");
    await expect(page.getByRole("heading", { name: "Market Claw 回复训练场" })).toBeVisible();
  });

  test("OPERATOR 可进入资料投喂页", async ({ page }) => {
    await login(page, "platform-operator@zhengmu.local", "123456", "/app/zhengmu-platform/market-claw/ingestion");
    await expect(page.getByRole("heading", { name: "Market Claw 资料投喂", level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: "资料投喂", exact: true }).first()).toBeVisible();
  });

  test("SALES 不显示资料投喂入口，直接访问资料投喂页会被拒绝", async ({ page }) => {
    await login(page, "platform-sales@zhengmu.local", "123456", "/app/zhengmu-platform/market-claw");
    await expect(page.getByText("Market Claw 不是 AI 客服，是懂业务的销售智能助手。")).toBeVisible();
    await expect(page.getByRole("link", { name: "资料投喂", exact: true })).toHaveCount(0);

    await page.goto("/app/zhengmu-platform/market-claw/ingestion");
    await expect(page).toHaveURL(/\/forbidden$/);

    await page.goto("/app/zhengmu-platform/market-claw/training");
    await expect(page.getByRole("heading", { name: "Market Claw 我的训练" })).toBeVisible();
  });
});

