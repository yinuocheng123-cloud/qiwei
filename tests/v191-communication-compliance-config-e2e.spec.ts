/*
 * 文件说明：该文件覆盖 V1.9.1 沟通素材合规采集配置中心的浏览器端验证。
 * 功能说明：验证企业管理员可配置、运营只读、销售拒绝、收费申请与合规确认前置、自动发送强制关闭和审计链路。
 *
 * 结构概览：
 *   第一部分：登录与导航辅助函数
 *   第二部分：V1.9.1 串行回归用例
 */
import { expect, test, type Page } from "@playwright/test";

async function login(page: Page, email: string, password = "123456") {
  await page.goto("/login");
  await expect(page.getByLabel("邮箱")).toBeVisible({ timeout: 120_000 });
  await page.getByLabel("邮箱").fill(email);
  await page.getByLabel("密码").fill(password);
  await page.getByRole("button", { name: "登录" }).click();
  await page.waitForURL(/\/(admin|app\/[^/]+\/dashboard)$/);
}

function navLink(page: Page, name: string) {
  return page.getByRole("link", { name, exact: true });
}

test.describe.serial("V1.9.1 沟通素材合规采集配置中心", () => {
  test("TENANT_ADMIN 可访问页面，OPERATOR 只读查看，SALES 被拒绝", async ({ page }) => {
    await login(page, "platform-boss@zhengmu.local");
    await page.goto("/app/zhengmu-platform/communication-compliance");

    await expect(page.getByRole("heading", { name: "沟通素材合规采集配置" })).toBeVisible();
    await expect(navLink(page, "采集合规配置")).toBeVisible();
    await expect(page.getByText("本系统不会偷偷读取企业微信聊天。")).toBeVisible();
    await expect(page.getByText("本系统不会偷偷读取电话录音。")).toBeVisible();
    await expect(page.getByText("本系统不会自动发送客户消息。")).toBeVisible();

    await page.goto("/logout");
    await login(page, "platform-operator@zhengmu.local");
    await page.goto("/app/zhengmu-platform/communication-compliance");
    await expect(page.getByRole("heading", { name: "沟通素材合规采集配置" })).toBeVisible();
    await expect(navLink(page, "采集合规配置")).toBeVisible();
    await expect(page.getByText("当前账号为只读查看模式。只有企业管理员可以启用、暂停或修改合规采集配置。").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "保存合规配置" })).toHaveCount(0);

    await page.goto("/logout");
    await login(page, "platform-sales@zhengmu.local");
    await page.goto("/app/zhengmu-platform/dashboard");
    await expect(navLink(page, "采集合规配置")).toHaveCount(0);
    await page.goto("/app/zhengmu-platform/communication-compliance");
    await expect(page).toHaveURL(/\/forbidden$/);
  });

  test("企业管理员未申请或未完成合规确认前不能启用，申请后可进入申请中或启用，自动发送始终关闭", async ({ page }) => {
    await login(page, "platform-boss@zhengmu.local");
    await page.goto("/app/zhengmu-platform/communication-compliance");

    const wechatCard = page.locator("div.rounded-md.border.border-slate-200.bg-white").filter({
      has: page.getByRole("heading", { name: "企业微信会话存档采集" })
    }).first();
    const applicationCheckbox = wechatCard.getByRole("checkbox", { name: "我确认本企业已提交该收费功能的开通申请" });
    const confirmationCheckboxes = [
      "我确认本企业已了解该功能会涉及工作沟通内容处理。",
      "我确认本企业会依法完成员工告知。",
      "我确认本企业会依法向客户进行必要提示。",
      "我确认仅在工作沟通、客户服务、风险留痕、销售跟进辅助范围内使用。",
      "我确认不会将该功能用于非授权监控或与业务无关的用途。",
      "我确认 AI 生成内容仅作为辅助建议，最终发送和承诺由人工确认。"
    ];

    await applicationCheckbox.uncheck();
    for (const label of confirmationCheckboxes) {
      await wechatCard.getByRole("checkbox", { name: label }).uncheck();
    }
    await wechatCard.getByLabel("通道状态").selectOption("DISABLED");
    await wechatCard.getByRole("button", { name: "保存合规配置" }).click();
    await expect(page.getByText("采集合规配置已保存。").first()).toBeVisible();

    await wechatCard.getByLabel("通道状态").selectOption("ENABLED");
    await wechatCard.getByRole("button", { name: "保存合规配置" }).click();
    await expect(page.getByText("该功能属于单独收费能力，必须先提交开通申请后才能进入申请中或启用状态。").first()).toBeVisible();

    await applicationCheckbox.check();
    await wechatCard.getByLabel("通道状态").selectOption("ENABLED");
    await wechatCard.getByRole("button", { name: "保存合规配置" }).click();
    await expect(page.getByText("未完成全部合规确认项前，不能启用自动采集通道。").first()).toBeVisible();

    await wechatCard.getByLabel("通道状态").selectOption("APPLYING");
    await wechatCard.getByRole("button", { name: "保存合规配置" }).click();
    await expect(wechatCard.getByText("状态：申请中")).toBeVisible();

    await wechatCard.getByRole("checkbox", { name: "我确认本企业已了解该功能会涉及工作沟通内容处理。" }).check();
    await wechatCard.getByRole("checkbox", { name: "我确认本企业会依法完成员工告知。" }).check();
    await wechatCard.getByRole("checkbox", { name: "我确认本企业会依法向客户进行必要提示。" }).check();
    await wechatCard.getByRole("checkbox", { name: "我确认仅在工作沟通、客户服务、风险留痕、销售跟进辅助范围内使用。" }).check();
    await wechatCard.getByRole("checkbox", { name: "我确认不会将该功能用于非授权监控或与业务无关的用途。" }).check();
    await wechatCard.getByRole("checkbox", { name: "我确认 AI 生成内容仅作为辅助建议，最终发送和承诺由人工确认。" }).check();
    await wechatCard.getByLabel("通道状态").selectOption("ENABLED");
    await wechatCard.getByRole("button", { name: "保存合规配置" }).click();

    await expect(wechatCard.getByText("状态：已启用")).toBeVisible();
    await expect(wechatCard.getByText("收费申请：已提交")).toBeVisible();
    await expect(wechatCard.getByText("自动发送客户消息：暂未开放，始终关闭")).toBeVisible();
    await expect(wechatCard.getByRole("checkbox", { name: "自动发送客户消息" })).toBeDisabled();

    await page.goto("/app/zhengmu-platform/audit-logs?action=communication_compliance_config_enabled");
    await expect(page.getByText("communication_compliance_config_enabled").first()).toBeVisible();
  });

  test("zhengmu-demo、客户导入、权限矩阵与 CNAS 页面链路不受影响", async ({ page }) => {
    await login(page, "platform-boss@zhengmu.local");
    await page.goto("/app/zhengmu-platform/imports");
    await expect(page.getByRole("heading", { name: "客户导入" })).toBeVisible();

    await page.goto("/app/zhengmu-platform/permissions");
    await expect(page.getByRole("heading", { name: "权限矩阵", exact: true })).toBeVisible();

    await page.goto("/forms/cnas-path-check");
    await expect(page.getByRole("heading", { name: "CNAS认可路径判断问卷" })).toBeVisible();

    await page.goto("/logout");
    await login(page, "boss@zhengmu.local");
    await page.goto("/app/zhengmu-demo/demo-guide");
    await expect(page.getByRole("heading", { name: "整木行业演示说明" })).toBeVisible();
  });
});
