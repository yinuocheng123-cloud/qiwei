/*
 * 文件说明：该文件覆盖 V2.1.7 Market Claw AI 测试沙盒与专家视角调用的浏览器端回归验证。
 * 功能说明：验证管理员访问、沙盒入口、MOCK 结构化建议、风险分级展示、训练草稿保存和销售权限拒绝。
 *
 * 结构概览：
 *   第一部分：导入依赖与登录辅助函数
 *   第二部分：V2.1.7 页面与权限测试
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

test.describe("V2.1.7 Market Claw AI 测试沙盒", () => {
  test("TENANT_ADMIN 可访问 AI 测试沙盒并使用 MOCK 生成结构化建议", async ({ page }) => {
    await login(page, "boss@zhengmu.local");
    await page.goto("/app/zhengmu-demo/market-claw");
    await expect(page.locator('a[href="/app/zhengmu-demo/market-claw/sandbox"]').first()).toBeVisible();
    await page.goto("/app/zhengmu-demo/market-claw/sandbox");
    await expect(page).toHaveURL(/\/app\/zhengmu-demo\/market-claw\/sandbox$/);

    await expect(page.getByText("AI 输出只是建议")).toBeVisible();
    await expect(page.getByText("客户回复仍需销售确认")).toBeVisible();
    await expect(page.locator('textarea[name="customerQuestion"]')).toBeVisible();
    await expect(page.locator('select[name="businessLineId"]')).toBeVisible();
    await expect(page.locator('select[name="agentId"]')).toBeVisible();
    await expect(page.locator('select[name="provider"]')).toBeVisible();

    const providerValues = await page.locator('select[name="provider"] option').evaluateAll((options) =>
      options.map((option) => (option as HTMLOptionElement).value)
    );
    expect(providerValues).toEqual(expect.arrayContaining(["DEEPSEEK", "DOUBAO", "OPENAI_COMPATIBLE", "MOCK"]));

    const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const question = `V217 沙盒测试问题 ${uniqueSuffix}：你们价格最低是多少，多久能见效？`;
    await page.locator('textarea[name="customerQuestion"]').fill(question);
    await page.locator('select[name="agentId"]').selectOption("comprehensive_advisor");
    await page.getByRole("button", { name: "MOCK 测试" }).click();

    await expect(page.getByText("MOCK 结构化建议已生成，可继续保存为训练样本草稿。")).toBeVisible();
    await expect(page.getByText("综合建议", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("风险边界确认（HIGH）")).toBeVisible();
    await expect(page.getByText("风险边界确认后使用（RISK_CONFIRM_REQUIRED）")).toBeVisible();

    await page.getByRole("button", { name: "保存为训练样本草稿" }).click();
    await expect(page.getByText("已保存为训练样本草稿")).toBeVisible();

    await page.goto("/app/zhengmu-demo/market-claw/training");
    const createdTrainingCaseTitle = page.locator("h2").filter({ hasText: question });
    await expect(createdTrainingCaseTitle).toHaveCount(1);
    await expect(createdTrainingCaseTitle.first()).toBeVisible();

    await page.goto("/app/zhengmu-demo/market-claw/knowledge");
    await expect(page.getByText(question, { exact: true })).toHaveCount(0);
  });

  test("BLOCKED 问题只显示内部建议，原有 Market Claw 页面仍可访问", async ({ page }) => {
    await login(page, "boss@zhengmu.local");

    for (const pathName of [
      "/app/zhengmu-demo/market-claw",
      "/app/zhengmu-demo/market-claw/ingestion",
      "/app/zhengmu-demo/market-claw/training",
      "/app/zhengmu-demo/market-claw/replies"
    ]) {
      const response = await page.goto(pathName);
      expect(response?.status()).toBeLessThan(400);
    }

    await page.goto("/app/zhengmu-demo/market-claw/sandbox");
    await page.locator('textarea[name="customerQuestion"]').fill("你们能不能保证效果，一定能成功吗？");
    await page.locator('select[name="agentId"]').selectOption("risk_boundary_guardian");
    await page.getByRole("button", { name: "MOCK 测试" }).click();

    await expect(page.getByText("仅内部建议（BLOCKED）")).toBeVisible();
    await expect(page.getByText("INTERNAL_ADVICE_ONLY")).toBeVisible();
    await expect(page.getByText("当前问题只能作为内部建议，不建议直接发给客户。")).toBeVisible();
  });

  test("SALES 不显示沙盒入口，直接访问会被拒绝", async ({ page }) => {
    await login(page, "sales@zhengmu.local");
    await page.goto("/app/zhengmu-demo/market-claw");
    await expect(page.locator('a[href="/app/zhengmu-demo/market-claw/sandbox"]')).toHaveCount(0);

    await page.goto("/app/zhengmu-demo/market-claw/sandbox");
    await expect(page).toHaveURL(/\/forbidden$/);
  });
});

