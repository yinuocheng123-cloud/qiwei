import { expect, test, type Page } from "@playwright/test";

async function login(page: Page, email: string, password = "123456") {
  await page.goto("/login");
  await expect(page.getByLabel("邮箱")).toBeVisible();
  await page.getByLabel("邮箱").fill(email);
  await page.getByLabel("密码").fill(password);
  await Promise.all([
    page.waitForURL((url) => url.pathname === "/admin" || /^\/app\/[^/]+\/dashboard$/.test(url.pathname)),
    page.locator("form button").click()
  ]);
}

test.describe("V2.3.5 销售资料清单", () => {
  test("SALES 可以查看按客户类型分组的销售资料清单", async ({ page }) => {
    await login(page, "sales@zhengmu.local");
    await page.goto("/app/zhengmu-demo/materials");

    await expect(page.getByRole("heading", { name: "销售资料清单", level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: /潜在客户资料清单/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: /合作伙伴资料清单/ })).toBeVisible();
    await expect(page.getByText("已完善").first()).toBeVisible();
    await expect(page.getByText("先看清单和状态，展开后再看链接与说明。").first()).toBeVisible();
  });

  test("SALES 默认只看清单，不显示编辑表单", async ({ page }) => {
    await login(page, "sales@zhengmu.local");
    await page.goto("/app/zhengmu-demo/materials");

    await expect(page.getByRole("heading", { name: "销售资料清单", level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "新增资料链接" })).toHaveCount(0);
    await expect(page.locator('input[name="url"]')).toHaveCount(0);
    await expect(page.locator('textarea[name="description"]')).toHaveCount(0);
    await expect(page.getByText("保存资料链接")).toHaveCount(0);
  });

  test("TENANT_ADMIN 可以展开详情并编辑资料链接", async ({ page }) => {
    await login(page, "boss@zhengmu.local");
    await page.goto("/app/zhengmu-demo/materials");

    await expect(page.getByRole("heading", { name: "销售资料清单", level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "新增资料链接" })).toBeVisible();
    await expect(page.getByText("展开 / 编辑").first()).toBeVisible();

    const firstMaterialDetails = page.locator("details").filter({ hasText: "新增资料链接" }).first();
    await firstMaterialDetails.evaluate((element) => {
      (element as HTMLDetailsElement).open = true;
    });
    await expect(firstMaterialDetails.locator('input[name="url"]')).toBeVisible();
    await expect(firstMaterialDetails.locator('textarea[name="description"]')).toBeVisible();
    await expect(firstMaterialDetails.getByText("保存资料链接")).toBeVisible();
  });
});

