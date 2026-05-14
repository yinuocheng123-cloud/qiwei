/*
 * 文件说明：该文件覆盖 V1.6 中华整木网自用业务工作台的浏览器端 E2E 验证。
 * 功能说明：验证 zhengmu-platform 租户的登录、看板、客户详情、demo-guide 兼容，以及智能跟进助手和智能标签建议可用。
 *
 * 结构概览：
 *   第一部分：登录与定位辅助函数
 *   第二部分：V1.6 串行回归用例
 */
import { expect, test, type Locator, type Page } from "@playwright/test";

async function login(page: Page, email: string, password = "123456") {
  await page.goto("/login");
  await page.getByLabel("邮箱").fill(email);
  await page.getByLabel("密码").fill(password);
  await page.getByRole("button", { name: "登录" }).click();
  await page.waitForURL(/\/(admin|app\/[^/]+\/dashboard)$/);
}

function suggestionCards(page: Page) {
  return page.locator("div.rounded-md.border.border-slate-200.p-4").filter({
    has: page.getByRole("heading", { name: /^(直接型|温和型|专业型)$/ })
  });
}

function tagSuggestionPanel(page: Page) {
  return page.locator("div").filter({ has: page.getByRole("heading", { name: "智能标签建议" }) }).first();
}

function leadTagList(page: Page) {
  return page.getByRole("heading", { name: "标签" }).locator("xpath=following-sibling::div[1]");
}

function tagItem(panel: Locator, tagName: string) {
  return panel.locator("label").filter({ hasText: tagName }).first();
}

function leadTagChip(list: Locator, tagName: string) {
  return list.locator("span.rounded-md").filter({ hasText: new RegExp(`^${tagName}$`) });
}

async function generateSuggestions(page: Page, question: string) {
  await page.getByLabel("客户刚问了什么").fill(question);
  await page.getByRole("button", { name: "生成建议回复" }).click();
  await expect(page.getByText("直接型", { exact: true })).toBeVisible();
  await expect(page.getByText("温和型", { exact: true })).toBeVisible();
  await expect(page.getByText("专业型", { exact: true })).toBeVisible();
}

test.describe.serial("V1.6 中华整木网自用业务工作台", () => {
  test("platform-boss 可以访问 zhengmu-platform 的 dashboard、客户列表和客户详情", async ({ page }) => {
    await login(page, "platform-boss@zhengmu.local");
    await expect(page).toHaveURL(/\/app\/zhengmu-platform\/dashboard$/);
    await expect(page.getByText("今日新增客户")).toBeVisible();
    await expect(page.getByText("销售跟进概览")).toBeVisible();
    await expect(page.getByText("客户类型分布")).toBeVisible();

    await page.goto("/app/zhengmu-platform/leads");
    await expect(page.getByRole("heading", { name: "客户线索" })).toBeVisible();
    await expect(page.locator('a[href="/app/zhengmu-platform/leads/platform-lead-001"]')).toBeVisible();
    await expect(page.locator('a[href="/app/zhengmu-platform/leads/platform-lead-009"]')).toBeVisible();

    await page.goto("/app/zhengmu-platform/leads/platform-lead-001");
    await expect(page.getByRole("link", { name: /整木企业增长诊断表/ }).first()).toBeVisible();
    await expect(page.getByText("当前任务")).toBeVisible();
  });

  test("demo-guide 会按租户显示不同说明，platform-sales 可以访问自己的 todos", async ({ page }) => {
    await login(page, "platform-boss@zhengmu.local");

    await page.goto("/app/zhengmu-platform/demo-guide");
    await expect(page.getByRole("heading", { name: "中华整木网自用说明" })).toBeVisible();
    await expect(page.getByText("这是整木网自己的业务工作台，不是对外客户样板。")).toBeVisible();
    await expect(page.getByText("会员、GEO／AI 推广、乌镇、培训、集采、一清一护、品牌增信和联盟合作")).toBeVisible();

    await page.goto("/logout");
    await login(page, "boss@zhengmu.local");
    await page.goto("/app/zhengmu-demo/demo-guide");
    await expect(page.getByRole("heading", { name: "整木行业演示说明" })).toBeVisible();
    await expect(page.getByText("客户从哪里来，系统知道；")).toBeVisible();

    await page.goto("/logout");
    await login(page, "platform-sales@zhengmu.local");
    await page.goto("/app/zhengmu-platform/todos");
    await expect(page.getByRole("heading", { name: "今日任务" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "逾期任务" })).toBeVisible();
  });

  test("zhengmu-platform 客户详情页可以生成智能跟进建议并确认标签", async ({ page }) => {
    await login(page, "platform-boss@zhengmu.local");
    await page.goto("/app/zhengmu-platform/leads/platform-lead-009");

    await expect(page.getByRole("heading", { name: "智能跟进助手" })).toBeVisible();
    await generateSuggestions(page, "你们这个 GEO 和 AI 搜索推荐具体怎么做，能先诊断吗？");
    await expect(suggestionCards(page)).toHaveCount(3);
    await expect(suggestionCards(page).first().getByText("推荐资料")).toBeVisible();
    await expect(suggestionCards(page).first().getByText("下一步动作")).toBeVisible();

    const panel = tagSuggestionPanel(page);
    await expect(panel.getByText("GEO意向", { exact: true })).toBeVisible();
    await expect(panel.getByText("AI推广关注", { exact: true })).toBeVisible();

    const geoTag = tagItem(panel, "GEO意向");
    await geoTag.locator('input[type="checkbox"]').check();
    await panel.getByRole("button", { name: "确认添加标签" }).click();

    const tagList = leadTagList(page);
    await expect(leadTagChip(tagList, "GEO意向")).toHaveCount(1);

    await page.goto("/app/zhengmu-platform/audit-logs");
    await expect(page.getByText("reply_tag_confirmed").first()).toBeVisible();
  });
});
