/*
 * 文件说明：该文件覆盖 V2.1.9 试点演示路径固化与系统入口极简收口的浏览器端回归验证。
 * 功能说明：验证首页试点工作台、Market Claw 分层、销售极简路径和既有页面可访问性。
 *
 * 结构概览：
 *   第一部分：登录辅助函数
 *   第二部分：管理员试点工作台与 Market Claw 分层测试
 *   第三部分：销售路径和既有页面回归测试
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

test.describe("V2.1.9 试点演示路径固化与系统入口极简收口", () => {
  test("TENANT_ADMIN 首页突出三条试点主路径，并弱化低频配置", async ({ page }) => {
    await login(page, "boss@zhengmu.local");
    await page.goto("/app/zhengmu-demo/dashboard");

    await expect(page.getByRole("heading", { name: "客户增长工作台", level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "今日待跟进客户" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "新线索" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "今日 AI 推荐回复" })).toBeVisible();
    await expect(page.getByRole("link", { name: "查看今日待办" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "快速新增客户" })).toBeVisible();
  });

  test("Market Claw 总览页拆分销售使用路径和后台治理路径", async ({ page }) => {
    await login(page, "boss@zhengmu.local");
    await page.goto("/app/zhengmu-demo/market-claw");

    await expect(page.getByRole("heading", { name: "AI 推荐回复", level: 1 })).toBeVisible();
    await expect(page.getByText("试点讲法", { exact: true })).toBeVisible();
    await expect(page.getByText("推荐回复记录", { exact: true })).toBeVisible();
    await expect(page.getByText("下一步入口", { exact: true })).toBeVisible();
    await expect(page.getByText("1. 打开客户详情", { exact: true })).toBeVisible();
    await expect(page.getByText("2. 查看 AI 推荐回复", { exact: true })).toBeVisible();
    await expect(page.getByText("3. 人工确认后使用", { exact: true })).toBeVisible();
    await expect(page.getByText("4. 保存沟通记录", { exact: true })).toBeVisible();
  });

  test("SALES 路径保持极简且不显示高权限入口", async ({ page }) => {
    await login(page, "sales@zhengmu.local");
    await page.goto("/app/zhengmu-demo/dashboard");

    await expect(page.getByRole("heading", { name: "客户增长工作台", level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "今日待跟进客户" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "新线索" })).toBeVisible();
    await expect(page.getByRole("link", { name: "进入客户列表" }).first()).toBeVisible();
    await expect(page.locator('a[href$="/market-claw/sandbox"]')).toHaveCount(0);
    await expect(page.locator('a[href$="/ai-settings"]')).toHaveCount(0);
    await expect(page.locator('a[href$="/wecom"]')).toHaveCount(0);
    await expect(page.locator('a[href$="/communication-compliance"]')).toHaveCount(0);
    await expect(page.locator('a[href$="/market-claw/training/review"]')).toHaveCount(0);

    await expect(page.locator('a[href$="/market-claw/sandbox"]')).toHaveCount(0);
    await expect(page.getByText("试点讲法")).toHaveCount(0);
  });

  test("原有 AI 沙盒和核心模块仍可访问", async ({ page }) => {
    await login(page, "boss@zhengmu.local");

    for (const pathName of [
      "/app/zhengmu-demo/market-claw/sandbox",
      "/app/zhengmu-demo/leads",
      "/app/zhengmu-demo/todos",
      "/app/zhengmu-demo/market-claw"
    ]) {
      const response = await page.goto(pathName);
      expect(response?.status()).toBeLessThan(400);
    }

    await page.goto("/app/zhengmu-demo/market-claw/sandbox");
    await expect(page.getByRole("heading", { name: "AI 测试沙盒", level: 1 })).toBeVisible();
  });
});

