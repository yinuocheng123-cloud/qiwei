/*
 * 文件说明：该文件覆盖 V2.0.4 页面体验细节与角色使用路径优化的浏览器端 E2E 验证。
 * 功能说明：验证层级提示、Tab 高亮、Market Claw 角色引导、产品详情风险边界，以及销售角色路径是否更清晰。
 *
 * 结构概览：
 *   第一部分：登录与导航辅助函数
 *   第二部分：V2.0.4 页面体验专项用例
 */
import { expect, test, type Page } from "@playwright/test";

const ownLeadId = "platform-lead-009";

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

function primaryGroups(page: Page) {
  return page.locator('[data-nav-primary="true"]');
}

function navGroup(page: Page, label: string) {
  return page.locator(`[data-nav-group="${label}"]`);
}

test.describe.serial("V2.0.4 页面体验细节与角色使用路径优化", () => {
  test("TENANT_ADMIN 保持 6 个一级入口，Market Claw 总览与产品详情层级提示清晰", async ({ page }) => {
    await login(page, "platform-boss@zhengmu.local", "123456", "/app/zhengmu-platform/dashboard");

    await expect(primaryGroups(page)).toHaveCount(6);
    await expect(navGroup(page, "首页")).toBeVisible();
    await expect(navGroup(page, "客户管理")).toBeVisible();
    await expect(navGroup(page, "跟进工作台")).toBeVisible();
    await expect(navGroup(page, "Market Claw")).toBeVisible();
    await expect(navGroup(page, "业务配置")).toBeVisible();
    await expect(navGroup(page, "系统管理")).toBeVisible();

    await page.goto("/app/zhengmu-platform/market-claw");
    await expect(page.getByRole("heading", { name: "Market Claw", exact: true, level: 1 })).toBeVisible();
    await expect(page.getByText("Market Claw 不是 AI 客服，是懂业务的销售智能助手。")).toBeVisible();
    await expect(page.locator("main").getByRole("link", { name: "知识库", exact: true }).first()).toBeVisible();
    await expect(page.locator("main").getByRole("link", { name: "回复训练场", exact: true }).first()).toBeVisible();
    await expect(page.locator("main").getByRole("link", { name: "回复记录", exact: true }).first()).toBeVisible();

    await page.goto("/app/zhengmu-platform/business-lines");
    await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toContainText("业务配置");
    await page.getByRole("link", { name: "查看详情" }).first().click();
    await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toContainText("产品总览");
    await expect(page.getByRole("link", { name: "风险边界", exact: true })).toBeVisible();
    await page.getByRole("link", { name: "风险边界", exact: true }).click();
    await expect(page.getByText("不能承诺事项")).toBeVisible();
  });

  test("OPERATOR 保持 5 个一级入口，V2.0.3 导航结构未被破坏", async ({ page }) => {
    await login(page, "platform-operator@zhengmu.local", "123456", "/app/zhengmu-platform/dashboard");

    await expect(primaryGroups(page)).toHaveCount(5);
    await expect(navGroup(page, "首页")).toBeVisible();
    await expect(navGroup(page, "客户管理")).toBeVisible();
    await expect(navGroup(page, "跟进工作台")).toBeVisible();
    await expect(navGroup(page, "Market Claw")).toBeVisible();
    await expect(navGroup(page, "业务配置")).toBeVisible();
    await expect(navGroup(page, "系统管理")).toHaveCount(0);

    await page.goto("/app/zhengmu-platform/market-claw");
    await expect(page.getByRole("link", { name: "知识库", exact: true }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "回复训练场", exact: true }).first()).toBeVisible();
  });

  test("SALES 路径更轻：Market Claw 只保留使用引导，客户管理和跟进工作台不暴露高权限入口", async ({ page }) => {
    await login(page, "platform-sales@zhengmu.local", "123456", "/app/zhengmu-platform/dashboard");

    await expect(primaryGroups(page)).toHaveCount(4);
    await expect(navGroup(page, "业务配置")).toHaveCount(0);
    await expect(navGroup(page, "系统管理")).toHaveCount(0);

    await page.goto("/app/zhengmu-platform/market-claw");
    await expect(page.getByText("Market Claw 不是 AI 客服，是懂业务的销售智能助手。")).toBeVisible();
    await expect(page.getByRole("link", { name: "知识库", exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "回复训练场", exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "去客户列表", exact: true }).first()).toBeVisible();
    await expect(page.getByText("在客户详情页中使用 Market Claw 生成回复")).toBeVisible();

    await page.goto("/app/zhengmu-platform/leads");
    await expect(page.getByRole("link", { name: "客户导入", exact: true })).toHaveCount(0);
    await expect(page.getByText("先从客户列表找到今天要跟进的客户")).toBeVisible();

    await page.goto("/app/zhengmu-platform/todos");
    await expect(page.getByRole("heading", { name: "跟进工作台", exact: true, level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: "今日待办", exact: true }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "逾期任务", exact: true }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "任务模板", exact: true })).toHaveCount(0);

    await page.goto(`/app/zhengmu-platform/leads/${ownLeadId}`);
    await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toContainText("客户详情");
    await expect(page.getByRole("heading", { name: "Market Claw 智能回复", exact: true })).toBeVisible();

    await page.goto("/app/zhengmu-platform/market-claw/knowledge");
    await expect(page).toHaveURL(/\/forbidden$/);
  });
});
