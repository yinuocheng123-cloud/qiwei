/*
 * 文件说明：该文件覆盖 V1.2 业务可用增强版的浏览器端 E2E 测试。
 * 功能说明：验证客户分配、销售待办、销售隔离、资料包权限、客户详情推荐和审计日志写入。
 *
 * 结构概览：
 *   第一部分：导入依赖与通用工具
 *   第二部分：V1.2 串行业务流程
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

function todayDateTimeLocal() {
  const date = new Date();
  date.setHours(10, 0, 0, 0);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

async function selectSalesOwner(page: Page) {
  const value = await page.locator('select[name="ownerId"] option').evaluateAll((options) => {
    return options.find((option) => option.textContent?.includes("SALES"))?.getAttribute("value") ?? "";
  });
  expect(value).not.toBe("");
  await page.locator('select[name="ownerId"]').selectOption(value);
}

test.describe.serial("V1.2 业务可用增强版", () => {
  test("企业管理员可以给客户分配销售，并能在详情页看到推荐资料和话术", async ({ page }) => {
    await login(page, "boss@zhengmu.local");
    await page.goto("/app/zhengmu-demo/leads");
    await page.locator('a[href="/app/zhengmu-demo/leads/demo-lead-005"]').click();
    await expect(page.getByRole("heading", { name: /客户详情/ })).toBeVisible();
    await expect(page.getByText("客户分配")).toBeVisible();
    await expect(page.getByText("绑定资料包")).toBeVisible();
    await expect(page.getByText("推荐欢迎语")).toBeVisible();
    await expect(page.getByText("推荐下一步动作", { exact: true })).toBeVisible();

    await selectSalesOwner(page);
    await page.getByRole("button", { name: "保存分配" }).click();
    await expect(page.locator('select[name="ownerId"]')).toHaveValue(/.+/);
    await logout(page);
  });

  test("销售只能看到自己负责的客户，并可在待办和详情页新增跟进", async ({ page }) => {
    await login(page, "sales@zhengmu.local");
    await page.goto("/app/zhengmu-demo/leads");
    await expect(page.locator('a[href="/app/zhengmu-demo/leads/demo-lead-005"]').first()).toBeVisible();
    await expect(page.locator('a[href="/app/zhengmu-demo/leads/demo-lead-004"]')).toHaveCount(0);

    await page.goto("/app/zhengmu-demo/leads/demo-lead-004");
    await expect(page).toHaveURL(/\/forbidden$/);

    await page.goto("/app/zhengmu-demo/leads");
    await page.locator('a[href="/app/zhengmu-demo/leads/demo-lead-005"]').click();
    await page.getByLabel("跟进内容").fill("V1.2 销售跟进验证：确认项目资料并约定今日复盘。");
    await page.getByLabel("下一步动作").fill("V1.2 继续推进项目合作");
    await page.getByLabel("更新阶段").selectOption("CONTACTED");
    await page.getByLabel("下次跟进时间").fill(todayDateTimeLocal());
    await page.getByRole("button", { name: "保存跟进" }).click();
    await expect(page.getByText("V1.2 销售跟进验证")).toBeVisible();

    await page.goto("/app/zhengmu-demo/todos");
    await expect(page.getByRole("heading", { name: "销售工作台" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "今日任务" })).toBeVisible();
    await expect(page.locator('a[href="/app/zhengmu-demo/leads/demo-lead-005"]').first()).toBeVisible();
    await logout(page);
  });

  test("销售不能编辑资料包，运营人员可以编辑资料包", async ({ page }) => {
    await login(page, "sales@zhengmu.local");
    await page.goto("/app/zhengmu-demo/materials");
    await expect(page).toHaveURL(/\/forbidden$/);
    await logout(page);

    await login(page, "operator@zhengmu.local");
    await page.goto("/app/zhengmu-demo/materials");
    await expect(page.getByRole("heading", { name: "资料包管理" })).toBeVisible();

    const editForm = page.locator("form").nth(1);
    const title = `V1.2 资料包编辑验证 ${Date.now()}`;
    await editForm.locator('input[name="title"]').fill(title);
    await editForm.locator('textarea[name="description"]').fill("运营人员编辑资料包，用于验证资料包绑定与 AuditLog 写入。");
    await editForm.getByRole("button", { name: "保存资料包" }).click();
    await expect(page.getByText(title)).toBeVisible();
    await logout(page);
  });

  test("企业管理员可以查看审计日志，并看到分配、跟进和资料包编辑动作", async ({ page }) => {
    await login(page, "boss@zhengmu.local");
    await page.goto("/app/zhengmu-demo/audit-logs");
    await expect(page.getByRole("heading", { name: "审计日志" })).toBeVisible();
    await expect(page.getByText("lead_owner_assigned").first()).toBeVisible();
    await expect(page.getByText("followup_created").first()).toBeVisible();
    await expect(page.getByText("material_updated").first()).toBeVisible();
  });
});
