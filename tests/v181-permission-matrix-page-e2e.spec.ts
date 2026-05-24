/*
 * 文件说明：该文件覆盖 V1.8.1 权限矩阵说明页的浏览器端 E2E 验证。
 * 功能说明：验证企业管理员和运营可访问权限说明页，销售无入口且直接访问被拒绝，同时不破坏既有租户说明页链路。
 *
 * 结构概览：
 *   第一部分：登录与导航辅助函数
 *   第二部分：V1.8.1 串行回归用例
 */
import { expect, test, type Page } from "@playwright/test";

async function login(page: Page, email: string, password = "123456") {
  await page.goto("/login");
  await page.getByLabel("邮箱").fill(email);
  await page.getByLabel("密码").fill(password);
  await page.getByRole("button", { name: "登录" }).click();
  await page.waitForURL(/\/(admin|app\/[^/]+\/dashboard)$/);
}

function navLink(page: Page, name: string) {
  return page.getByRole("link", { name, exact: true });
}

test.describe.serial("V1.8.1 权限矩阵说明页", () => {
  test("TENANT_ADMIN 可访问 zhengmu-platform 权限矩阵说明页", async ({ page }) => {
    await login(page, "platform-boss@zhengmu.local");
    await page.goto("/app/zhengmu-platform/permissions");

    const roleOverview = page.locator("div.rounded-md.border.border-slate-200.bg-slate-50");

    await expect(page.getByRole("heading", { name: "权限矩阵", exact: true })).toBeVisible();
    await expect(page.getByText("老板看全局")).toBeVisible();
    await expect(page.getByText("运营管资产")).toBeVisible();
    await expect(page.getByText("销售做跟进")).toBeVisible();
    await expect(roleOverview.filter({ hasText: "PLATFORM_ADMIN" }).first()).toBeVisible();
    await expect(roleOverview.filter({ hasText: "TENANT_ADMIN" }).first()).toBeVisible();
    await expect(roleOverview.filter({ hasText: "OPERATOR" }).first()).toBeVisible();
    await expect(roleOverview.filter({ hasText: "SALES" }).first()).toBeVisible();
    await expect(page.getByText("业务线不做物理删除")).toBeVisible();
    await expect(navLink(page, "权限说明")).toBeVisible();
  });

  test("OPERATOR 可只读访问权限矩阵说明页", async ({ page }) => {
    await login(page, "platform-operator@zhengmu.local");
    await page.goto("/app/zhengmu-platform/permissions");

    await expect(page.getByRole("heading", { name: "权限矩阵", exact: true })).toBeVisible();
    await expect(page.getByText("企业管理员决定做不做，运营负责怎么做，销售负责跟客户。")).toBeVisible();
    await expect(page.getByText("客户导出要严格控制")).toBeVisible();
    await expect(navLink(page, "权限说明")).toBeVisible();
  });

  test("SALES 不显示权限说明入口，直接访问会被拒绝，zhengmu-demo 说明页不受影响", async ({ page }) => {
    await login(page, "platform-sales@zhengmu.local");
    await page.goto("/app/zhengmu-platform/dashboard");

    await expect(navLink(page, "权限说明")).toHaveCount(0);

    await page.goto("/app/zhengmu-platform/permissions");
    await expect(page).toHaveURL(/\/forbidden$/);

    await page.goto("/logout");
    await login(page, "boss@zhengmu.local");
    await page.goto("/app/zhengmu-demo/demo-guide");
    await expect(page.getByRole("heading", { name: "MarketClaw 销售助手平台说明" })).toBeVisible();
  });
});

