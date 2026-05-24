/*
 * 文件说明：该文件覆盖 V1.7.1 角色化导航与权限收口的浏览器端回归验证。
 * 功能说明：验证不同角色看到的菜单、可访问入口、业务线读写边界和角色化演示说明是否符合预期。
 *
 * 结构概览：
 *   第一部分：登录、导航和业务线辅助函数
 *   第二部分：V1.7.1 串行回归用例
 */
import { expect, test, type Page } from "@playwright/test";

const createdBusinessLineSuffix = Date.now().toString().slice(-6);
const createdBusinessLineName = `角色权限测试业务线-${createdBusinessLineSuffix}`;
const createdBusinessLineSlug = `role-nav-line-${createdBusinessLineSuffix}`;

let forgedPauseFormPayload: Record<string, string> | null = null;

async function login(page: Page, email: string, password = "123456") {
  await page.goto("/login");
  await page.getByLabel("邮箱").fill(email);
  await page.getByLabel("密码").fill(password);
  await page.getByRole("button", { name: "登录" }).click();
  await page.waitForURL(/\/(admin|app\/[^/]+\/dashboard)$/);
}

function navLink(page: Page, name: string) {
  return page.getByRole("link", { name, exact: true });
}

function businessLineCard(page: Page, name: string) {
  return page.locator("div.rounded-md.border.border-slate-200.bg-white").filter({
    has: page.getByRole("heading", { name })
  }).first();
}

async function expectLinksVisible(page: Page, labels: string[]) {
  for (const label of labels) {
    await expect(navLink(page, label)).toBeVisible();
  }
}

async function expectLinksHidden(page: Page, labels: string[]) {
  for (const label of labels) {
    await expect(navLink(page, label)).toHaveCount(0);
  }
}

async function capturePauseFormPayload(page: Page, businessLineName: string) {
  const form = businessLineCard(page, businessLineName)
    .getByRole("button", { name: "暂停" })
    .locator("xpath=ancestor::form[1]");

  await expect(form).toBeVisible();

  return form.locator("input").evaluateAll((nodes) =>
    Object.fromEntries(
      nodes
        .map((node) => [node.getAttribute("name"), (node as HTMLInputElement).value] as const)
        .filter((entry): entry is [string, string] => Boolean(entry[0]))
    )
  );
}

test.describe.serial("V1.7.1 角色化导航与权限收口", () => {
  test("TENANT_ADMIN 可以看到完整企业后台导航，并可新增业务线", async ({ page }) => {
    await login(page, "platform-boss@zhengmu.local");
    await page.goto("/app/zhengmu-platform/dashboard");

    await expectLinksVisible(page, ["Dashboard", "客户列表", "业务线／产品", "销售工作台", "资料包", "策略库", "任务模板", "审计日志", "演示说明", "客户导出", "企业微信配置"]);
    await page.goto("/app/zhengmu-platform/demo-guide");
    await expect(page.getByText("老板／企业管理员视角")).toBeVisible();
    await expect(page.getByText("重点看客户从哪里来、哪些业务线在跑、哪些客户高意向。")).toBeVisible();

    await page.goto("/app/zhengmu-platform/business-lines");
    const createCard = page.locator("div.rounded-md.border.border-slate-200.bg-white").filter({
      has: page.getByRole("heading", { name: "新增业务线／产品" })
    }).first();

    await createCard.getByLabel("名称").fill(createdBusinessLineName);
    await createCard.getByLabel("Slug").fill(createdBusinessLineSlug);
    await createCard.getByLabel("业务线说明").fill("用于验证 V1.7.1 菜单、权限和业务线状态收口。");
    await createCard.getByLabel("默认下一步动作").fill("安排一次角色化权限检查");
    await createCard.getByLabel("优先级").fill("8");
    await createCard.locator('select[name="status"]').selectOption("ACTIVE");
    await createCard.getByLabel("推荐标签").fill("角色权限关注|业务标签");
    await createCard.locator('input[name="targetCustomerTypes"][value="FACTORY_CLIENT"]').check();
    await createCard.getByRole("button", { name: "新增业务线" }).click();

    const createdCard = businessLineCard(page, createdBusinessLineName);
    await expect(createdCard).toBeVisible();
    await expect(createdCard.getByRole("button", { name: "归档" })).toBeVisible();

    forgedPauseFormPayload = await capturePauseFormPayload(page, createdBusinessLineName);
  });

  test("OPERATOR 只看到业务资产入口，访问高风险平台入口会被拒绝", async ({ page }) => {
    await login(page, "platform-operator@zhengmu.local");
    await page.goto("/app/zhengmu-platform/dashboard");

    await expectLinksVisible(page, ["Dashboard", "客户列表", "业务线／产品", "销售工作台", "资料包", "策略库", "任务模板", "演示说明"]);
    await expectLinksHidden(page, ["审计日志", "客户导出", "企业微信配置"]);

    await page.goto("/app/zhengmu-platform/demo-guide");
    await expect(page.getByText("运营视角")).toBeVisible();
    await expect(page.getByText("重点维护业务线、资料包、策略库和任务模板，让顾问拿到一致的跟进资产。")).toBeVisible();

    await page.goto("/app/zhengmu-platform/audit-logs");
    await expect(page).toHaveURL(/\/forbidden$/);

    await page.goto("/admin/audit-logs");
    await expect(page).toHaveURL(/\/forbidden$/);
  });

  test("SALES 只看到日常跟进入口，能访问自己的任务和客户详情", async ({ page }) => {
    await login(page, "platform-sales@zhengmu.local");
    await page.goto("/app/zhengmu-platform/dashboard");

    await expectLinksVisible(page, ["Dashboard", "我的客户", "销售工作台", "演示说明"]);
    await expectLinksHidden(page, ["业务线编辑", "资料包", "策略库", "任务模板", "审计日志", "客户导出", "企业微信配置"]);

    await page.goto("/app/zhengmu-platform/demo-guide");
    await expect(page.getByText("销售视角")).toBeVisible();
    await expect(page.getByText("每天先看销售工作台和自己负责的客户，明确今天该跟谁。")).toBeVisible();

    await page.goto("/app/zhengmu-platform/todos");
    await expect(page.getByRole("heading", { name: "今日任务" })).toBeVisible();

    await page.goto("/app/zhengmu-platform/leads");
    const firstLeadLink = page.locator('a[href^="/app/zhengmu-platform/leads/"]').first();
    await expect(firstLeadLink).toBeVisible();
    const href = await firstLeadLink.getAttribute("href");
    if (!href) {
      throw new Error("未找到销售可访问的客户详情链接。");
    }
    await firstLeadLink.click();
    await expect(page).toHaveURL(new RegExp(`${href.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`));
    await expect(page.getByRole("heading", { name: "智能跟进助手" })).toBeVisible();

    await page.goto("/app/zhengmu-platform/audit-logs");
    await expect(page).toHaveURL(/\/forbidden$/);

    await page.goto("/admin/audit-logs");
    await expect(page).toHaveURL(/\/forbidden$/);
  });

  test("SALES 直接访问业务线页时只能看到 ACTIVE 业务线，且无法伪造暂停请求", async ({ page }) => {
    await login(page, "platform-sales@zhengmu.local");
    await page.goto("/app/zhengmu-platform/business-lines");

    await expect(page.getByRole("heading", { name: "业务线／产品管理" })).toBeVisible();
    await expect(page.getByText("销售仅查看启用中的业务线推荐")).toBeVisible();
    await expect(page.getByText("新增业务线／产品")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "保存业务线" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "暂停" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "归档" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: createdBusinessLineName })).toBeVisible();

    if (!forgedPauseFormPayload) {
      throw new Error("未捕获到业务线状态表单 payload。");
    }

    const response = await page.context().request.post("/app/zhengmu-platform/business-lines", {
      form: forgedPauseFormPayload
    });
    expect([200, 303]).toContain(response.status());

    await page.goto("/app/zhengmu-platform/business-lines");
    await expect(page.getByRole("heading", { name: createdBusinessLineName })).toBeVisible();
  });

  test("TENANT_ADMIN 可以暂停业务线，暂停后 SALES 不再看到该业务线", async ({ page }) => {
    await login(page, "platform-boss@zhengmu.local");
    await page.goto("/app/zhengmu-platform/business-lines");

    const createdCard = businessLineCard(page, createdBusinessLineName);
    await expect(createdCard).toBeVisible();
    await createdCard.getByRole("button", { name: "暂停" }).click();
    await page.goto("/app/zhengmu-platform/business-lines");
    const pausedCard = businessLineCard(page, createdBusinessLineName);
    await expect(pausedCard.locator('select[name="status"]').first()).toHaveValue("PAUSED");

    await page.goto("/logout");
    await login(page, "platform-sales@zhengmu.local");
    await page.goto("/app/zhengmu-platform/business-lines");
    await expect(page.getByRole("heading", { name: createdBusinessLineName })).toHaveCount(0);
  });

  test("PLATFORM_ADMIN 仍可访问平台审计日志，并在 demo-guide 中看到平台维护提示", async ({ page }) => {
    await login(page, "admin@growthhub.local");
    await expect(page).toHaveURL(/\/admin$/);
    await expectLinksVisible(page, ["租户管理", "平台审计日志"]);

    await page.goto("/admin/audit-logs");
    await expect(page.getByRole("heading", { name: "平台审计日志" })).toBeVisible();

    await page.goto("/app/zhengmu-platform/demo-guide");
    await expect(page.getByText("平台维护提示")).toBeVisible();
    await expect(page.getByText("平台管理员主要负责租户、配置、安全和审计。")).toBeVisible();
  });
});

