/*
 * 文件说明：该文件覆盖 V1.7 业务线／产品管理的浏览器端回归验证。
 * 功能说明：验证业务线管理页权限、创建与暂停能力，以及智能标签建议对启用业务线配置的读取。
 *
 * 结构概览：
 *   第一部分：登录与页面定位辅助函数
 *   第二部分：V1.7 串行回归用例
 */
import { expect, test, type Locator, type Page } from "@playwright/test";

const createdBusinessLineSuffix = Date.now().toString().slice(-6);
const createdBusinessLineName = `测试业务线-${createdBusinessLineSuffix}`;
const createdBusinessLineSlug = `test-business-line-${createdBusinessLineSuffix}`;

async function login(page: Page, email: string, password = "123456") {
  await page.goto("/login");
  await page.getByLabel("邮箱").fill(email);
  await page.getByLabel("密码").fill(password);
  await page.getByRole("button", { name: "登录" }).click();
  await page.waitForURL(/\/(admin|app\/[^/]+\/dashboard)$/);
}

function businessLineCard(page: Page, name: string) {
  return page.locator("div.rounded-md.border.border-slate-200.bg-white").filter({
    has: page.getByRole("heading", { name })
  }).first();
}

function tagSuggestionPanel(page: Page) {
  return page.locator("div").filter({ has: page.getByRole("heading", { name: "智能标签建议" }) }).first();
}

async function generateSuggestions(page: Page, question: string) {
  await page.getByLabel("客户刚问了什么").fill(question);
  await page.getByRole("button", { name: "生成建议回复" }).click();
  await expect(page.getByText("直接型", { exact: true })).toBeVisible();
  await expect(page.getByText("温和型", { exact: true })).toBeVisible();
  await expect(page.getByText("专业型", { exact: true })).toBeVisible();
}

test.describe.serial("V1.7 业务线／产品管理", () => {
  test("企业管理员可以访问业务线页并新增、暂停业务线", async ({ page }) => {
    await login(page, "platform-boss@zhengmu.local");
    await page.goto("/app/zhengmu-platform/business-lines");

    await expect(page.getByRole("heading", { name: "业务线／产品管理" })).toBeVisible();
    await expect(businessLineCard(page, "会员服务")).toBeVisible();
    await expect(businessLineCard(page, "GEO／AI 推广")).toBeVisible();
    await expect(businessLineCard(page, "乌镇设计周")).toBeVisible();

    const createCard = page.locator("div.rounded-md.border.border-slate-200.bg-white").filter({
      has: page.getByRole("heading", { name: "新增业务线／产品" })
    }).first();

    await createCard.getByLabel("名称").fill(createdBusinessLineName);
    await createCard.getByLabel("Slug").fill(createdBusinessLineSlug);
    await createCard.getByLabel("业务线说明").fill("用于 Playwright 验证业务线新增、暂停和权限。");
    await createCard.getByLabel("默认下一步动作").fill("安排一次测试沟通");
    await createCard.getByLabel("优先级").fill("5");
    await createCard.getByLabel("推荐标签").fill("测试标签|业务标签");
    await createCard.locator('input[name="targetCustomerTypes"][value="PLATFORM_PARTNER_CLIENT"]').check();
    await createCard.getByRole("button", { name: "新增业务线" }).click();

    const createdCard = businessLineCard(page, createdBusinessLineName);
    await expect(createdCard).toBeVisible();
    await expect(createdCard.getByLabel("状态")).toHaveValue("ACTIVE");

    await createdCard.getByLabel("状态").selectOption("PAUSED");
    await createdCard.getByRole("button", { name: "保存业务线" }).click();
    await expect(createdCard.getByLabel("状态")).toHaveValue("PAUSED");
  });

  test("销售可以查看启用业务线但不能编辑，跨租户不能访问对方业务线", async ({ page }) => {
    await login(page, "platform-sales@zhengmu.local");
    await page.goto("/app/zhengmu-platform/business-lines");

    await expect(page.getByRole("heading", { name: "业务线／产品管理" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "会员服务" })).toBeVisible();
    await expect(page.getByText("新增业务线／产品")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "保存业务线" })).toHaveCount(0);
    await expect(page.getByText(createdBusinessLineName)).toHaveCount(0);

    await page.goto("/logout");
    await login(page, "boss@zhengmu.local");
    await page.goto("/app/zhengmu-demo/business-lines");
    await expect(page.getByRole("heading", { name: "业主整木定制" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "整木工厂增长服务" })).toBeVisible();

    await page.goto("/app/zhengmu-platform/business-lines");
    await expect(page).toHaveURL(/\/forbidden$/);
  });

  test("客户详情页智能标签建议可以读取启用业务线推荐标签", async ({ page }) => {
    await login(page, "platform-boss@zhengmu.local");
    await page.goto("/app/zhengmu-platform/leads/platform-lead-009");

    await expect(page.getByRole("heading", { name: "智能跟进助手" })).toBeVisible();
    await generateSuggestions(page, "你们 GEO 服务怎么做，能不能先做一次诊断？");

    const panel = tagSuggestionPanel(page);
    await expect(panel.getByText("GEO意向", { exact: true })).toBeVisible();
    await expect(panel.getByText("GEO方案待发", { exact: true })).toBeVisible();
  });
});
