/*
 * 文件说明：该文件覆盖 V1.3 任务驱动工作台的浏览器端 E2E 测试。
 * 功能说明：验证批量操作、任务可见范围、任务完成、团队概览、租户审计和平台审计权限。
 *
 * 结构概览：
 *   第一部分：导入依赖与登录工具
 *   第二部分：V1.3 串行业务流程
 */
import { expect, test, type Page } from "@playwright/test";

async function login(page: Page, email: string, password = "123456") {
  await page.goto("/login");
  await page.getByLabel("邮箱").fill(email);
  await page.getByLabel("密码").fill(password);
  await page.getByRole("button", { name: "登录" }).click();
  await page.waitForURL(/\/(admin|app\/[^/]+\/dashboard)$/);
}

async function logout(page: Page) {
  await page.goto("/logout");
  await expect(page).toHaveURL(/\/login$/);
}

async function selectBulkLead(page: Page, leadId: string) {
  const checkbox = page.locator(`input[name="leadIds"][value="${leadId}"]`);
  await expect(checkbox).toBeVisible();
  await checkbox.check();
}

async function selectSalesOwnerInBulkForm(page: Page) {
  const bulkForm = page.locator("form").nth(1);
  const value = await bulkForm.locator('select[name="ownerId"] option').evaluateAll((options) => {
    return options.find((option) => option.textContent?.includes("SALES"))?.getAttribute("value") ?? "";
  });
  expect(value).not.toBe("");
  await bulkForm.locator('select[name="ownerId"]').selectOption(value);
}

test.describe.serial("V1.3 任务驱动工作台", () => {
  test("企业管理员可以批量分配客户并批量更新阶段", async ({ page }) => {
    await login(page, "boss@zhengmu.local");
    await page.getByRole("link", { name: "客户线索" }).click();
    await expect(page.getByRole("heading", { name: "客户线索" })).toBeVisible();
    const bulkForm = page.locator("form").nth(1);

    await selectBulkLead(page, "demo-lead-004");
    await bulkForm.locator('select[name="bulkAction"]').selectOption("assign");
    await selectSalesOwnerInBulkForm(page);
    await bulkForm.getByRole("button", { name: "执行批量操作" }).click();
    await expect(page.locator('a[href="/app/zhengmu-demo/leads/demo-lead-004"]')).toBeVisible();

    await selectBulkLead(page, "demo-lead-004");
    await bulkForm.locator('select[name="bulkAction"]').selectOption("stage");
    await bulkForm.locator('select[name="stage"]').selectOption("QUOTED");
    await bulkForm.getByRole("button", { name: "执行批量操作" }).click();
    const updatedRow = page.locator("tbody tr").filter({ has: page.locator('a[href="/app/zhengmu-demo/leads/demo-lead-004"]') });
    await expect(updatedRow.getByText("已报价")).toBeVisible();
    await logout(page);
  });

  test("销售只能看到自己的任务，并可以完成任务", async ({ page }) => {
    await login(page, "sales@zhengmu.local");
    await page.goto("/app/zhengmu-demo/todos");
    await expect(page.getByRole("heading", { name: "销售工作台" })).toBeVisible();
    await expect(page.locator('a[href="/app/zhengmu-demo/leads/demo-lead-004"]').first()).toBeVisible();
    await expect(page.locator('a[href="/app/zhengmu-demo/leads/demo-lead-005"]')).toHaveCount(0);
    await page.getByRole("button", { name: "标记完成" }).first().click();
    await expect(page.getByRole("heading", { name: "已完成任务" })).toBeVisible();
    await logout(page);
  });

  test("企业管理员能看到团队任务概览和批量操作审计日志", async ({ page }) => {
    await login(page, "boss@zhengmu.local");
    await page.goto("/app/zhengmu-demo/dashboard");
    await expect(page.getByText("销售跟进概览")).toBeVisible();
    await expect(page.getByText("今日任务").first()).toBeVisible();
    await expect(page.getByText("已完成任务").first()).toBeVisible();

    await page.goto("/app/zhengmu-demo/audit-logs");
    await expect(page.getByText("lead_bulk_assigned")).toBeVisible();
    await expect(page.getByText("lead_bulk_stage_updated")).toBeVisible();
    await expect(page.getByText("task_completed")).toBeVisible();
    await logout(page);
  });

  test("平台管理员可访问平台审计日志，企业管理员不可访问", async ({ page }) => {
    await login(page, "admin@growthhub.local");
    await page.goto("/admin/audit-logs");
    await expect(page.getByRole("heading", { name: "平台审计日志" })).toBeVisible();
    await expect(page.getByText("lead_bulk_assigned")).toBeVisible();
    await logout(page);

    await login(page, "boss@zhengmu.local");
    await page.goto("/admin/audit-logs");
    await expect(page).toHaveURL(/\/forbidden$/);
  });
});
