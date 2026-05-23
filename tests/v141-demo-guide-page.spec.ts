/*
 * 文件说明：该文件覆盖 V1.4.1 演示说明页的浏览器端验证。
 * 功能说明：验证 demo-guide 页面的访问权限、核心内容和跨租户隔离行为。
 *
 * 结构概览：
 *   第一部分：导入依赖与登录工具
 *   第二部分：V1.4.1 演示说明页访问验证
 */
import { expect, test, type Page } from "@playwright/test";

async function login(page: Page, email: string, password = "123456") {
  await page.goto("/login");
  await page.getByLabel("邮箱").fill(email);
  await page.getByLabel("密码").fill(password);
  await page.getByRole("button", { name: "登录" }).click();
  await page.waitForURL(/\/(admin|app\/[^/]+\/dashboard)$/);
}

test.describe.serial("V1.4.1 演示说明页", () => {
  test("企业管理员可以访问本租户演示说明页并看到四类客户与演示顺序", async ({ page }) => {
    await login(page, "boss@zhengmu.local");
    await page.goto("/app/zhengmu-demo/demo-guide");

    await expect(page).toHaveURL(/\/app\/zhengmu-demo\/demo-guide$/);
    await expect(page.getByRole("heading", { name: "平台销售工作台演示说明" })).toBeVisible();
    await expect(page.getByText("推荐演示顺序")).toBeVisible();
    await expect(page.getByRole("heading", { name: "潜在客户" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "合作伙伴" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "意向客户" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "重点客户" })).toBeVisible();
    await expect(page.getByText("第一步：看 dashboard")).toBeVisible();
    await expect(page.getByRole("link", { name: "演示说明" })).toBeVisible();
  });

  test("销售账号可以访问本租户演示说明页", async ({ page }) => {
    await login(page, "sales@zhengmu.local");
    await page.goto("/app/zhengmu-demo/demo-guide");

    await expect(page).toHaveURL(/\/app\/zhengmu-demo\/demo-guide$/);
    await expect(page.getByRole("heading", { name: "平台销售工作台演示说明" })).toBeVisible();
    await expect(page.getByText("销售视角")).toBeVisible();
  });

  test("未登录访问演示说明页会跳转登录页", async ({ page }) => {
    await page.goto("/app/zhengmu-demo/demo-guide");
    await expect(page).toHaveURL(/\/login\?next=%2Fapp%2Fzhengmu-demo%2Fdemo-guide$/);
  });

  test("跨租户访问演示说明页仍然被拒绝", async ({ page }) => {
    await login(page, "sales@zhengmu.local");
    await page.goto("/app/isolation-demo/demo-guide");
    await expect(page).toHaveURL(/\/forbidden$/);
  });
});
