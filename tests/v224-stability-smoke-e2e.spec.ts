/*
 * 文件说明：该文件提供 V2.2.4 稳定性收口的轻量 smoke 测试。
 * 功能说明：验证工作台、销售主路径、客户详情 AI 推荐区域和管理员设置页仍可访问。
 *
 * 结构概览：
 *   第一部分：登录辅助函数
 *   第二部分：工作台与销售主路径 smoke
 *   第三部分：客户详情和设置页 smoke
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

test.describe("V2.2.4 稳定性收口 smoke", () => {
  test("TENANT_ADMIN 和 SALES 都可以打开工作台", async ({ page }) => {
    await login(page, "boss@zhengmu.local");
    await page.goto("/app/zhengmu-demo/dashboard");
    await expect(page.getByRole("heading", { name: /客户增长工作台|MarketClaw 销售助手/, level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "今日待跟进客户" })).toBeVisible();

    await page.goto("/logout");
    await login(page, "sales@zhengmu.local");
    await page.goto("/app/zhengmu-demo/dashboard");
    await expect(page.getByRole("heading", { name: /客户增长工作台|MarketClaw 销售助手/, level: 1 })).toBeVisible();
    await expect(page.locator('[data-nav-group="设置"]')).toHaveCount(0);
  });

  test("SALES 主路径不显示后台治理入口，且可以进入客户详情查看 AI 推荐区域", async ({ page }) => {
    await login(page, "sales@zhengmu.local");
    await page.goto("/app/zhengmu-demo/dashboard");

    for (const path of ["/market-claw", "/market-claw/sandbox", "/market-claw/training/review", "/ai-settings", "/wecom", "/communication-compliance", "/audit-logs"]) {
      await expect(page.locator(`a[href$="${path}"]`)).toHaveCount(0);
    }

    await page.goto("/app/zhengmu-demo/leads");
    const firstLead = page.locator('a[href*="/app/zhengmu-demo/leads/"]').first();
    await expect(firstLead).toBeVisible();
    await firstLead.click();

    await expect(page.getByRole("heading", { name: /客户详情/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: "AI 推荐回复" })).toBeVisible();
    await expect(page.getByText(/当前 AI 推荐暂不可用，可先手工记录跟进。|还没有生成 AI 推荐回复/)).toBeVisible();
  });

  test("TENANT_ADMIN 可以打开设置页", async ({ page }) => {
    await login(page, "boss@zhengmu.local");
    await page.goto("/app/zhengmu-demo/settings");

    await expect(page.getByRole("heading", { name: "系统设置", level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "业务基础" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "AI 治理" })).toBeVisible();
  });
});

