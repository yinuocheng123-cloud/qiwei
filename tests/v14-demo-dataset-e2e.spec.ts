/*
 * 文件说明：该文件覆盖 V1.4 整木行业演示样板数据的浏览器端验证。
 * 功能说明：验证整木样板企业的看板、客户详情和销售工作台可以直接用于对外演示。
 *
 * 结构概览：
 *   第一部分：导入依赖与登录工具
 *   第二部分：整木样板企业演示路径验证
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

test.describe.serial("V1.4 整木行业演示样板数据", () => {
  test("企业管理员可以在看板和客户详情看到完整演示信息", async ({ page }) => {
    await login(page, "boss@zhengmu.local");
    await page.goto("/app/zhengmu-demo/dashboard");
    await expect(page.getByRole("heading", { name: /数据看板/ })).toBeVisible();
    await expect(page.getByText("客户类型分布")).toBeVisible();
    await expect(page.getByText("来源分布")).toBeVisible();
    await expect(page.getByText("阶段分布")).toBeVisible();
    await expect(page.getByText("业主客户")).toBeVisible();
    await expect(page.getByText("工厂客户")).toBeVisible();
    await expect(page.getByText("销售跟进概览")).toBeVisible();

    await page.goto("/app/zhengmu-demo/leads/demo-lead-001");
    await expect(page.getByRole("heading", { name: /客户详情：陈先生/ })).toBeVisible();
    await expect(page.getByText("推荐转化策略")).toBeVisible();
    await expect(page.getByText("绑定资料包")).toBeVisible();
    await expect(page.getByText("销售跟进记录")).toBeVisible();
    await expect(page.getByText("当前任务")).toBeVisible();
    await expect(page.getByRole("heading", { name: "创建任务" })).toBeVisible();
    await expect(page.getByRole("link", { name: /整木定制避坑清单/ })).toBeVisible();
    await expect(page.getByText("业主首次沟通：陈先生")).toBeVisible();
    await expect(page.locator('select[name="templateId"]')).toContainText("首次沟通");
    await logout(page);
  });

  test("销售工作台可以看到多类客户任务和完整任务分组", async ({ page }) => {
    await login(page, "sales@zhengmu.local");
    await page.goto("/app/zhengmu-demo/todos");
    await expect(page.getByRole("heading", { name: "销售工作台" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "今日任务" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "逾期任务" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "高优先级任务" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "本周待跟进" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "已完成任务" })).toBeVisible();

    await expect(page.getByText("业主首次沟通：陈先生").first()).toBeVisible();
    await expect(page.getByText("发送招商资料：周总").first()).toBeVisible();
    await expect(page.getByText("发送案例图册：许设计").first()).toBeVisible();
    await expect(page.getByText("发送增长诊断表：宋总").first()).toBeVisible();

    await expect(page.getByText("客户类型：业主客户").first()).toBeVisible();
    await expect(page.getByText("客户类型：经销商客户").first()).toBeVisible();
    await expect(page.getByText("客户类型：设计师客户").first()).toBeVisible();
    await expect(page.getByText("客户类型：工厂客户").first()).toBeVisible();
  });
});
