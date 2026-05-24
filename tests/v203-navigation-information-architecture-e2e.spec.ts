/*
 * 文件说明：该文件覆盖 V2.0.3 导航与信息架构收口的浏览器端 E2E 验证。
 * 功能说明：验证一级导航收口、角色化导航、客户管理归类、业务配置入口、Market Claw 入口和高权限页面拒绝是否符合预期。
 *
 * 结构概览：
 *   第一部分：登录与导航辅助函数
 *   第二部分：V2.0.3 信息架构专项用例
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

test.describe.serial("V2.0.3 导航与信息架构收口", () => {
  test("TENANT_ADMIN 看到不超过 6 个一级分组，并能进入客户管理、业务配置和 Market Claw", async ({ page }) => {
    await login(page, "platform-boss@zhengmu.local", "123456", "/app/zhengmu-platform/dashboard");

    await expect(primaryGroups(page)).toHaveCount(6);
    await expect(navGroup(page, "首页")).toBeVisible();
    await expect(navGroup(page, "客户管理")).toBeVisible();
    await expect(navGroup(page, "跟进工作台")).toBeVisible();
    await expect(navGroup(page, "Market Claw")).toBeVisible();
    await expect(navGroup(page, "业务配置")).toBeVisible();
    await expect(navGroup(page, "系统管理")).toBeVisible();

    await page.goto("/app/zhengmu-platform/leads");
    await expect(page.getByRole("heading", { name: "客户管理", exact: true, level: 1 })).toBeVisible();
    await expect(page.locator("#source-attribution").getByRole("heading", { name: "来源归因", exact: true })).toBeVisible();

    await page.goto("/app/zhengmu-platform/imports");
    await expect(page.getByRole("heading", { name: "客户导入" })).toBeVisible();

    await page.goto("/app/zhengmu-platform/business-lines");
    await expect(page.getByRole("heading", { name: "业务配置", exact: true, level: 1 })).toBeVisible();
    await expect(page.locator("#product-overview").getByRole("heading", { name: "产品总览", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "查看详情" }).first()).toBeVisible();

    await page.goto("/app/zhengmu-platform/market-claw");
    await expect(page.getByRole("heading", { name: "Market Claw", exact: true, level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Market Claw 总览", exact: true })).toBeVisible();

    await page.goto("/app/zhengmu-platform/communication-compliance");
    await expect(page.getByRole("heading", { name: "沟通素材合规采集配置" })).toBeVisible();

    await page.goto("/forms/cnas-path-check");
    await expect(page.getByRole("heading", { name: "CNAS认可路径判断问卷" })).toBeVisible();

    await page.goto("/logout");
    await login(page, "boss@zhengmu.local", "123456", "/app/zhengmu-demo/demo-guide");
    await expect(page.getByRole("heading", { name: "MarketClaw 销售助手平台说明", exact: true, level: 1 })).toBeVisible();
  });

  test("OPERATOR 看到 5 个一级分组，保留业务配置和 Market Claw，但不显示系统管理", async ({ page }) => {
    await login(page, "platform-operator@zhengmu.local", "123456", "/app/zhengmu-platform/dashboard");

    await expect(primaryGroups(page)).toHaveCount(5);
    await expect(navGroup(page, "首页")).toBeVisible();
    await expect(navGroup(page, "客户管理")).toBeVisible();
    await expect(navGroup(page, "跟进工作台")).toBeVisible();
    await expect(navGroup(page, "Market Claw")).toBeVisible();
    await expect(navGroup(page, "业务配置")).toBeVisible();
    await expect(navGroup(page, "系统管理")).toHaveCount(0);

    await expect(page.getByRole("link", { name: "客户导入", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "合规配置", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "企微配置", exact: true })).toHaveCount(0);

    await page.goto("/app/zhengmu-platform/market-claw");
    await expect(page.getByRole("heading", { name: "Market Claw", exact: true, level: 1 })).toBeVisible();
    await expect(page.locator("main").getByRole("link", { name: "知识库", exact: true }).first()).toBeVisible();

    await page.goto("/app/zhengmu-platform/business-lines");
    await expect(page.getByRole("heading", { name: "业务配置", exact: true, level: 1 })).toBeVisible();
    await expect(page.locator("#product-overview").getByRole("heading", { name: "产品总览", exact: true })).toBeVisible();
  });

  test("SALES 只看到 4 个一级分组，仍可进入自己的客户详情使用 Market Claw，高权限页面继续被拒绝", async ({ page }) => {
    await login(page, "platform-sales@zhengmu.local", "123456", "/app/zhengmu-platform/dashboard");

    await expect(primaryGroups(page)).toHaveCount(4);
    await expect(navGroup(page, "首页")).toBeVisible();
    await expect(navGroup(page, "客户管理")).toBeVisible();
    await expect(navGroup(page, "跟进工作台")).toBeVisible();
    await expect(navGroup(page, "Market Claw")).toBeVisible();
    await expect(navGroup(page, "业务配置")).toHaveCount(0);
    await expect(navGroup(page, "系统管理")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "客户导入", exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "知识库", exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "回复训练场", exact: true })).toHaveCount(0);

    await page.goto(`/app/zhengmu-platform/leads/${ownLeadId}`);
    await expect(page.getByRole("heading", { name: "Market Claw 智能回复", exact: true })).toBeVisible();

    await page.goto("/app/zhengmu-platform/market-claw");
    await expect(page.getByRole("heading", { name: "Market Claw", exact: true, level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: "我的回复记录" })).toBeVisible();

    await page.goto("/app/zhengmu-platform/market-claw/replies");
    await expect(page.getByRole("heading", { name: "Market Claw 回复记录" })).toBeVisible();

    await page.goto("/app/zhengmu-platform/imports");
    await expect(page).toHaveURL(/\/forbidden$/);

    await page.goto("/app/zhengmu-platform/permissions");
    await expect(page).toHaveURL(/\/forbidden$/);

    await page.goto("/app/zhengmu-platform/market-claw/knowledge");
    await expect(page).toHaveURL(/\/forbidden$/);
  });
});

