/*
 * 文件说明：该文件覆盖 V2.0.7 Market Claw 候选知识去重与合并体验优化的浏览器端验证。
 * 功能说明：验证相似提示、采纳新知识、合并到已有知识、重复驳回、知识来源展示、权限边界和审计日志。
 *
 * 结构概览：
 *   第一部分：登录与候选卡片辅助函数
 *   第二部分：V2.0.7 串行回归用例
 */
import { expect, test, type Locator, type Page } from "@playwright/test";

const suffix = Date.now().toString().slice(-6);
const baseQuestion = `V207 GEO 能不能保证推荐 ${suffix}`;
const similarQuestion = `V207 GEO 能不能保证推荐 边界 ${suffix}`;
const duplicateQuestion = `V207 GEO 能不能保证推荐 口径 ${suffix}`;
const baseAnswerMarker = `V207 基础口径 ${suffix}`;
const mergeAnswerMarker = `V207 合并补充 ${suffix}`;
const duplicateMarker = `V207 重复候选 ${suffix}`;

const baseIngestionTitle = `V207 基础知识 ${suffix}`;
const mergeIngestionTitle = `V207 合并候选 ${suffix}`;
const duplicateIngestionTitle = `V207 重复候选 ${suffix}`;
const targetKnowledgeTitle = `V207 合并目标 FAQ ${suffix}`;
const targetKnowledgeContent = `问题：${baseQuestion}\n回答：${baseAnswerMarker}。这是一条用于 V2.0.7 合并验证的专用目标知识。`;

const baseIngestionText = `
问：${baseQuestion}
答：${baseAnswerMarker}。GEO 方案不能承诺一定被 AI 推荐，但可以先梳理品牌内容底座、行业问答覆盖和推荐入口，再给出阶段性优化建议。
`.trim();

const mergeIngestionText = `
问：${similarQuestion}
答：${mergeAnswerMarker}。面对“能不能保证推荐”这类问题，建议继续强调不能承诺固定结果，同时补充影响可见性的业务线素材、案例基础和内容准备要求。
`.trim();

const duplicateIngestionText = `
问：${duplicateQuestion}
答：${duplicateMarker}。这条内容与已有风险边界口径接近，本轮不再重复新增独立知识条目。
`.trim();

async function login(page: Page, email: string, password = "123456", nextPath?: string) {
  const loginUrl = nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : "/login";
  await page.goto(loginUrl);
  await expect(page.getByLabel("邮箱")).toBeVisible({ timeout: 120_000 });
  await page.getByLabel("邮箱").fill(email);
  await page.getByLabel("密码").fill(password);
  await page.getByRole("button", { name: "登录" }).click();
  if (nextPath) {
    await page.waitForURL(new RegExp(`${nextPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
  } else {
    await page.waitForURL(/\/(admin|app\/[^/]+\/dashboard)$/);
  }
  await page.waitForLoadState("networkidle");
}

function candidateCard(page: Page, text: string) {
  return page
    .locator("div.rounded-md.border.border-slate-200.bg-white.p-5.shadow-sm")
    .filter({ has: page.getByRole("heading", { name: text, exact: true }) })
    .first();
}

function knowledgeCard(page: Page, text: string) {
  return page
    .getByRole("heading", { name: text, exact: true })
    .locator("xpath=ancestor::div[contains(@class,'bg-white') and contains(@class,'shadow-sm')][1]");
}

async function selectKnowledgeOptionByTitle(selectLocator: Locator, title: string) {
  const optionValue = await selectLocator.evaluate(
    (node, expectedTitle) => {
      const select = node as HTMLSelectElement;
      return (
        Array.from(select.options).find((option) => option.textContent?.includes(expectedTitle))?.value ?? ""
      );
    },
    title
  );

  expect(optionValue).not.toBe("");
  await selectLocator.selectOption(optionValue);
}

async function createMergeTargetKnowledge(page: Page) {
  await page.goto("/app/zhengmu-platform/market-claw/knowledge");
  await expect(page.getByRole("heading", { name: "Market Claw 知识库", level: 1 })).toBeVisible();

  const createForm = page.locator("form").filter({ has: page.getByRole("button", { name: "新增知识条目" }) }).first();
  await createForm.getByLabel("排序值").fill("1");
  await createForm.getByLabel("标题").fill(targetKnowledgeTitle);
  await createForm.getByLabel("正文").fill(targetKnowledgeContent);
  await createForm.locator('textarea[name="keywords"]').fill(`GEO\n保证推荐\n${suffix}`);
  await createForm.getByRole("button", { name: "新增知识条目" }).click();

  await expect(knowledgeCard(page, targetKnowledgeTitle)).toBeVisible();
}

test.describe.serial("V2.0.7 Market Claw：候选知识去重与合并体验优化", () => {
  test("TENANT_ADMIN 可采纳基础候选为新知识", async ({ page }) => {
    await login(page, "platform-boss@zhengmu.local", "123456", "/app/zhengmu-platform/market-claw/ingestion");

    await expect(page.getByRole("heading", { name: "Market Claw 资料投喂", level: 1 })).toBeVisible();
    await page.getByLabel("资料标题").fill(baseIngestionTitle);
    await page.getByLabel("文本粘贴区").fill(baseIngestionText);
    await page.getByRole("button", { name: "生成候选知识" }).click();

    const baseCard = candidateCard(page, `FAQ：${baseQuestion}`);
    await expect(baseCard.getByText("疑似相似知识")).toBeVisible();
    await baseCard.getByRole("button", { name: "采纳为新知识" }).click();
    await expect(baseCard.getByText("已关联知识条目")).toBeVisible();

    await page.goto("/app/zhengmu-platform/audit-logs?action=market_claw_knowledge_candidate_adopted");
    await expect(page.getByText("market_claw_knowledge_candidate_adopted").first()).toBeVisible();
  });

  test("TENANT_ADMIN 可看到相似提示并把候选合并到已有知识", async ({ page }) => {
    await login(page, "platform-boss@zhengmu.local", "123456", "/app/zhengmu-platform/market-claw/knowledge");
    await createMergeTargetKnowledge(page);

    await page.goto("/app/zhengmu-platform/market-claw/ingestion");

    await page.getByLabel("资料标题").fill(mergeIngestionTitle);
    await page.getByLabel("文本粘贴区").fill(mergeIngestionText);
    await page.getByRole("button", { name: "生成候选知识" }).click();

    const mergeCard = candidateCard(page, `FAQ：${similarQuestion}`);
    await expect(mergeCard.getByText("疑似相似知识")).toBeVisible();
    await expect(mergeCard.getByText(/相似度：/).first()).toBeVisible();

    const mergeTargetSelect = mergeCard.locator('select[name="targetKnowledgeItemId"]').first();
    await selectKnowledgeOptionByTitle(mergeTargetSelect, targetKnowledgeTitle);
    const manualMergeForm = mergeTargetSelect.locator("xpath=ancestor::form[1]");
    await manualMergeForm.locator('textarea[name="mergedContent"]').fill(`问题：${baseQuestion}\n回答：${baseAnswerMarker}。${mergeAnswerMarker}。`);
    await manualMergeForm.locator('textarea[name="mergeReason"]').fill("与已有 FAQ 口径高度相似，整合到同一条知识中。");
    await manualMergeForm.getByRole("button", { name: "确认合并/追加" }).click();
    await page.waitForLoadState("networkidle");
    await expect(candidateCard(page, `FAQ：${similarQuestion}`).getByText("已合并").first()).toBeVisible();
    await expect(candidateCard(page, `FAQ：${similarQuestion}`).getByText("已关联知识条目")).toBeVisible();

    await page.goto("/app/zhengmu-platform/market-claw/knowledge");
    const targetKnowledgeCard = knowledgeCard(page, targetKnowledgeTitle);
    await expect(targetKnowledgeCard).toBeVisible();
    await expect(targetKnowledgeCard.locator("p").filter({ hasText: baseAnswerMarker }).first()).toBeVisible();
    await expect(targetKnowledgeCard.locator("p").filter({ hasText: mergeAnswerMarker }).first()).toBeVisible();
    await expect(targetKnowledgeCard.getByText("是否来自资料投喂：是")).toBeVisible();
    await expect(targetKnowledgeCard.getByText("是否来自候选采纳：是")).toBeVisible();
    await expect(targetKnowledgeCard.getByText("是否由多候选合并：否")).toBeVisible();
    await expect(targetKnowledgeCard.getByText("来源候选数量：1")).toBeVisible();
    await expect(targetKnowledgeCard.getByText("最近合并时间：")).toBeVisible();

    await page.goto("/app/zhengmu-platform/audit-logs?action=market_claw_knowledge_candidate_merged");
    await expect(page.getByText("market_claw_knowledge_candidate_merged").first()).toBeVisible();
    await page.goto("/app/zhengmu-platform/audit-logs?action=market_claw_knowledge_source_updated");
    await expect(page.getByText("market_claw_knowledge_source_updated").first()).toBeVisible();
  });

  test("OPERATOR 可审核候选并标记重复驳回", async ({ page }) => {
    await login(page, "platform-operator@zhengmu.local", "123456", "/app/zhengmu-platform/market-claw/ingestion");

    await expect(page.getByRole("heading", { name: "Market Claw 资料投喂", level: 1 })).toBeVisible();
    await page.getByLabel("资料标题").fill(duplicateIngestionTitle);
    await page.getByLabel("文本粘贴区").fill(duplicateIngestionText);
    await page.getByRole("button", { name: "生成候选知识" }).click();

    const duplicateCard = candidateCard(page, `FAQ：${duplicateQuestion}`);
    await expect(duplicateCard.getByText("疑似相似知识")).toBeVisible();
    const duplicateRejectForm = duplicateCard.locator("form").filter({ hasText: "标记为重复并驳回" }).first();
    await duplicateRejectForm.locator('textarea[name="reviewComment"]').fill("与已有知识重复，保留单一知识入口。");
    await duplicateRejectForm.getByRole("button", { name: "重复驳回" }).click();

    await expect(duplicateCard.getByText("已驳回").first()).toBeVisible();
    await expect(duplicateCard.getByText("标记重复并驳回").first()).toBeVisible();

    await login(page, "platform-boss@zhengmu.local", "123456", "/app/zhengmu-platform/market-claw");
    await page.goto("/app/zhengmu-platform/audit-logs?action=market_claw_knowledge_candidate_rejected_as_duplicate");
    await expect(page.getByText("market_claw_knowledge_candidate_rejected_as_duplicate").first()).toBeVisible();
  });

  test("SALES 不显示资料投喂入口，直接访问仍被拒绝，原训练链路不受影响", async ({ page }) => {
    await login(page, "platform-sales@zhengmu.local", "123456", "/app/zhengmu-platform/market-claw");
    await expect(page.getByText("Market Claw 不是 AI 客服，是懂业务的销售智能助手。")).toBeVisible();
    await expect(page.getByRole("link", { name: "资料投喂", exact: true })).toHaveCount(0);

    await page.goto("/app/zhengmu-platform/market-claw/ingestion");
    await expect(page).toHaveURL(/\/forbidden$/);

    await page.goto("/app/zhengmu-platform/market-claw/training");
    await expect(page.getByRole("heading", { name: "Market Claw 我的训练" })).toBeVisible();
  });
});

