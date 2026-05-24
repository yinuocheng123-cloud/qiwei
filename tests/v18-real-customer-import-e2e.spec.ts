/*
 * 文件说明：该文件覆盖 V1.8 客户导入能力的浏览器端回归验证。
 * 功能说明：验证客户导入页面权限、模板下载、CSV 预览与确认导入、标签写入、首次任务生成、重复客户跳过和审计记录。
 *
 * 结构概览：
 *   第一部分：登录与测试数据辅助函数
 *   第二部分：V1.8 串行回归用例
 */
import { expect, test, type Download, type Page } from "@playwright/test";

const importLeadName = `导入客户${Date.now().toString().slice(-6)}`;
const importLeadPhone = `13977${Date.now().toString().slice(-6)}`;
const duplicateLeadPhone = "13988009019";
const csvContent = [
  "客户姓名,手机号,微信号,公司名称,客户类型,来源渠道,需求说明,意向等级,当前阶段,备注,业务线,标签,负责人邮箱,下次跟进时间",
  `${importLeadName},${importLeadPhone},import-wechat-${Date.now().toString().slice(-4)},导入测试公司,增长推广客户,会议活动,想了解 增长推广 服务报价和诊断,HIGH,NEW,来自 V1.8 Playwright,增长推广,"高意向，信任建设关注",platform-sales@zhengmu.local,2026-05-16 10:00`,
  `重复客户,${duplicateLeadPhone},,重复测试公司,重点客户,朋友圈,用于验证重复跳过,MEDIUM,NEW,重复数据,增长推广,重复标签,platform-sales@zhengmu.local,2026-05-16 11:00`
].join("\n");

async function login(page: Page, email: string, password = "123456") {
  await page.goto("/login");
  await page.getByLabel("邮箱").fill(email);
  await page.getByLabel("密码").fill(password);
  await page.getByRole("button", { name: "登录" }).click();
  await page.waitForURL(/\/(admin|app\/[^/]+\/dashboard)$/);
  await page.waitForLoadState("networkidle");
}

async function expectTemplateDownload(downloadPromise: Promise<Download>) {
  const download = await downloadPromise;
  const suggestedFilename = download.suggestedFilename();
  expect(suggestedFilename).toContain("lead-import-template.csv");
  const stream = await download.createReadStream();
  if (!stream) {
    throw new Error("模板下载流不存在。");
  }
  let content = "";
  for await (const chunk of stream) {
    content += chunk.toString();
  }
  expect(content).toContain("客户姓名");
  expect(content).toContain("负责人邮箱");
}

test.describe.serial("V1.8 真实客户导入", () => {
  test("TENANT_ADMIN 和 OPERATOR 可访问导入页，SALES 不可访问", async ({ page }) => {
    await login(page, "platform-boss@zhengmu.local");
    await page.goto("/app/zhengmu-platform/imports");
    await expect(page.getByRole("heading", { name: "客户导入" })).toBeVisible();
    await expect(page.getByRole("link", { name: "客户导入", exact: true })).toBeVisible();

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("link", { name: "下载导入模板" }).click();
    await expectTemplateDownload(downloadPromise);

    await page.goto("/logout");
    await login(page, "platform-operator@zhengmu.local");
    await page.goto("/app/zhengmu-platform/imports");
    await expect(page.getByRole("heading", { name: "客户导入" })).toBeVisible();

    await page.goto("/logout");
    await login(page, "platform-sales@zhengmu.local");
    await page.goto("/app/zhengmu-platform/imports");
    await expect(page).toHaveURL(/\/forbidden$/);
  });

  test("企业管理员可以上传预览并确认导入，导入后客户、标签、任务和审计链路生效", async ({ page }) => {
    await login(page, "platform-boss@zhengmu.local");
    await page.goto("/app/zhengmu-platform/imports");

    await page.getByLabel("或直接粘贴 CSV 内容").fill(csvContent);
    await page.getByRole("button", { name: "解析并生成预览" }).click();

    await expect(page.getByText(`当前批次：manual-input.csv`)).toBeVisible();
    const previewRow = page.getByRole("row", { name: new RegExp(importLeadName) });
    await expect(previewRow).toContainText(importLeadName);
    await expect(previewRow).toContainText("增长推广");
    await expect(previewRow).toContainText("高意向");
    await expect(previewRow).toContainText("信任建设关注");
    await expect(page.getByText("疑似重复")).toBeVisible();

    await page.getByRole("checkbox", { name: "导入后自动生成首次跟进任务" }).check();
    await page.getByRole("button", { name: "更新预览结果" }).click();
    await expect(page.getByText(`当前批次：manual-input.csv`)).toBeVisible();

    await page.getByRole("button", { name: "确认导入" }).click();
    const historyRow = page.getByRole("row", { name: /manual-input\.csv/ }).first();
    await expect(historyRow).toContainText("COMPLETED");
    await expect(historyRow).toContainText("1");

    await page.goto("/app/zhengmu-platform/leads");
    await expect(page.getByRole("link", { name: importLeadName })).toBeVisible();
    await page.getByRole("link", { name: importLeadName }).click();

    await expect(page.getByRole("heading", { name: importLeadName })).toBeVisible();
    const tagSection = page.getByRole("heading", { name: "标签", exact: true, level: 2 }).locator("..");
    await expect(tagSection).toContainText("高意向");
    await expect(tagSection).toContainText("信任建设关注");
    await expect(tagSection).toContainText("增长推广");
    const taskSection = page.getByRole("heading", { name: "当前任务", exact: true, level: 2 }).locator("..");
    await expect(taskSection).toContainText("首次跟进导入客户");

    await page.goto("/app/zhengmu-platform/audit-logs");
    await expect(page.getByText("import_batch_completed").first()).toBeVisible();
  });

  test("重复客户不会重复导入，导入记录可查看，zhengmu-demo 原有演示链路不被破坏", async ({ page }) => {
    await login(page, "platform-boss@zhengmu.local");
    await page.goto("/app/zhengmu-platform/imports");

    await expect(page.getByRole("heading", { name: "导入记录" })).toBeVisible();
    await expect(page.getByText("manual-input.csv").first()).toBeVisible();

    await page.goto("/app/zhengmu-platform/leads");
    await expect(page.getByRole("link", { name: "重复客户", exact: true })).toHaveCount(0);

    await page.goto("/app/zhengmu-demo/demo-guide");
    await expect(page).toHaveURL(/\/forbidden$/);

    await page.goto("/logout");
    await login(page, "boss@zhengmu.local");
    await page.goto("/app/zhengmu-demo/demo-guide");
    await expect(page.getByRole("heading", { name: "平台销售工作台演示说明" })).toBeVisible();
  });
});

