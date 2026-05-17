/*
 * 文件说明：该文件覆盖 V2.0.8 Market Claw 训练复盘与知识治理的浏览器端验证。
 * 功能说明：验证训练复盘入口、管理侧治理视图、销售个人视图，以及既有训练/投喂/审核链路未被破坏。
 *
 * 结构概览：
 *   第一部分：登录辅助函数
 *   第二部分：V2.0.8 回归用例
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

test.describe("V2.0.8 Market Claw：训练复盘与知识治理", () => {
  test("TENANT_ADMIN 可访问训练复盘并看到完整治理区块", async ({ page }) => {
    await login(page, "platform-boss@zhengmu.local", "123456", "/app/zhengmu-platform/market-claw");

    await expect(page.getByText("训练复盘").first()).toBeVisible();
    await page.goto("/app/zhengmu-platform/market-claw/insights");

    await expect(page.getByRole("heading", { name: "Market Claw 训练复盘", level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "总览指标" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "高频客户问题" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "风险问题复盘" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "知识缺口提醒" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "采纳与合并复盘" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "企业阶段适配建议" })).toBeVisible();
    await expect(page.getByText("当前知识成熟度阶段")).toBeVisible();

    await expect(page.getByText("整木工厂")).toHaveCount(0);
    await expect(page.getByText("乌镇资源")).toHaveCount(0);
    await expect(page.getByText("会员服务")).toHaveCount(0);
  });

  test("OPERATOR 可访问训练复盘", async ({ page }) => {
    await login(page, "platform-operator@zhengmu.local", "123456", "/app/zhengmu-platform/market-claw/insights");

    await expect(page.getByRole("heading", { name: "Market Claw 训练复盘", level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "总览指标" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "高频客户问题" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "知识缺口提醒" })).toBeVisible();
  });

  test("SALES 只能看到个人训练表现，不显示全局治理数据", async ({ page }) => {
    await login(page, "platform-sales@zhengmu.local", "123456", "/app/zhengmu-platform/market-claw");

    await expect(page.getByText("我的训练表现").first()).toBeVisible();
    await page.goto("/app/zhengmu-platform/market-claw/insights");

    await expect(page.getByRole("heading", { name: "Market Claw 我的训练表现", level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "总览指标" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "我的高频客户问题" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "我的训练采纳情况" })).toBeVisible();
    await expect(page.getByText("知识缺口提醒")).toHaveCount(0);
    await expect(page.getByText("采纳与合并复盘")).toHaveCount(0);
    await expect(page.getByText("企业阶段适配建议")).toHaveCount(0);
    await expect(page.getByText("高价值话术贡献")).toHaveCount(0);
  });

  test("V2.0.5 / V2.0.6 / V2.0.7 既有链路入口仍可访问", async ({ page }) => {
    await login(page, "platform-boss@zhengmu.local", "123456", "/app/zhengmu-platform/market-claw/insights");

    await page.goto("/app/zhengmu-platform/market-claw/training");
    await expect(page.getByRole("heading", { name: "Market Claw 回复训练场", level: 1 })).toBeVisible();

    await page.goto("/app/zhengmu-platform/market-claw/ingestion");
    await expect(page.getByRole("heading", { name: "Market Claw 资料投喂", level: 1 })).toBeVisible();

    await page.goto("/app/zhengmu-platform/market-claw/training/review");
    await expect(page.getByRole("heading", { name: "Market Claw 训练审核", level: 1 })).toBeVisible();
  });
});
