/*
 * 文件说明：该文件实现 V2.7 企业微信外部联系人回调接口。
 * 功能说明：支持企业微信 URL 验证、签名校验、消息解密、原始事件日志记录和外部联系人新增事件承接。
 *
 * 结构概览：
 *   第一部分：导入依赖与响应工具
 *   第二部分：GET URL 验证
 *   第三部分：POST 事件接收与客户承接
 */
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  decryptWecomMessage,
  extractWecomEncrypt,
  parseWecomEventXml,
  verifyWecomSignature
} from "@/lib/wecom-crypto";
import { intakeWecomExternalContact } from "@/lib/wecom-real-intake";

export const dynamic = "force-dynamic";

function textResponse(text: string, status = 200) {
  return new NextResponse(text, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8" }
  });
}

function getCallbackQuery(request: NextRequest) {
  return {
    msgSignature: request.nextUrl.searchParams.get("msg_signature"),
    timestamp: request.nextUrl.searchParams.get("timestamp"),
    nonce: request.nextUrl.searchParams.get("nonce")
  };
}

async function getEnabledConfig(tenantSlug: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    include: { weComConfig: true }
  });
  if (!tenant || tenant.status !== "active" || !tenant.weComConfig || tenant.weComConfig.status !== "enabled") {
    return null;
  }
  return { tenant, config: tenant.weComConfig };
}

export async function GET(request: NextRequest, { params }: { params: { tenantSlug: string } }) {
  const resolved = await getEnabledConfig(params.tenantSlug);
  if (!resolved) {
    return textResponse("wecom callback config unavailable", 404);
  }

  const echostr = request.nextUrl.searchParams.get("echostr");
  const query = getCallbackQuery(request);
  const signatureValid = verifyWecomSignature({
    token: resolved.config.token,
    msgSignature: query.msgSignature,
    timestamp: query.timestamp,
    nonce: query.nonce,
    encryptedText: echostr
  });
  if (!signatureValid || !echostr) {
    return textResponse("invalid signature", 403);
  }

  try {
    const decrypted = decryptWecomMessage({
      encodingAESKey: resolved.config.encodingAESKey,
      encryptedText: echostr,
      expectedCorpId: resolved.config.corpId
    });
    return textResponse(decrypted.xml);
  } catch (error) {
    return textResponse(error instanceof Error ? error.message : "decrypt failed", 400);
  }
}

export async function POST(request: NextRequest, { params }: { params: { tenantSlug: string } }) {
  const resolved = await getEnabledConfig(params.tenantSlug);
  if (!resolved) {
    return textResponse("wecom callback config unavailable", 404);
  }

  const rawPayload = await request.text();
  const encryptedText = extractWecomEncrypt(rawPayload);
  const query = getCallbackQuery(request);
  const signatureValid = verifyWecomSignature({
    token: resolved.config.token,
    msgSignature: query.msgSignature,
    timestamp: query.timestamp,
    nonce: query.nonce,
    encryptedText
  });

  const eventLog = await prisma.wecomCallbackEvent.create({
    data: {
      tenantId: resolved.tenant.id,
      msgSignature: query.msgSignature,
      timestamp: query.timestamp,
      nonce: query.nonce,
      rawPayload,
      signatureValid,
      processedStatus: signatureValid ? "RECEIVED" : "INVALID_SIGNATURE"
    }
  });

  if (!signatureValid || !encryptedText) {
    await prisma.wecomCallbackEvent.update({
      where: { id: eventLog.id },
      data: {
        errorMessage: !encryptedText ? "回调缺少 Encrypt 字段。" : "企业微信回调签名校验失败。",
        processedAt: new Date()
      }
    });
    return textResponse("invalid signature", 403);
  }

  try {
    const decrypted = decryptWecomMessage({
      encodingAESKey: resolved.config.encodingAESKey,
      encryptedText,
      expectedCorpId: resolved.config.corpId
    });
    const event = parseWecomEventXml(decrypted.xml);
    await prisma.wecomCallbackEvent.update({
      where: { id: eventLog.id },
      data: {
        decryptedPayload: decrypted.xml,
        decrypted: true,
        eventType: event.event,
        changeType: event.changeType,
        externalUserId: event.externalUserId,
        wecomUserId: event.userId,
        state: event.state
      }
    });

    if (event.event === "change_external_contact" && event.changeType === "add_external_contact" && event.externalUserId) {
      const result = await intakeWecomExternalContact({
        tenant: resolved.tenant,
        externalUserId: event.externalUserId,
        wecomUserId: event.userId,
        state: event.state,
        eventId: eventLog.id,
        addedAt: event.createTime ? new Date(Number(event.createTime) * 1000) : new Date()
      });
      await prisma.wecomCallbackEvent.update({
        where: { id: eventLog.id },
        data: {
          relatedLeadId: result.lead.id,
          processedStatus: "PROCESSED",
          processedAt: new Date()
        }
      });
    } else {
      await prisma.wecomCallbackEvent.update({
        where: { id: eventLog.id },
        data: {
          processedStatus: "IGNORED",
          processedAt: new Date(),
          errorMessage: "当前版本只承接 add_external_contact 事件。"
        }
      });
    }

    return textResponse("success");
  } catch (error) {
    await prisma.wecomCallbackEvent.update({
      where: { id: eventLog.id },
      data: {
        processedStatus: "FAILED",
        processedAt: new Date(),
        errorMessage: error instanceof Error ? error.message : "企业微信回调处理失败。"
      }
    });
    return textResponse("failed", 500);
  }
}
