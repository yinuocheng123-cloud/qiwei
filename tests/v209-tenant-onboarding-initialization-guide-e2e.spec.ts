/*
 * 文件说明：该文件覆盖 V2.0.9 企业开通与初始化向导的浏览器端验证。
 * 功能说明：验证初始化向导入口、七步结构、角色权限边界和关键跳转入口可见性。
 *
 * 结构概览：
 *   第一部分：登录辅助函数
 *   第二部分：V2.0.9 回归用例
 */
import { expect, test, type Page } from "@playwright/test";

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

test.describe("V2.0.9 企业开通与初始化向导", () => {
  test("TENANT_ADMIN 可访问初始化向导并看到七个步骤", async ({ page }) => {
    await login(page, "platform-boss@zhengmu.local", "123456", "/app/zhengmu-platform/dashboard");

    await expect(page.getByRole("heading", { name: "初始化向导" })).toBeVisible();
    await page.getByRole("link", { name: "进入初始化向导" }).click();

    await expect(page.getByRole("heading", { name: "初始化向导", level: 1 })).toBeVisible();
    await expect(page.locator("#step-1").getByRole("heading", { name: "企业基础信息" })).toBeVisible();
    await expect(page.locator("#step-2").getByRole("heading", { name: "企业发展阶段判断" })).toBeVisible();
    await expect(page.locator("#step-3").getByRole("heading", { name: "业务线初始化" })).toBeVisible();
    await expect(page.locator("#step-4").getByRole("heading", { name: "客户数据准备" })).toBeVisible();
    await expect(page.locator("#step-5").getByRole("heading", { name: "Market Claw 资料投喂准备" })).toBeVisible();
    await expect(page.locator("#step-6").getByRole("heading", { name: "销售使用准备" })).toBeVisible();
    await expect(page.locator("#step-7").getByRole("heading", { name: "上线检查清单" })).toBeVisible();
    await expect(page.locator("#step-2").getByText("当前建议阶段")).toBeVisible();
    await expect(page.locator("#step-2").getByText("推荐初始化路径")).toBeVisible();
  });

  test("OPERATOR 可访问初始化向导并看到关键建议区块", async ({ page }) => {
    await login(page, "platform-operator@zhengmu.local", "123456", "/app/zhengmu-platform/onboarding");

    await expect(page.getByRole("heading", { name: "初始化向导", level: 1 })).toBeVisible();
    await expect(page.locator("#step-2").getByRole("heading", { name: "企业发展阶段判断" })).toBeVisible();
    await expect(page.locator("#step-3").getByRole("heading", { name: "业务线初始化" })).toBeVisible();
    await expect(page.locator("#step-4").getByRole("heading", { name: "客户数据准备" })).toBeVisible();
    await expect(page.locator("#step-5").getByRole("heading", { name: "Market Claw 资料投喂准备" })).toBeVisible();
    await expect(page.locator("#step-6").getByRole("heading", { name: "销售使用准备" })).toBeVisible();
    await expect(page.locator("#step-7").getByRole("heading", { name: "上线检查清单" })).toBeVisible();
  });

  test("SALES 不显示初始化向导入口，直接访问被拒绝", async ({ page }) => {
    await login(page, "platform-sales@zhengmu.local", "123456", "/app/zhengmu-platform/dashboard");

    await expect(page.getByText("初始化向导")).toHaveCount(0);
    await page.goto("/app/zhengmu-platform/onboarding");
    await expect(page).toHaveURL(/\/forbidden$/);
  });

  test("初始化向导显示关键跳转入口，现有 Market Claw 与业务配置页面不受影响", async ({ page }) => {
    await login(page, "platform-boss@zhengmu.local", "123456", "/app/zhengmu-platform/onboarding");

    await expect(page.getByRole("link", { name: "去业务配置" })).toBeVisible();
    await expect(page.getByRole("link", { name: "去客户导入" })).toBeVisible();
    await expect(page.getByRole("link", { name: "去资料投喂" })).toBeVisible();
    await expect(page.getByRole("link", { name: "去跟进工作台" })).toBeVisible();
    await expect(page.getByRole("link", { name: "去训练复盘" }).first()).toBeVisible();

    await page.goto("/app/zhengmu-platform/market-claw");
    await expect(page.getByRole("heading", { name: "Market Claw", level: 1 })).toBeVisible();

    await page.goto("/app/zhengmu-platform/business-lines");
    await expect(page.getByRole("heading", { name: "业务配置", level: 1 })).toBeVisible();
  });
});
