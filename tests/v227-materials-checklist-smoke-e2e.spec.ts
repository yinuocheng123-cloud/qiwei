/*
 * 文件说明：该文件提供 V2.2.7 资料包清单化收口的 smoke 测试。
 * 功能说明：验证销售可查看按客户类型分组的资料清单，管理员可展开详情和编辑，销售默认不暴露复杂表单。
 *
 * 结构概览：
 *   第一部分：登录辅助函数
 *   第二部分：销售资料清单只读测试
 *   第三部分：管理员展开与编辑入口测试
 */
import { expect, test, type Page } from "@playwright/test";

async function login(page: Page, email: string, password = "123456") {
  await page.goto("/login");
  await expect(page.locator('input[name="email"]')).toBeVisible();
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await Promise.all([
    page.waitForURL((url) => url.pathname === "/admin" || /^\/app\/[^/]+\/dashboard$/.test(url.pathname)),
    page.locator("form button").click()
  ]);
}

test.describe("V2.2.7 资料包清单化收口", () => {
  test("SALES 可以打开资料页并看到按客户类型分组的清单", async ({ page }) => {
    await login(page, "sales@zhengmu.local");
    await page.goto("/app/zhengmu-demo/materials");

    await expect(page.getByRole("heading", { name: "销售资料清单", level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: /潜在客户资料包/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: /合作伙伴资料包/ })).toBeVisible();
    await expect(page.getByText("已完善").first()).toBeVisible();
    await expect(page.getByText("产品服务避坑清单")).toBeVisible();
  });

  test("SALES 默认不看到复杂编辑表单", async ({ page }) => {
    await login(page, "sales@zhengmu.local");
    await page.goto("/app/zhengmu-demo/materials");

    await expect(page.getByRole("heading", { name: "销售资料清单", level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "新增资料" })).toHaveCount(0);
    await expect(page.locator('input[name="url"]')).toHaveCount(0);
    await expect(page.locator('textarea[name="description"]')).toHaveCount(0);
    await expect(page.getByText("保存资料包")).toHaveCount(0);
  });

  test("TENANT_ADMIN 可以看到展开详情和编辑入口", async ({ page }) => {
    await login(page, "boss@zhengmu.local");
    await page.goto("/app/zhengmu-demo/materials");

    await expect(page.getByRole("heading", { name: "销售资料清单", level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "新增资料" })).toBeVisible();
    await expect(page.getByText("展开 / 编辑").first()).toBeVisible();

    await page.getByText("展开 / 编辑").first().click();
    await expect(page.getByText("链接：").first()).toBeVisible();
    await expect(page.getByText("创建时间：").first()).toBeVisible();
    await expect(page.getByText("保存资料包").first()).toBeVisible();
  });
});
