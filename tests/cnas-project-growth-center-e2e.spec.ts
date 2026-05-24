/*
 * 文件说明：该文件覆盖 CNAS 认可指南项目接入后的公开问卷与后台承接链路。
 * 功能说明：验证公开访问、A/B/C 诊断、线索落库、结构化标签、UTM 记录、租户内查看与审计记录。
 *
 * 结构概览：
 *   第一部分：登录与问卷填写辅助函数
 *   第二部分：CNAS 项目接入回归用例
 */
import { expect, test, type Page } from "@playwright/test";

const suffix = Date.now().toString().slice(-6);
const leadA = {
  company: `CNAS高意向实验室${suffix}`,
  contactName: `高意向联系人${suffix}`,
  phone: `13891${suffix}`,
  utmSource: "search-engine",
  utmMedium: "cpc",
  utmCampaign: "cnas-a-campaign"
};
const leadB = {
  company: `CNAS中意向实验室${suffix}`,
  contactName: `中意向联系人${suffix}`,
  phone: `13881${suffix}`
};
const leadC = {
  company: `CNAS低意向实验室${suffix}`,
  contactName: `低意向联系人${suffix}`,
  phone: `13871${suffix}`
};

async function login(page: Page, email: string, password = "123456", nextPath?: string) {
  const loginUrl = nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : "/login";
  await page.goto(loginUrl);
  await page.getByLabel("邮箱").fill(email);
  await page.getByLabel("密码").fill(password);
  await page.getByRole("button", { name: "登录" }).click();
  if (nextPath) {
    await page.waitForURL(new RegExp(`${nextPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`));
  } else {
    await page.waitForURL(/\/(admin|app\/[^/]+\/dashboard)$/);
  }
  await page.waitForLoadState("networkidle");
}

async function fillBaseForm(page: Page, input: { company: string; contactName: string; phone: string }) {
  await page.getByLabel("企业名称").fill(input.company);
  await page.getByLabel("联系人").fill(input.contactName);
  await page.getByLabel("手机号").fill(input.phone);
}

test.describe.serial("CNAS 项目接入", () => {
  test("公开可访问 CNAS 路径判断问卷并提交 A 类诊断", async ({ page }) => {
    await page.goto(
      `/forms/cnas-path-check?utm_source=${leadA.utmSource}&utm_medium=${leadA.utmMedium}&utm_campaign=${leadA.utmCampaign}`
    );
    await expect(page.getByRole("heading", { name: "CNAS认可路径判断问卷" })).toBeVisible();

    await fillBaseForm(page, leadA);
    await page.getByLabel("实验室类型").selectOption("检测实验室");
    await page.getByLabel("当前阶段").selectOption("准备申请");
    await page.getByLabel("认可范围是否明确").selectOption("已明确");
    await page.getByLabel("人员设备是否基本具备").selectOption("基本具备");
    await page.getByLabel("计划启动时间").selectOption("立即启动");
    await page.getByLabel("最担心的问题").selectOption("已经返工过");
    await page.getByLabel("是否已添加企业微信").selectOption("是");
    await page.getByLabel("补充说明").fill("需要尽快梳理认可范围和整改节奏。");
    await page.getByRole("button", { name: "提交问卷并生成初步判断" }).click();

    await page.waitForURL(/\/forms\/cnas-path-check\/result\?diagnosis=A$/);
    await expect(page.getByRole("heading", { name: /适合进入认可路径设计阶段/ })).toBeVisible();
    await expect(page.getByText("A 类")).toBeVisible();
  });

  test("提交 B 类和 C 类问卷后返回对应诊断", async ({ page }) => {
    await page.goto("/forms/cnas-path-check");
    await fillBaseForm(page, leadB);
    await page.getByLabel("实验室类型").selectOption("校准实验室");
    await page.getByLabel("当前阶段").selectOption("已准备建设");
    await page.getByLabel("认可范围是否明确").selectOption("大致明确");
    await page.getByLabel("人员设备是否基本具备").selectOption("部分具备");
    await page.getByLabel("计划启动时间").selectOption("3个月内");
    await page.getByLabel("最担心的问题").selectOption("费用不清楚");
    await page.getByLabel("是否已添加企业微信").selectOption("否");
    await page.getByRole("button", { name: "提交问卷并生成初步判断" }).click();
    await page.waitForURL(/\/forms\/cnas-path-check\/result\?diagnosis=B$/);
    await expect(page.getByRole("heading", { name: /适合先准备基础条件/ })).toBeVisible();

    await page.goto("/forms/cnas-path-check");
    await fillBaseForm(page, leadC);
    await page.getByLabel("实验室类型").selectOption("暂不确定");
    await page.getByLabel("当前阶段").selectOption("刚开始了解");
    await page.getByLabel("认可范围是否明确").selectOption("还不清楚");
    await page.getByLabel("人员设备是否基本具备").selectOption("明显不足");
    await page.getByLabel("计划启动时间").selectOption("只是先了解");
    await page.getByLabel("最担心的问题").selectOption("不知道从哪开始");
    await page.getByLabel("是否已添加企业微信").selectOption("否");
    await page.getByRole("button", { name: "提交问卷并生成初步判断" }).click();
    await page.waitForURL(/\/forms\/cnas-path-check\/result\?diagnosis=C$/);
    await expect(page.getByRole("heading", { name: /暂不适合直接启动申请/ })).toBeVisible();
  });

  test("zhengmu-platform 管理员和销售可查看 CNAS 线索、标签、UTM 与审计，zhengmu-demo 不受影响", async ({ page }) => {
    await login(page, "platform-boss@zhengmu.local", "123456", "/app/zhengmu-platform/leads");
    await expect(page.getByRole("link", { name: leadA.contactName })).toBeVisible();
    await page.getByRole("link", { name: leadA.contactName }).click();

    await expect(page.getByRole("heading", { name: leadA.contactName })).toBeVisible();
    const tagSection = page.getByRole("heading", { name: "标签", exact: true, level: 2 }).locator("..");
    await expect(tagSection).toContainText("CNAS认可指南");
    await expect(tagSection).toContainText("检测");
    await expect(tagSection).toContainText("准备申请");
    await expect(tagSection).toContainText("返工");
    await expect(tagSection).toContainText("高意向");
    await expect(tagSection).toContainText("搜索");

    const cnasSection = page.getByRole("heading", { name: "CNAS 初步判断", exact: true, level: 2 }).locator("..");
    await expect(cnasSection).toContainText("A 类");
    await expect(cnasSection).toContainText("search-engine");
    await expect(cnasSection).toContainText("cpc");
    await expect(cnasSection).toContainText("cnas-a-campaign");

    const taskSection = page.getByRole("heading", { name: "当前任务", exact: true, level: 2 }).locator("..");
    await expect(taskSection).toContainText("CNAS高意向路径梳理");

    await page.goto("/app/zhengmu-platform/audit-logs");
    await expect(page.getByText("cnas_form_submitted").first()).toBeVisible();
    await expect(page.getByText("cnas_diagnosis_created").first()).toBeVisible();

    await page.goto("/logout");
    await login(page, "platform-sales@zhengmu.local", "123456", "/app/zhengmu-platform/leads");
    await expect(page.getByRole("link", { name: leadA.contactName })).toBeVisible();
    await page.getByRole("link", { name: leadA.contactName }).click();
    await expect(page.getByRole("heading", { name: leadA.contactName })).toBeVisible();

    await page.goto("/logout");
    await login(page, "boss@zhengmu.local", "123456", "/app/zhengmu-demo/demo-guide");
    await expect(page.getByRole("heading", { name: "MarketClaw 销售助手平台说明" })).toBeVisible();
  });
});

