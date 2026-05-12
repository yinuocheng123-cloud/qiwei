/*
 * 文件说明：该文件覆盖 V1.3.1 任务去重、手动任务、任务模板和提醒队列的浏览器端 E2E。
 * 功能说明：验证管理员/运营模板权限、销售权限、任务去重、提醒队列审计和取消提醒。
 *
 * 结构概览：
 *   第一部分：导入依赖与登录工具
 *   第二部分：日期和表单定位工具
 *   第三部分：V1.3.1 串行业务流程
 */
import { expect, test, type Page } from "@playwright/test";

const stamp = Date.now();
const adminTemplateName = `V1.3.1 管理员模板 ${stamp}`;
const operatorTemplateName = `V1.3.1 运营模板 ${stamp}`;
const adminTemplateTaskTitle = `V1.3.1 模板任务 ${stamp}`;
const salesTaskTitle = `V1.3.1 销售手动任务 ${stamp}`;

async function login(page: Page, email: string, password = "123456") {
  await page.goto("/login");
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.locator("form button").click();
  await page.waitForURL(/\/(admin|app\/[^/]+\/dashboard)$/);
}

async function logout(page: Page) {
  await page.goto("/logout");
  await expect(page).toHaveURL(/\/login$/);
}

function futureDateTimeLocal(days = 10) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(10, 0, 0, 0);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function taskForm(page: Page) {
  return page.locator("form").filter({ has: page.locator('select[name="templateId"]') });
}

test.describe.serial("V1.3.1 任务模板与提醒队列", () => {
  test("企业管理员和运营可以创建任务模板，销售不能访问模板管理页", async ({ page }) => {
    await login(page, "boss@zhengmu.local");
    await page.goto("/app/zhengmu-demo/task-templates");
    await expect(page.getByRole("heading", { name: "任务模板" })).toBeVisible();
    await page.locator('input[name="name"]').first().fill(adminTemplateName);
    await page.locator('input[name="title"]').first().fill(adminTemplateTaskTitle);
    await page.locator('textarea[name="description"]').first().fill("用于 V1.3.1 模板创建任务和去重验证。");
    await page.locator('select[name="type"]').first().selectOption("PHONE_CALL");
    await page.locator('select[name="priority"]').first().selectOption("HIGH");
    await page.locator('input[name="defaultDueDays"]').first().fill("10");
    await page.getByRole("button", { name: "创建模板" }).click();
    await expect(page.getByText(adminTemplateName)).toBeVisible();
    await logout(page);

    await login(page, "operator@zhengmu.local");
    await page.goto("/app/zhengmu-demo/task-templates");
    await page.locator('input[name="name"]').first().fill(operatorTemplateName);
    await page.locator('input[name="title"]').first().fill(`运营模板任务 ${stamp}`);
    await page.locator('textarea[name="description"]').first().fill("运营创建任务模板验证。");
    await page.locator('select[name="type"]').first().selectOption("WECHAT_FOLLOW");
    await page.getByRole("button", { name: "创建模板" }).click();
    await expect(page.getByText(operatorTemplateName)).toBeVisible();
    await logout(page);

    await login(page, "sales@zhengmu.local");
    await page.goto("/app/zhengmu-demo/task-templates");
    await expect(page).toHaveURL(/\/forbidden$/);
    await logout(page);
  });

  test("企业管理员可以在客户详情页使用模板创建任务，重复创建会去重", async ({ page }) => {
    await login(page, "boss@zhengmu.local");
    await page.goto("/app/zhengmu-demo/leads/demo-lead-001");
    await expect(page.getByRole("heading", { name: /客户详情/ })).toBeVisible();

    const form = taskForm(page);
    const dueAt = futureDateTimeLocal(10);
    await form.locator('select[name="templateId"]').selectOption({ label: adminTemplateName });
    await form.locator('input[name="dueAt"]').fill(dueAt);
    await form.getByRole("button", { name: "创建任务" }).click();
    await expect(page.getByText("创建任务")).toBeVisible();

    await form.locator('select[name="templateId"]').selectOption({ label: adminTemplateName });
    await form.locator('input[name="dueAt"]').fill(dueAt);
    await form.getByRole("button", { name: "创建任务" }).click();

    await page.goto("/app/zhengmu-demo/todos?type=PHONE_CALL&status=PENDING");
    await expect(page.getByText(adminTemplateTaskTitle)).toHaveCount(1);
    await logout(page);
  });

  test("销售只能给自己的客户创建任务，不能进入其他租户客户", async ({ page }) => {
    await login(page, "sales@zhengmu.local");
    await page.goto("/app/zhengmu-demo/leads/demo-lead-001");
    await expect(page.getByRole("heading", { name: /客户详情/ })).toBeVisible();
    const form = taskForm(page);
    await form.locator('input[name="title"]').fill(salesTaskTitle);
    await form.locator('textarea[name="description"]').fill("销售给自己负责客户创建任务。");
    await form.locator('select[name="type"]').selectOption("CUSTOM");
    await form.locator('select[name="priority"]').selectOption("NORMAL");
    await form.locator('input[name="dueAt"]').fill(futureDateTimeLocal(11));
    await form.getByRole("button", { name: "创建任务" }).click();

    await page.goto("/app/zhengmu-demo/todos?type=CUSTOM&status=PENDING");
    await expect(page.getByText(salesTaskTitle)).toBeVisible();

    await page.goto("/app/isolation-demo/leads/isolation-lead-001");
    await expect(page).toHaveURL(/\/forbidden$/);
    await logout(page);
  });

  test("取消任务会取消未发送提醒队列，审计日志能看到关键动作", async ({ page }) => {
    await login(page, "sales@zhengmu.local");
    await page.goto("/app/zhengmu-demo/todos?type=CUSTOM&status=PENDING");
    const taskCard = page.locator("div").filter({ hasText: salesTaskTitle }).first();
    await expect(taskCard).toBeVisible();
    await taskCard.getByRole("button", { name: "取消" }).click();
    await logout(page);

    await login(page, "boss@zhengmu.local");
    await page.goto("/app/zhengmu-demo/audit-logs");
    await expect(page.getByText("task_template_created").first()).toBeVisible();
    await expect(page.getByText("task_template_used").first()).toBeVisible();
    await expect(page.getByText("task_manual_created").first()).toBeVisible();
    await expect(page.getByText("task_deduped_updated").first()).toBeVisible();
    await expect(page.getByText("reminder_created").first()).toBeVisible();
    await expect(page.getByText("reminder_cancelled").first()).toBeVisible();
  });
});
