/*
 * 文件说明：该文件覆盖 V2.1.8 导航下拉化与首页入口收口优化的浏览器端回归验证。
 * 功能说明：验证租户首页模块入口、更多下拉、Market Claw 沙盒入口和销售权限边界。
 *
 * 结构概览：
 *   第一部分：导入依赖与登录辅助函数
 *   第二部分：管理员导航收口测试
 *   第三部分：销售权限与既有页面回归测试
 */
import { expect, test, type Page } from "@playwright/test";

async function login(page: Page, email: string, password = "123456") {
  await page.goto("/login");
  await expect(page.locator('input[name="email"]')).toBeVisible();
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.locator("form button").click();
  await page.waitForURL(/\/(admin|app\/[^/]+\/dashboard)$/);
}

function navGroup(page: Page, name: string) {
  return page.locator(`[data-nav-group="${name}"]`);
}

test.describe("V2.1.8 导航下拉化与首页入口收口优化", () => {
  test("TENANT_ADMIN 首页模块入口收口，并可通过 Market Claw 更多访问低频入口", async ({ page }) => {
    await login(page, "boss@zhengmu.local");
    await page.goto("/app/zhengmu-demo/dashboard");

    for (const groupName of ["首页", "客户管理", "跟进工作台", "Market Claw", "业务配置"]) {
      await expect(navGroup(page, groupName)).toBeVisible();
      await expect(navGroup(page, groupName).locator('[data-nav-shortcut="visible"]')).toHaveCount(
        groupName === "首页" ? 3 : 2
      );
    }

    await expect(navGroup(page, "客户管理").getByText("更多")).toBeVisible();
    await expect(navGroup(page, "Market Claw").getByText("更多")).toBeVisible();

    await navGroup(page, "Market Claw").getByText("更多").click();
    await expect(navGroup(page, "Market Claw").locator('[data-module-more-item="true"]').filter({ hasText: "知识库" })).toBeVisible();
    await expect(navGroup(page, "Market Claw").locator('[data-module-more-item="true"]').filter({ hasText: "资料投喂" })).toBeVisible();
    await expect(navGroup(page, "Market Claw").locator('[data-module-more-item="true"]').filter({ hasText: "训练审核" })).toBeVisible();
    await expect(navGroup(page, "Market Claw").locator('[data-module-more-item="true"]').filter({ hasText: "回复记录" })).toBeVisible();

    await expect(navGroup(page, "Market Claw").locator('a[href="/app/zhengmu-demo/market-claw/sandbox"]')).toBeVisible();
    await navGroup(page, "Market Claw").locator('a[href="/app/zhengmu-demo/market-claw/sandbox"]').click();
    await expect(page).toHaveURL(/\/app\/zhengmu-demo\/market-claw\/sandbox$/);
    await expect(page.getByRole("heading", { name: "AI 测试沙盒", level: 1 })).toBeVisible();
  });

  test("SALES 不显示高权限入口，直接访问高权限页面仍被拒绝", async ({ page }) => {
    await login(page, "sales@zhengmu.local");
    await page.goto("/app/zhengmu-demo/dashboard");

    await expect(navGroup(page, "客户管理")).toBeVisible();
    await expect(navGroup(page, "跟进工作台")).toBeVisible();
    await expect(navGroup(page, "Market Claw")).toBeVisible();
    await expect(navGroup(page, "业务配置")).toHaveCount(0);

    await expect(page.locator('a[href$="/market-claw/sandbox"]')).toHaveCount(0);
    await expect(page.locator('a[href$="/ai-settings"]')).toHaveCount(0);
    await expect(page.locator('a[href$="/market-claw/training/review"]')).toHaveCount(0);

    await page.goto("/app/zhengmu-demo/market-claw/sandbox");
    await expect(page).toHaveURL(/\/forbidden$/);

    await page.goto("/app/zhengmu-demo/ai-settings");
    await expect(page).toHaveURL(/\/forbidden$/);
  });

  test("原有模块页面仍可访问", async ({ page }) => {
    await login(page, "boss@zhengmu.local");

    for (const pathName of [
      "/app/zhengmu-demo/market-claw",
      "/app/zhengmu-demo/market-claw/sandbox",
      "/app/zhengmu-demo/leads",
      "/app/zhengmu-demo/todos"
    ]) {
      const response = await page.goto(pathName);
      expect(response?.status()).toBeLessThan(400);
    }
  });
});
