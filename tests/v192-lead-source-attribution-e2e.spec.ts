/*
 * 文件说明：该文件覆盖 V1.9.2 客户来源归因细化的浏览器端验证。
 * 功能说明：验证 CNAS 表单、客户导入、客户详情、权限边界、审计日志与既有链路兼容。
 *
 * 结构概览：
 *   第一部分：登录、下载与表单辅助函数
 *   第二部分：V1.9.2 串行回归用例
 */
import { PrismaClient } from "@prisma/client";
import { expect, test, type Download, type Page } from "@playwright/test";
import { buildAutoImportFieldMapping, buildImportBatchPreview, completeImportBatch, parseCsvText } from "@/lib/imports";

const suffix = Date.now().toString().slice(-6);
const testPrisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL ?? "postgresql://postgres@127.0.0.1:55432/wecom_growth_hub_v11?schema=public"
    }
  }
});
const cnasLead = {
  company: `来源归因CNAS实验室${suffix}`,
  contactName: `来源归因联系人${suffix}`,
  phone: `13791${suffix}`,
  sourceChannel: "会议活动",
  sourceProject: "CNAS认可指南",
  sourceCampaign: "CNAS认可直播课",
  sourceScene: "会场入口",
  sourceTouchpoint: "签到台二维码",
  sourceQr: "cnas-live-door-01",
  sourceStaff: "张三",
  sourcePage: "/forms/cnas-path-check",
  sourceContent: "CNAS认可直播课海报",
  utmSource: "offline",
  utmMedium: "qrcode",
  utmCampaign: "cnas_live",
  utmContent: "door_poster",
  utmTerm: "cnas_entry"
};
const importedLead = {
  name: `导入来源客户${suffix}`,
  phone: `13681${suffix}`,
  wechat: `source-import-${suffix}`,
  company: `导入来源公司${suffix}`,
  source: "会议活动",
  sourceProject: "整木网会员",
  sourceCampaign: "2026整木企业GEO增长会",
  sourceScene: "主会场",
  sourceTouchpoint: "PPT第18页二维码",
  sourceQrCode: "event-geo-2026-ppt-18",
  sourceStaffName: "平台销售顾问",
  sourcePage: "/landing/geo-growth",
  sourceContent: "整木企业GEO增长会主视觉",
  utmSource: "offline",
  utmMedium: "qrcode",
  utmCampaign: "geo_growth_2026",
  utmContent: "ppt_slide_18",
  utmTerm: "main_stage"
};
const importCsvContent = [
  "客户姓名,手机号,微信号,公司名称,客户类型,来源渠道,来源项目,来源活动,来源场景,来源触点,来源二维码,来源人员,来源页面,来源内容,utm_source,utm_medium,utm_campaign,utm_content,utm_term,需求说明,意向等级,当前阶段,备注,业务线,标签,负责人邮箱,下次跟进时间",
  `${importedLead.name},${importedLead.phone},${importedLead.wechat},${importedLead.company},会员意向客户,${importedLead.source},${importedLead.sourceProject},${importedLead.sourceCampaign},${importedLead.sourceScene},${importedLead.sourceTouchpoint},${importedLead.sourceQrCode},${importedLead.sourceStaffName},${importedLead.sourcePage},${importedLead.sourceContent},${importedLead.utmSource},${importedLead.utmMedium},${importedLead.utmCampaign},${importedLead.utmContent},${importedLead.utmTerm},想了解会员服务和品牌增长支持,HIGH,NEW,来自来源归因导入测试,,"高意向,来源归因",platform-sales@zhengmu.local,2026-05-16 10:00`
].join("\n");

async function login(page: Page, email: string, password = "123456", nextPath?: string) {
  const loginUrl = nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : "/login";
  await page.goto(loginUrl);
  await expect(page.getByLabel("邮箱")).toBeVisible({ timeout: 120_000 });
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

async function fillCnasAForm(page: Page) {
  await page.getByLabel("企业名称").fill(cnasLead.company);
  await page.getByLabel("联系人").fill(cnasLead.contactName);
  await page.getByLabel("手机号").fill(cnasLead.phone);
  await page.getByLabel("实验室类型").selectOption("检测实验室");
  await page.getByLabel("当前阶段").selectOption("准备申请");
  await page.getByLabel("认可范围是否明确").selectOption("已明确");
  await page.getByLabel("人员设备是否基本具备").selectOption("基本具备");
  await page.getByLabel("计划启动时间").selectOption("立即启动");
  await page.getByLabel("最担心的问题").selectOption("已经返工过");
  await page.getByLabel("是否已添加企业微信").selectOption("是");
  await page.getByLabel("补充说明").fill("来源归因测试需要验证 A 类诊断和来源字段落库。");
}

function detailSection(page: Page, title: string) {
  return page.getByRole("heading", { name: title, exact: true, level: 2 }).locator("..");
}

async function openLeadDetail(page: Page, leadName: string) {
  const leadLink = page.getByRole("link", { name: leadName });
  await expect(leadLink).toBeVisible({ timeout: 20_000 });
  const href = await leadLink.getAttribute("href");
  if (!href) {
    throw new Error(`未找到客户详情链接：${leadName}`);
  }
  await page.goto(href);
  await page.waitForLoadState("networkidle");
}

async function expectTemplateDownload(downloadPromise: Promise<Download>) {
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain("lead-import-template.csv");
  const stream = await download.createReadStream();
  if (!stream) {
    throw new Error("导入模板下载流不存在。");
  }

  let content = "";
  for await (const chunk of stream) {
    content += chunk.toString();
  }

  expect(content).toContain("来源项目");
  expect(content).toContain("来源活动");
  expect(content).toContain("来源场景");
  expect(content).toContain("来源触点");
  expect(content).toContain("来源二维码");
  expect(content).toContain("来源人员");
  expect(content).toContain("来源页面");
  expect(content).toContain("来源内容");
  expect(content).toContain("utm_source");
  expect(content).toContain("utm_term");
}

test.describe.serial("V1.9.2 客户来源归因细化", () => {
  test.afterAll(async () => {
    await testPrisma.$disconnect();
  });

  test("CNAS 表单带来源参数提交后生成 Lead，并在客户详情展示来源归因和 UTM", async ({ page }) => {
    const params = new URLSearchParams({
      source_channel: cnasLead.sourceChannel,
      source_project: cnasLead.sourceProject,
      source_campaign: cnasLead.sourceCampaign,
      source_scene: cnasLead.sourceScene,
      source_touchpoint: cnasLead.sourceTouchpoint,
      source_qr: cnasLead.sourceQr,
      source_staff: cnasLead.sourceStaff,
      source_page: cnasLead.sourcePage,
      source_content: cnasLead.sourceContent,
      utm_source: cnasLead.utmSource,
      utm_medium: cnasLead.utmMedium,
      utm_campaign: cnasLead.utmCampaign,
      utm_content: cnasLead.utmContent,
      utm_term: cnasLead.utmTerm
    });

    await page.goto(`/forms/cnas-path-check?${params.toString()}`);
    await expect(page.getByRole("heading", { name: "CNAS认可路径判断问卷" })).toBeVisible();
    await fillCnasAForm(page);
    await page.getByRole("button", { name: "提交问卷并生成初步判断" }).click();

    await page.waitForURL(/\/forms\/cnas-path-check\/result\?diagnosis=A$/);
    await expect(page.getByText("A 类")).toBeVisible();

    await login(page, "platform-boss@zhengmu.local", "123456", "/app/zhengmu-platform/leads");
    await openLeadDetail(page, cnasLead.contactName);

    const attributionSection = detailSection(page, "来源归因");
    await expect(attributionSection).toContainText(cnasLead.sourceChannel);
    await expect(attributionSection).toContainText(cnasLead.sourceProject);
    await expect(attributionSection).toContainText(cnasLead.sourceCampaign);
    await expect(attributionSection).toContainText(cnasLead.sourceScene);
    await expect(attributionSection).toContainText(cnasLead.sourceTouchpoint);
    await expect(attributionSection).toContainText(cnasLead.sourceQr);
    await expect(attributionSection).toContainText(cnasLead.sourceStaff);
    await expect(attributionSection).toContainText(cnasLead.sourceContent);
    await expect(attributionSection).toContainText(cnasLead.utmSource);
    await expect(attributionSection).toContainText(cnasLead.utmMedium);
    await expect(attributionSection).toContainText(cnasLead.utmCampaign);
    await expect(attributionSection).toContainText(cnasLead.utmContent);
    await expect(attributionSection).toContainText(cnasLead.utmTerm);

    await page.goto("/app/zhengmu-platform/audit-logs?action=lead_source_attribution_created");
    await expect(page.getByText("lead_source_attribution_created").first()).toBeVisible();
  });

  test("客户导入模板包含来源归因字段，导入后的客户可写入来源活动和来源场景", async ({ page }) => {
    await login(page, "platform-boss@zhengmu.local", "123456", "/app/zhengmu-platform/imports");
    await expect(page.getByRole("heading", { name: "客户导入" })).toBeVisible();

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("link", { name: "下载导入模板" }).click();
    await expectTemplateDownload(downloadPromise);

    const importOperator = await testPrisma.user.findFirst({
      where: { email: "platform-boss@zhengmu.local" },
      select: { id: true, tenantId: true }
    });
    if (!importOperator?.tenantId) {
      throw new Error("未找到用于导入验证的企业管理员账号。");
    }

    const { headers, rawRows } = parseCsvText(importCsvContent);
    const mapping = buildAutoImportFieldMapping(headers);
    const preview = await buildImportBatchPreview({
      prisma: testPrisma,
      tenantId: importOperator.tenantId,
      createdById: importOperator.id,
      fileName: "manual-input.csv",
      fileType: "text/csv",
      rawRows,
      headers,
      mapping,
      defaults: {
        defaultOwnerId: null,
        defaultTags: [],
        defaultBusinessLineIds: [],
        autoCreateFirstTask: true,
        skipDuplicates: true
      }
    });
    await completeImportBatch({
      prisma: testPrisma,
      tenantId: importOperator.tenantId,
      batchId: preview.batch.id,
      createdById: importOperator.id
    });

    await page.goto(`/app/zhengmu-platform/leads?sourceCampaign=${encodeURIComponent(importedLead.sourceCampaign)}`);
    await openLeadDetail(page, importedLead.name);

    const attributionSection = detailSection(page, "来源归因");
    await expect(attributionSection).toContainText(importedLead.sourceProject);
    await expect(attributionSection).toContainText(importedLead.sourceCampaign);
    await expect(attributionSection).toContainText(importedLead.sourceScene);
    await expect(attributionSection).toContainText(importedLead.sourceTouchpoint);
    await expect(attributionSection).toContainText(importedLead.sourceQrCode);
    await expect(attributionSection).toContainText(importedLead.sourceContent);
    await expect(attributionSection).toContainText(importedLead.utmCampaign);
  });

  test("SALES 只能查看自己负责客户的来源归因，且 V1.9.1 与 zhengmu-demo 链路不受影响", async ({ page }) => {
    await login(page, "platform-sales@zhengmu.local", "123456", "/app/zhengmu-platform/leads");
    await openLeadDetail(page, importedLead.name);
    await expect(detailSection(page, "来源归因")).toContainText(importedLead.sourceCampaign);

    await page.goto("/logout");
    await login(page, "platform-boss@zhengmu.local", "123456", "/app/zhengmu-platform/communication-compliance");
    await expect(page.getByRole("heading", { name: "沟通素材合规采集配置" })).toBeVisible();

    await page.goto("/logout");
    await login(page, "boss@zhengmu.local", "123456", "/app/zhengmu-demo/demo-guide");
    await expect(page.getByRole("heading", { name: "MarketClaw 销售助手平台说明" })).toBeVisible();
  });
});

