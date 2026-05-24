/*
 * 文件说明：该文件覆盖 V1.5.1 智能标签建议的浏览器端 E2E 验证。
 * 功能说明：验证标签建议生成、人工确认写入、重复写入去重、权限边界与审计日志。
 *
 * 结构概览：
 *   第一部分：登录与辅助定位函数
 *   第二部分：V1.5.1 串行回归用例
 */
import { expect, test, type Locator, type Page } from "@playwright/test";

async function login(page: Page, email: string, password = "123456") {
  await page.goto("/login");
  await page.getByLabel("邮箱").fill(email);
  await page.getByLabel("密码").fill(password);
  await page.getByRole("button", { name: "登录" }).click();
  await page.waitForURL(/\/(admin|app\/[^/]+\/dashboard)$/);
}

function tagSuggestionPanel(page: Page) {
  return page.locator("div").filter({ has: page.getByRole("heading", { name: "智能标签建议" }) }).first();
}

function leadTagList(page: Page) {
  return page.getByRole("heading", { name: "标签" }).locator("xpath=following-sibling::div[1]");
}

function suggestionCards(page: Page) {
  return page.locator("div.rounded-md.border.border-slate-200.p-4").filter({
    has: page.getByRole("heading", { name: /^(直接型|温和型|专业型)$/ })
  });
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

test.describe.serial("V1.5.1 智能标签建议", () => {
  test("企业管理员可以生成标签建议，并看到价格类标签", async ({ page }) => {
    await login(page, "boss@zhengmu.local");
    await page.goto("/app/zhengmu-demo/leads/demo-lead-001");

    await expect(page.getByRole("heading", { name: "智能跟进助手" })).toBeVisible();
    await generateSuggestions(page, "现在报价大概多少钱，贵不贵？");
    await expect(suggestionCards(page)).toHaveCount(3);

    const panel = tagSuggestionPanel(page);
    await expect(panel.getByRole("heading", { name: "智能标签建议" })).toBeVisible();
    await expect(panel.getByText("价格关注", { exact: true })).toBeVisible();
    await expect(panel.getByText("报价待跟进", { exact: true })).toBeVisible();
    await expect(tagItem(panel, "价格关注").getByText("推荐强度：高")).toBeVisible();
  });

  test("企业管理员可以生成 GEO 类标签建议并确认添加，且不会重复添加", async ({ page }) => {
    await login(page, "boss@zhengmu.local");
    await page.goto("/app/zhengmu-demo/leads/demo-lead-009");

    await generateSuggestions(page, "你们这个 GEO 和 AI 搜索推荐具体怎么做，能先诊断吗？");
    const panel = tagSuggestionPanel(page);
    await expect(panel.getByText("内容增长意向", { exact: true })).toBeVisible();
    await expect(panel.getByText("AI推广关注", { exact: true })).toBeVisible();

    const geoTag = tagItem(panel, "内容增长意向");
    const aiTag = tagItem(panel, "AI推广关注");
    await geoTag.locator('input[type="checkbox"]').check();
    await aiTag.locator('input[type="checkbox"]').check();

    const tagList = leadTagList(page);
    const geoCountBefore = await leadTagChip(tagList, "内容增长意向").count();

    await panel.getByRole("button", { name: "确认添加标签" }).click();
    await expect(leadTagChip(tagList, "内容增长意向")).toHaveCount(1);
    await expect(leadTagChip(tagList, "AI推广关注")).toHaveCount(1);

    const geoCountAfterFirstConfirm = await leadTagChip(tagList, "内容增长意向").count();
    expect(geoCountAfterFirstConfirm).toBeGreaterThan(geoCountBefore);

    await panel.getByRole("button", { name: "确认添加标签" }).click();
    const geoCountAfterSecondConfirm = await leadTagChip(tagList, "内容增长意向").count();
    expect(geoCountAfterSecondConfirm).toBe(geoCountAfterFirstConfirm);

    await page.goto("/app/zhengmu-demo/audit-logs");
    await expect(page.getByText("reply_tag_confirmed").first()).toBeVisible();
  });

  test("销售可以为自己负责客户生成并确认标签，但不能给非自己负责客户确认标签", async ({ page }) => {
    await login(page, "sales@zhengmu.local");
    await page.goto("/app/zhengmu-demo/leads/demo-lead-002");

    await expect(page.getByRole("heading", { name: "智能跟进助手" })).toBeVisible();
    await generateSuggestions(page, "有没有案例可以先看看，后面再聊价格。");

    const panel = tagSuggestionPanel(page);
    await expect(panel.getByText("案例关注", { exact: true })).toBeVisible();
    await panel.getByRole("button", { name: "确认添加标签" }).click();
    await expect(panel.getByText("案例关注", { exact: true })).toBeVisible();

    await page.goto("/app/zhengmu-demo/leads/demo-lead-004");
    await expect(page).toHaveURL(/\/forbidden$/);
  });

  test("不同租户不能访问或确认对方客户的推荐标签", async ({ page }) => {
    await login(page, "boss@zhengmu.local");
    await page.goto("/app/isolation-demo/leads/isolation-lead-001");
    await expect(page).toHaveURL(/\/forbidden$/);
  });
});

