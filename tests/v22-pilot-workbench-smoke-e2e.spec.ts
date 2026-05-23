/*
 * 文件说明：该文件提供 V2.2 试点工作台收口的轻量 smoke 回归测试。
 * 功能说明：验证首页可打开、管理员/运营可见独立 AI 训练入口、销售主路径可见，并确认设置类入口不直接暴露给销售。
 *
 * 结构概览：
 *   第一部分：登录辅助函数
 *   第二部分：管理员导航与首页 smoke 测试
 *   第三部分：销售路径与低频设置隐藏测试
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

test.describe("V2.2 试点工作台收口 smoke", () => {
  test("TENANT_ADMIN 可以打开首页，并看到独立 AI 训练入口", async ({ page }) => {
    await login(page, "boss@zhengmu.local");
    await page.goto("/app/zhengmu-demo/dashboard");

    await expect(page.locator("main")).toBeVisible();
    await expect(page.getByRole("heading", { name: /试点.*工作台|销售.*工作台/, level: 1 })).toBeVisible();

    const navGroups = page.locator("[data-nav-group]");
    await expect(navGroups).toHaveCount(6);
    await expect(page.locator('[data-nav-group="工作台"]')).toBeVisible();
    await expect(page.locator('[data-nav-group="客户"]')).toBeVisible();
    await expect(page.locator('[data-nav-group="跟进"]')).toBeVisible();
    await expect(page.locator('[data-nav-group="资料"]')).toBeVisible();
    await expect(page.locator('[data-nav-group="AI训练"]')).toBeVisible();
    await expect(page.locator('[data-nav-group="设置"]')).toBeVisible();
  });

  test("SALES 可以看到销售主路径，但不直接暴露设置类入口", async ({ page }) => {
    await login(page, "sales@zhengmu.local");
    await page.goto("/app/zhengmu-demo/dashboard");

    await expect(page.getByRole("heading", { name: /试点.*工作台|销售.*工作台/, level: 1 })).toBeVisible();
    await expect(page.locator('[data-nav-group="工作台"]')).toBeVisible();
    await expect(page.locator('[data-nav-group="客户"]')).toBeVisible();
    await expect(page.locator('[data-nav-group="跟进"]')).toBeVisible();

    await expect(page.locator('[data-nav-group="设置"]')).toHaveCount(0);
    await expect(page.locator('[data-nav-group="AI训练"]')).toHaveCount(0);
    await expect(page.locator('a[href$="/ai-settings"]')).toHaveCount(0);
    await expect(page.locator('a[href$="/wecom"]')).toHaveCount(0);
    await expect(page.locator('a[href$="/communication-compliance"]')).toHaveCount(0);
    await expect(page.locator('a[href$="/audit-logs"]')).toHaveCount(0);
    await expect(page.locator('a[href$="/market-claw/training/review"]')).toHaveCount(0);
    await expect(page.locator('a[href$="/market-claw/sandbox"]')).toHaveCount(0);
  });
});
