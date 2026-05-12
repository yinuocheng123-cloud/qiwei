/*
 * 文件说明：该文件覆盖 V1.1.1 浏览器端 E2E 主流程。
 * 功能说明：验证平台登录、企业登录、公开表单、客户详情跟进、销售隔离和导出权限。
 *
 * 结构概览：
 *   第一部分：导入依赖与登录工具
 *   第二部分：平台与企业登录流程
 *   第三部分：公开表单与客户跟进流程
 *   第四部分：销售隔离与导出流程
 */
import { expect, test, type Page } from "@playwright/test";

async function login(page: Page, email: string, password = "123456") {
  await page.goto("/login");
  await page.getByLabel("邮箱").fill(email);
  await page.getByLabel("密码").fill(password);
  await page.getByRole("button", { name: "登录" }).click();
  await page.waitForURL(/\/(admin|app\/[^/]+\/dashboard)$/);
}

test("流程 A：平台管理员登录并进入平台总后台", async ({ page }) => {
  await login(page, "admin@growthhub.local");
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: "平台总后台" })).toBeVisible();
  await expect(page.getByText("整木样板企业")).toBeVisible();
});

test("流程 B：企业管理员登录并访问看板和客户列表", async ({ page }) => {
  await login(page, "boss@zhengmu.local");
  await expect(page).toHaveURL(/\/app\/zhengmu-demo\/dashboard$/);
  await expect(page.getByRole("heading", { name: /数据看板/ })).toBeVisible();
  await expect(page.getByText("今日新增客户")).toBeVisible();

  await page.getByRole("link", { name: "客户线索" }).click();
  await expect(page).toHaveURL(/\/app\/zhengmu-demo\/leads/);
  await expect(page.getByRole("heading", { name: "客户线索" })).toBeVisible();
});

test("流程 C/D：公开表单提交后，企业管理员可查看详情并新增跟进", async ({ page }) => {
  const leadName = `浏览器业主${Date.now()}`;

  await page.goto("/t/zhengmu-demo/diagnosis?source=douyin");
  await page.getByLabel("姓名").fill(leadName);
  await page.getByLabel("手机号").fill(`136${Date.now().toString().slice(-8)}`);
  await page.getByLabel("微信").fill("browser-owner");
  await page.getByLabel("公司").fill("浏览器测试客户");
  await page.getByLabel("行业").fill("整木高定");
  await page.getByLabel("城市").fill("杭州");
  await page.getByLabel("客户类型").selectOption("OWNER_CLIENT");
  await page.getByLabel("需求类型").selectOption("BOOK_CONSULTATION");
  await page.getByLabel("当前想解决的问题").fill("希望预约初步方案，并验证浏览器端表单提交。");
  await page.getByLabel("想尽快沟通").check();
  await page.getByRole("button", { name: "提交诊断" }).click();
  await expect(page).toHaveURL(/\/t\/zhengmu-demo\/thanks/);

  await login(page, "boss@zhengmu.local");
  await page.goto("/app/zhengmu-demo/leads");
  await page.getByRole("link", { name: leadName }).click();
  await expect(page.getByRole("heading", { name: new RegExp(`客户详情：${leadName}`) })).toBeVisible();
  await expect(page.getByText("推荐转化策略")).toBeVisible();
  await expect(page.getByText("推荐欢迎语")).toBeVisible();

  await page.getByLabel("跟进内容").fill("浏览器端新增跟进记录。");
  await page.getByLabel("下一步动作").fill("预约初步方案");
  await page.getByLabel("更新阶段").selectOption("CONTACTED");
  await page.getByLabel("下次跟进时间").fill("2027-01-02T09:30");
  await page.getByRole("button", { name: "保存跟进" }).click();
  await expect(page.getByText("浏览器端新增跟进记录。")).toBeVisible();
});

test("流程 E：销售只能访问自己负责的客户", async ({ page }) => {
  await login(page, "sales@zhengmu.local");
  await expect(page).toHaveURL(/\/app\/zhengmu-demo\/dashboard$/);
  await page.goto("/app/zhengmu-demo/leads");
  await expect(page.getByRole("heading", { name: "客户线索" })).toBeVisible();
  await expect(page.getByText("陈先生")).toBeVisible();
  await expect(page.getByText("王设计")).toHaveCount(0);

  await page.goto("/app/zhengmu-demo/leads/demo-lead-004");
  await expect(page).toHaveURL(/\/forbidden$/);
});

test("流程 F：企业管理员可导出，销售不能导出全量客户", async ({ page }) => {
  await login(page, "boss@zhengmu.local");
  await page.goto("/app/zhengmu-demo/export");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "下载 CSV" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain("zhengmu-demo");

  await page.goto("/logout");
  await login(page, "sales@zhengmu.local");
  await page.goto("/app/zhengmu-demo/export");
  await expect(page).toHaveURL(/\/forbidden$/);
});
