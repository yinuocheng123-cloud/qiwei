/*
 * 文件说明：该文件覆盖 V1.5 智能跟进助手的浏览器端 E2E 验证。
 * 功能说明：验证建议回复生成、权限边界、保存为跟进记录和审计日志写入。
 *
 * 结构概览：
 *   第一部分：导入依赖与登录工具
 *   第二部分：V1.5 串行回归用例
 */
import { expect, test, type Page } from "@playwright/test";

async function login(page: Page, email: string, password = "123456") {
  await page.goto("/login");
  await page.getByLabel("邮箱").fill(email);
  await page.getByLabel("密码").fill(password);
  await page.getByRole("button", { name: "登录" }).click();
  await page.waitForURL(/\/(admin|app\/[^/]+\/dashboard)$/);
}

function suggestionCards(page: Page) {
  return page.locator("div.rounded-md.border.border-slate-200.p-4");
}

function suggestionCardByStyle(page: Page, style: string) {
  return suggestionCards(page).filter({ has: page.getByText(style, { exact: true }) }).first();
}

async function generateSuggestions(page: Page, question: string) {
  await page.getByLabel("客户刚问了什么").fill(question);
  await page.getByRole("button", { name: "生成建议回复" }).click();
  await expect(page.getByText("直接型", { exact: true })).toBeVisible();
  await expect(page.getByText("温和型", { exact: true })).toBeVisible();
  await expect(page.getByText("专业型", { exact: true })).toBeVisible();
}

test.describe.serial("V1.5 智能跟进助手", () => {
  test("企业管理员可以生成三条建议回复，包含推荐资料与下一步动作，并可保存为跟进记录", async ({ page }) => {
    await login(page, "boss@zhengmu.local");
    await page.goto("/app/zhengmu-demo/leads/demo-lead-001");

    await expect(page.getByRole("heading", { name: "智能跟进助手" })).toBeVisible();
    await generateSuggestions(page, "现在大概多少钱，贵不贵？");
    await expect(suggestionCards(page)).toHaveCount(3);

    const directCard = suggestionCardByStyle(page, "直接型");
    await expect(directCard.getByText("推荐资料")).toBeVisible();
    await expect(directCard.getByText("下一步动作")).toBeVisible();
    await expect(directCard.getByText("注意事项")).toBeVisible();
    await expect(directCard.getByText("整木定制避坑清单")).toBeVisible();

    const followUpCards = page.locator("div.rounded-md.border.border-slate-200.p-3").filter({ has: page.getByText("下一步：") });
    const followUpCountBefore = await followUpCards.count();
    await directCard.getByRole("button", { name: "保存为跟进记录" }).click();
    await expect(followUpCards).toHaveCount(followUpCountBefore + 1);

    await page.goto("/app/zhengmu-demo/audit-logs");
    await expect(page.getByText("reply_suggestion_generated").first()).toBeVisible();
    await expect(page.getByText("reply_suggestion_saved_as_followup").first()).toBeVisible();
  });

  test("销售可以为自己负责的客户生成建议回复", async ({ page }) => {
    await login(page, "sales@zhengmu.local");
    await page.goto("/app/zhengmu-demo/leads/demo-lead-002");

    await expect(page.getByRole("heading", { name: "智能跟进助手" })).toBeVisible();
    await generateSuggestions(page, "有没有案例可以先看看？");
    await expect(suggestionCards(page)).toHaveCount(3);
    await expect(suggestionCardByStyle(page, "直接型").getByText("推荐资料")).toBeVisible();
  });

  test("销售不能为非自己负责客户生成建议，且不同租户仍然隔离", async ({ page }) => {
    await login(page, "sales@zhengmu.local");

    await page.goto("/app/zhengmu-demo/leads/demo-lead-004");
    await expect(page).toHaveURL(/\/forbidden$/);

    await page.goto("/app/isolation-demo/leads/isolation-lead-001");
    await expect(page).toHaveURL(/\/forbidden$/);
  });
});

