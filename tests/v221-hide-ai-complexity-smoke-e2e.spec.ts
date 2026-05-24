/*
 * 文件说明：该文件提供 V2.2.1 隐藏复杂度与 AI 后台化的轻量 smoke 测试。
 * 功能说明：验证销售主路径不暴露 AI 后台能力，管理员设置页承接系统级治理分组，客户详情仍保留 AI 推荐回复。
 *
 * 结构概览：
 *   第一部分：登录辅助函数
 *   第二部分：销售路径隐藏复杂度测试
 *   第三部分：管理员设置页后台治理测试
 */
import { expect, test, type Page } from "@playwright/test";

async function login(page: Page, email: string, password = "123456") {
  await page.goto("/login");
  await expect(page.locator('input[name="email"]')).toBeVisible();
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await Promise.all([
    page.waitForURL((url) => url.pathname === "/admin" || /^\/app\/[^/]+\/dashboard$/.test(url.pathname)),
    page.locator("form button").click()
  ]);
}

test.describe("V2.2.1 隐藏复杂度与 AI 后台化", () => {
  test("SALES 主路径不显示 AI 后台治理入口", async ({ page }) => {
    await login(page, "sales@zhengmu.local");
    await page.goto("/app/zhengmu-demo/dashboard");

    await expect(page.getByRole("heading", { name: /客户增长工作台|MarketClaw 销售助手/, level: 1 })).toBeVisible();
    await expect(page.locator("[data-nav-group]")).toHaveCount(4);
    await expect(page.locator('[data-nav-group="工作台"]')).toBeVisible();
    await expect(page.locator('[data-nav-group="客户"]')).toBeVisible();
    await expect(page.locator('[data-nav-group="跟进"]')).toBeVisible();
    await expect(page.locator('[data-nav-group="资料"]')).toBeVisible();
    await expect(page.locator('[data-nav-group="设置"]')).toHaveCount(0);
    await expect(page.locator('[data-nav-group="AI训练"]')).toHaveCount(0);

    for (const path of [
      "/market-claw",
      "/market-claw/ingestion",
      "/market-claw/insights",
      "/market-claw/knowledge",
      "/market-claw/replies",
      "/market-claw/sandbox",
      "/market-claw/training",
      "/market-claw/training/review",
      "/ai-settings",
      "/wecom",
      "/communication-compliance",
      "/audit-logs"
    ]) {
      await expect(page.locator(`a[href$="${path}"]`)).toHaveCount(0);
    }
  });

  test("TENANT_ADMIN 设置页显示系统级治理分组", async ({ page }) => {
    await login(page, "boss@zhengmu.local");
    await page.goto("/app/zhengmu-demo/settings");

    await expect(page.getByRole("heading", { name: "系统设置", level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "业务基础" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "AI 治理" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "企业微信与提醒" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "合规与审计" })).toBeVisible();
    await expect(page.getByText("回复训练、训练审核和资料投喂已提升为独立 AI训练 模块")).toBeVisible();
  });

  test("SALES 工作台仍可进入客户详情并看到 AI 推荐回复", async ({ page }) => {
    await login(page, "sales@zhengmu.local");
    await page.goto("/app/zhengmu-demo/leads");

    const firstLead = page.locator('a[href*="/app/zhengmu-demo/leads/"]').first();
    await expect(firstLead).toBeVisible();
    await firstLead.click();

    await expect(page.getByRole("heading", { name: /客户详情/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: "AI 推荐回复" })).toBeVisible();
    await expect(page.getByText("推荐标签")).toHaveCount(0);
    await expect(page.getByText("训练状态")).toHaveCount(0);
  });
});

