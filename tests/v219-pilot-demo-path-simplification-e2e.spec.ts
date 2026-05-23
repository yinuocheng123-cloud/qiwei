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

    await expect(page.getByRole("heading", { name: "试点工作台", level: 1 })).toBeVisible();
    await expect(page.getByText("客户导入 / 客户列表")).toBeVisible();
    await expect(page.getByText("销售今日跟进")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Market Claw 回复建议" })).toBeVisible();
    await expect(page.getByRole("link", { name: "导入客户" })).toBeVisible();
    await expect(page.getByRole("link", { name: "查看今日跟进" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "去客户详情使用" })).toBeVisible();

    const mainArea = page.locator("main");
    await expect(mainArea.getByText("基础配置 / 更多设置")).toBeVisible();
    const primaryPaths = page.locator('[data-pilot-primary-paths="true"]');
    await expect(primaryPaths.getByText("AI 能力配置")).toHaveCount(0);
    await expect(primaryPaths.getByText("企业微信提醒配置")).toHaveCount(0);
    await expect(primaryPaths.getByText("合规配置")).toHaveCount(0);
  });

  test("Market Claw 总览页拆分销售使用路径和后台治理路径", async ({ page }) => {
    await login(page, "boss@zhengmu.local");
    await page.goto("/app/zhengmu-demo/market-claw");

    const salesFlow = page.getByTestId("sales-flow");
    await expect(salesFlow.getByRole("heading", { name: "销售使用路径" })).toBeVisible();
    await expect(salesFlow.getByText("客户详情", { exact: true })).toBeVisible();
    await expect(salesFlow.getByText("生成回复建议", { exact: true })).toBeVisible();
    await expect(salesFlow.getByText("销售确认", { exact: true })).toBeVisible();

    const backendFlow = page.getByTestId("backend-flow");
    await expect(backendFlow.getByRole("heading", { name: "后台治理路径" })).toBeVisible();
    await expect(backendFlow.getByText("资料投喂", { exact: true })).toBeVisible();
    await expect(backendFlow.getByText("训练审核", { exact: true })).toBeVisible();
    await expect(page.getByText("后台治理 / 更多治理入口")).toBeVisible();
  });

  test("SALES 路径保持极简且不显示高权限入口", async ({ page }) => {
    await login(page, "sales@zhengmu.local");
    await page.goto("/app/zhengmu-demo/dashboard");

    await expect(page.getByRole("heading", { name: "试点工作台", level: 1 })).toBeVisible();
    await expect(page.getByText("客户列表").first()).toBeVisible();
    await expect(page.getByText("销售今日跟进")).toBeVisible();
    await expect(page.locator('a[href$="/market-claw/sandbox"]')).toHaveCount(0);
    await expect(page.locator('a[href$="/ai-settings"]')).toHaveCount(0);
    await expect(page.locator('a[href$="/wecom"]')).toHaveCount(0);
    await expect(page.locator('a[href$="/communication-compliance"]')).toHaveCount(0);
    await expect(page.locator('a[href$="/market-claw/training/review"]')).toHaveCount(0);

    await expect(page.locator('a[href$="/market-claw/sandbox"]')).toHaveCount(0);
    await expect(page.getByText("后台治理 / 更多治理入口")).toHaveCount(0);
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
