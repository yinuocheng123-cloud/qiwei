/*
 * 文件说明：该文件实现审计日志基础写入工具。
 * 功能说明：统一记录登录、表单、跟进、导出和租户管理等关键动作。
 *
 * 结构概览：
 *   第一部分：导入依赖与类型
 *   第二部分：请求元信息读取
 *   第三部分：审计日志写入
 */
import { headers } from "next/headers";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type AuditInput = {
  tenantId?: string | null;
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Prisma.InputJsonValue;
};

export function getAuditRequestMeta() {
  const headerList = headers();
  const forwardedFor = headerList.get("x-forwarded-for");
  return {
    ip: forwardedFor?.split(",")[0]?.trim() ?? headerList.get("x-real-ip"),
    userAgent: headerList.get("user-agent")
  };
}

export async function writeAuditLog(input: AuditInput) {
  const requestMeta = getAuditRequestMeta();

  await prisma.auditLog.create({
    data: {
      tenantId: input.tenantId ?? undefined,
      userId: input.userId ?? undefined,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? undefined,
      metadata: input.metadata ?? undefined,
      ip: requestMeta.ip,
      userAgent: requestMeta.userAgent
    }
  });
}

export async function safeWriteAuditLog(input: AuditInput) {
  try {
    await writeAuditLog(input);
  } catch (error) {
    console.error("audit log write failed", error);
  }
}
