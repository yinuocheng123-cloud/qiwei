/*
 * 文件说明：该文件覆盖 V2.7 CNAS 企业微信真实轻接入 smoke。
 * 功能说明：验证企业微信 URL 验证、加密回调、外部联系人新增事件承接、来源归因、客户详情企微信息和权限边界。
 *
 * 结构概览：
 *   第一部分：加密回调与登录辅助函数
 *   第二部分：测试前配置企业微信真实轻接入
 *   第三部分：模拟真实回调并验证客户进入 MarketClaw
 */
import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

const suffix = Date.now().toString().slice(-6);
const corpId = "ww-v27-cnas-smoke";
const token = `token-v27-${suffix}`;
const agentId = "1000007";
const secret = `secret-v27-${suffix}`;
const encodingAESKey = crypto.randomBytes(32).toString("base64").slice(0, 43);
const externalUserId = `wm_v27_${suffix}`;
const wecomUserId = `v27-sales-${suffix}`;
const state = `cnas-real-intake-${suffix}`;

const testPrisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL ?? "postgresql://postgres@127.0.0.1:55432/wecom_growth_hub_demo?schema=public"
    }
  }
});

function sha1(values: string[]) {
  return crypto.createHash("sha1").update(values.sort().join("")).digest("hex");
}

function pkcs7Pad(buffer: Buffer) {
  const blockSize = 32;
  const remainder = buffer.length % blockSize;
  const pad = remainder === 0 ? blockSize : blockSize - remainder;
  return Buffer.concat([buffer, Buffer.alloc(pad, pad)]);
}

function encryptWecomPayload(message: string) {
  const key = Buffer.from(`${encodingAESKey}=`, "base64");
  const messageBuffer = Buffer.from(message);
  const lengthBuffer = Buffer.alloc(4);
  lengthBuffer.writeUInt32BE(messageBuffer.length, 0);
  const plain = pkcs7Pad(Buffer.concat([crypto.randomBytes(16), lengthBuffer, messageBuffer, Buffer.from(corpId)]));
  const cipher = crypto.createCipheriv("aes-256-cbc", key, key.subarray(0, 16));
  cipher.setAutoPadding(false);
  return Buffer.concat([cipher.update(plain), cipher.final()]).toString("base64");
}

function buildSignedQuery(encryptedText: string) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = `nonce-${suffix}`;
  const msgSignature = sha1([token, timestamp, nonce, encryptedText]);
  return new URLSearchParams({
    msg_signature: msgSignature,
    timestamp,
    nonce
  });
}

async function login(page: Page, email: string, password = "123456") {
  await page.goto("/login");
  await page.getByLabel("邮箱").fill(email);
  await page.getByLabel("密码").fill(password);
  await page.getByRole("button", { name: "登录" }).click();
  await page.waitForURL(/\/(admin|app\/[^/]+\/dashboard)$/);
  await page.waitForLoadState("networkidle");
}

function detailSection(page: Page, title: string) {
  return page.getByRole("heading", { name: title, exact: true, level: 2 }).locator("..");
}

test.describe.serial("V2.7 CNAS 企业微信真实轻接入", () => {
  test.beforeAll(async () => {
    const tenant = await testPrisma.tenant.findUnique({ where: { slug: "zhengmu-platform" } });
    const sales = await testPrisma.user.findUnique({ where: { email: "platform-sales@zhengmu.local" } });
    if (!tenant || !sales) {
      throw new Error("缺少 zhengmu-platform 租户或平台销售账号。");
    }

    await testPrisma.weComConfig.upsert({
      where: { tenantId: tenant.id },
      update: {
        corpId,
        agentId,
        secretEncrypted: secret,
        token,
        encodingAESKey,
        callbackUrl: `/api/wecom/${tenant.slug}/callback`,
        status: "enabled"
      },
      create: {
        tenantId: tenant.id,
        corpId,
        agentId,
        secretEncrypted: secret,
        token,
        encodingAESKey,
        callbackUrl: `/api/wecom/${tenant.slug}/callback`,
        status: "enabled"
      }
    });

    await testPrisma.userWecomBinding.upsert({
      where: { userId: sales.id },
      update: {
        tenantId: tenant.id,
        wecomUserId,
        displayName: sales.name,
        enabled: true
      },
      create: {
        tenantId: tenant.id,
        userId: sales.id,
        wecomUserId,
        displayName: sales.name,
        enabled: true
      }
    });
  });

  test.afterAll(async () => {
    await testPrisma.$disconnect();
  });

  test("URL 验证和外部联系人新增回调可以生成 CNAS 客户并进入跟进流程", async ({ page, request }) => {
    const echoEncrypted = encryptWecomPayload("v27-url-verify-ok");
    const echoQuery = buildSignedQuery(echoEncrypted);
    echoQuery.set("echostr", echoEncrypted);
    const verifyResponse = await request.get(`/api/wecom/zhengmu-platform/callback?${echoQuery.toString()}`);
    expect(verifyResponse.status()).toBe(200);
    expect(await verifyResponse.text()).toBe("v27-url-verify-ok");

    const eventXml = `<xml>
      <ToUserName><![CDATA[${corpId}]]></ToUserName>
      <FromUserName><![CDATA[sys]]></FromUserName>
      <CreateTime>${Math.floor(Date.now() / 1000)}</CreateTime>
      <MsgType><![CDATA[event]]></MsgType>
      <Event><![CDATA[change_external_contact]]></Event>
      <ChangeType><![CDATA[add_external_contact]]></ChangeType>
      <UserID><![CDATA[${wecomUserId}]]></UserID>
      <ExternalUserID><![CDATA[${externalUserId}]]></ExternalUserID>
      <State><![CDATA[${state}]]></State>
    </xml>`;
    const encryptedEvent = encryptWecomPayload(eventXml);
    const eventQuery = buildSignedQuery(encryptedEvent);
    const callbackResponse = await request.post(`/api/wecom/zhengmu-platform/callback?${eventQuery.toString()}`, {
      data: `<xml><Encrypt><![CDATA[${encryptedEvent}]]></Encrypt></xml>`,
      headers: { "content-type": "application/xml" }
    });
    expect(callbackResponse.status()).toBe(200);
    expect(await callbackResponse.text()).toBe("success");

    const lead = await testPrisma.lead.findFirst({
      where: {
        tenant: { slug: "zhengmu-platform" },
        wechat: externalUserId
      },
      include: { sourceAttribution: true, owner: true }
    });
    expect(lead?.sourceAttribution?.sourceChannel).toBe("企业微信");
    expect(lead?.owner?.email).toBe("platform-sales@zhengmu.local");

    await login(page, "platform-boss@zhengmu.local");
    await page.goto(`/app/zhengmu-platform/leads/${lead?.id}`);
    await expect(page.getByRole("heading", { name: /企微CNAS真实客户/ })).toBeVisible();
    await expect(detailSection(page, "企业微信承接信息")).toContainText(externalUserId);
    await expect(detailSection(page, "企业微信承接信息")).toContainText("已承接");
    await expect(detailSection(page, "来源归因")).toContainText("企业微信");
    await expect(page.getByRole("heading", { name: "CNAS 初步判断", exact: true })).toBeVisible();
    await expect(page.locator("span").filter({ hasText: /^CNAS内容培育跟进$/ })).toBeVisible();

    await page.goto("/app/zhengmu-platform/wecom");
    await expect(page.getByRole("heading", { name: "真实回调事件日志" })).toBeVisible();
    await expect(page.getByText(externalUserId)).toBeVisible();
    const processedEventCard = page.getByTestId("wecom-callback-event").filter({ hasText: externalUserId });
    await expect(processedEventCard.getByText("PROCESSED", { exact: true })).toBeVisible();
  });
});
