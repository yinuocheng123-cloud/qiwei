/*
 * 文件说明：该文件覆盖 V2.6 企业微信轻承接 MVP 的 smoke 测试。
 * 功能说明：验证管理员可打开轻承接测试台、模拟导入 CNAS 客户、写入来源归因并生成跟进任务，同时确认销售不可访问该配置入口。
 *
 * 结构概览：
 *   第一部分：登录辅助函数
 *   第二部分：企微轻承接主流程测试
 */
import { expect, test, type Page } from "@playwright/test";

const suffix = Date.now().toString().slice(-6);
const wecomLeadName = `企微CNAS客户${suffix}`;
const wecomLeadPhone = `13866${suffix}`;

async function login(page: Page, email: string, password = "123456") {
  await page.goto("/login");
  await page.getByLabel("邮箱").fill(email);
  await page.getByLabel("密码").fill(password);
  await page.getByRole("button", { name: "登录" }).click();
  await page.waitForURL(/\/(admin|app\/[^/]+\/dashboard)$/);
  await page.waitForLoadState("networkidle");
}

test.describe("V2.6 企业微信轻承接 MVP", () => {
  test("TENANT_ADMIN 可以模拟导入 CNAS 企微客户并进入跟进流程", async ({ page }) => {
    await login(page, "platform-boss@zhengmu.local");
    await page.goto("/app/zhengmu-platform/wecom/light-intake");

    await expect(page.getByRole("heading", { name: "企业微信轻承接测试台" })).toBeVisible();
    await expect(page.getByText("不做聊天同步")).toBeVisible();
    await expect(page.getByText("CNAS 模板字段")).toBeVisible();

    await page.getByLabel("客户姓名").fill(wecomLeadName);
    await page.getByLabel("手机号").fill(wecomLeadPhone);
    await page.getByLabel("企业/实验室名称").fill(`CNAS企微实验室${suffix}`);
    await page.getByLabel("企微外部联系人 ID（模拟）").fill(`wm-cnas-${suffix}`);
    await page.getByLabel("来源二维码").fill(`qr-cnas-${suffix}`);
    await page.getByLabel("备注").fill("来自 V2.6 企业微信轻承接 smoke。");
    await page.getByRole("button", { name: "模拟导入企微客户" }).click();

    await page.waitForURL(/\/app\/zhengmu-platform\/leads\//);
    await expect(page.getByRole("heading", { name: new RegExp(wecomLeadName) })).toBeVisible();
    await expect(page.getByRole("heading", { name: "来源归因", exact: true })).toBeVisible();
    await expect(page.getByText("企业微信轻承接", { exact: true })).toBeVisible();
    await expect(page.getByText("CNAS 初步判断", { exact: true })).toBeVisible();
    await expect(page.locator("span").filter({ hasText: /^CNAS内容培育跟进$/ })).toBeVisible();
  });

  test("SALES 不可访问企业微信轻承接测试台", async ({ page }) => {
    await login(page, "platform-sales@zhengmu.local");
    await page.goto("/app/zhengmu-platform/wecom/light-intake");
    await expect(page).toHaveURL(/\/forbidden$/);
  });
});
