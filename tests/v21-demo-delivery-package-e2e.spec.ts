/*
 * 文件说明：该文件覆盖 V2.1 稳定测试环境与演示交付包的轻量回归验证。
 * 功能说明：验证高权限入口与低权限边界仍然正确，同时检查关键演示文档文件和 README 中的 V2.1 说明存在。
 *
 * 结构概览：
 *   第一部分：导入依赖与登录辅助函数
 *   第二部分：V2.1 轻量回归用例
 */
import fs from "fs";
import path from "path";
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

test.describe("V2.1 稳定测试环境与演示交付包", () => {
  test("TENANT_ADMIN 仍可看到初始化向导入口，并可访问 Market Claw 与训练复盘", async ({ page }) => {
    await login(page, "platform-boss@zhengmu.local", "123456", "/app/zhengmu-platform/dashboard");

    await expect(page.getByRole("heading", { name: "初始化向导" })).toBeVisible();
    await expect(page.getByRole("link", { name: "进入初始化向导" })).toBeVisible();

    await page.goto("/app/zhengmu-platform/market-claw");
    await expect(page.getByRole("heading", { name: "Market Claw", level: 1 })).toBeVisible();

    await page.goto("/app/zhengmu-platform/market-claw/insights");
    await expect(page.getByRole("heading", { name: "Market Claw 训练复盘", level: 1 })).toBeVisible();
  });

  test("SALES 仍不能看到高权限入口", async ({ page }) => {
    await login(page, "platform-sales@zhengmu.local", "123456", "/app/zhengmu-platform/dashboard");

    await expect(page.getByText("初始化向导")).toHaveCount(0);
    await expect(page.locator('[data-nav-group="系统管理"]')).toHaveCount(0);

    await page.goto("/app/zhengmu-platform/market-claw");
    await expect(page.getByRole("heading", { name: "Market Claw", level: 1 })).toBeVisible();
  });

  test("关键文档文件存在，README 包含 V2.1 演示交付说明", async () => {
    const projectRoot = process.cwd();
    const requiredFiles = [
      path.join(projectRoot, "custom/docs/local-demo-runbook.md"),
      path.join(projectRoot, "custom/docs/demo-script-role-paths.md"),
      path.join(projectRoot, "custom/docs/demo-script-market-claw.md"),
      path.join(projectRoot, "custom/docs/customer-pilot-onboarding-checklist.md"),
      path.join(projectRoot, "custom/docs/knowledge-materials-preparation-checklist.md"),
      path.join(projectRoot, "custom/docs/manual-acceptance-checklist.md"),
      path.join(projectRoot, "custom/docs/troubleshooting.md"),
      path.join(projectRoot, "custom/notes/v2.1-demo-environment-delivery-package.md")
    ];

    for (const filePath of requiredFiles) {
      expect(fs.existsSync(filePath), `${path.relative(projectRoot, filePath)} should exist`).toBeTruthy();
    }

    const readme = fs.readFileSync(path.join(projectRoot, "README.md"), "utf8");
    expect(readme).toContain("## V2.1 稳定测试环境与演示交付包");
    expect(readme).toContain("custom/docs/local-demo-runbook.md");
  });
});

