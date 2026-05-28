/*
 * 文件说明：该文件提供 V2.1.3 企业微信内部工作提醒的轻量服务。
 * 功能说明：负责配置掩码、成员绑定读取、内部提醒结果判断、通知日志与审计日志写入。
 *
 * 结构概览：
 *   第一部分：类型、标签与掩码工具
 *   第二部分：配置状态与安全降级判断
 *   第三部分：内部提醒日志写入与审计记录
 */
import { WecomNotificationEventType, WecomNotificationStatus, type Prisma } from "@prisma/client";
import { safeWriteAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

export const wecomNotificationEventTypeLabels: Record<WecomNotificationEventType, string> = {
  TEST_MESSAGE: "测试提醒",
  NEW_LEAD: "新客户提醒",
  OVERDUE_TASK: "逾期任务提醒",
  TRAINING_REVIEW_PENDING: "训练待审核提醒",
  KNOWLEDGE_CANDIDATE_REVIEW_PENDING: "候选知识待审核提醒",
  HIGH_RISK_REPLY: "高风险回复边界提醒",
  SYSTEM_NOTICE: "系统提醒"
};

export const wecomNotificationStatusLabels: Record<WecomNotificationStatus, string> = {
  PENDING: "待发送",
  SENT: "已记录为发送",
  FAILED: "失败",
  SKIPPED: "已跳过"
};

export const wecomNotificationEventTypeOptions = Object.entries(wecomNotificationEventTypeLabels).map(([value, label]) => ({
  value,
  label
}));

export function maskWecomSecret(value?: string | null) {
  if (!value) return "未配置";
  if (value.length <= 6) return "已配置";
  return `${value.slice(0, 3)}***${value.slice(-3)}`;
}

export function buildWecomConfigSummary(config?: {
  corpId?: string | null;
  agentId?: string | null;
  secretEncrypted?: string | null;
  token?: string | null;
  encodingAESKey?: string | null;
  callbackUrl?: string | null;
  status?: string | null;
}) {
  const realCallbackReady = Boolean(
    config?.corpId &&
      config.agentId &&
      config.secretEncrypted &&
      config.token &&
      config.encodingAESKey &&
      config.callbackUrl &&
      config.status === "enabled"
  );
  return {
    hasCorpId: Boolean(config?.corpId),
    hasAgentId: Boolean(config?.agentId),
    hasToken: Boolean(config?.token),
    hasEncodingAESKey: Boolean(config?.encodingAESKey),
    hasCallbackUrl: Boolean(config?.callbackUrl),
    hasSecret: Boolean(config?.secretEncrypted),
    status: config?.status ?? "draft",
    secretMasked: maskWecomSecret(config?.secretEncrypted),
    realCallbackReady,
    realCallbackStatusText: realCallbackReady ? "真实回调可测试" : "真实回调未就绪"
  };
}

type InternalNotificationInput = {
  tenantId: string;
  actorUserId?: string | null;
  recipientUserId?: string | null;
  eventType: WecomNotificationEventType;
  title: string;
  content: string;
  relatedLeadId?: string | null;
  relatedTaskId?: string | null;
  relatedTrainingCaseId?: string | null;
  relatedCandidateId?: string | null;
  relatedReplyDraftId?: string | null;
};

function truncateAuditText(value: string, maxLength = 80) {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength - 3)}...`;
}

function auditActionForStatus(status: WecomNotificationStatus) {
  if (status === "SENT") return "wecom_internal_notification_sent";
  if (status === "FAILED") return "wecom_internal_notification_failed";
  return "wecom_internal_notification_skipped";
}

export async function createWecomInternalNotification(input: InternalNotificationInput) {
  const [config, binding] = await Promise.all([
    prisma.weComConfig.findUnique({ where: { tenantId: input.tenantId } }),
    input.recipientUserId
      ? prisma.userWecomBinding.findUnique({ where: { userId: input.recipientUserId } })
      : Promise.resolve(null)
  ]);

  let status: WecomNotificationStatus = WecomNotificationStatus.PENDING;
  let errorMessage: string | null = null;

  if (!input.recipientUserId) {
    status = WecomNotificationStatus.SKIPPED;
    errorMessage = "未指定接收人，已跳过内部提醒。";
  } else if (!config || config.status !== "enabled") {
    status = WecomNotificationStatus.SKIPPED;
    errorMessage = "企业微信提醒未启用，业务流程不受影响。";
  } else if (!binding?.enabled || !binding.wecomUserId) {
    status = WecomNotificationStatus.SKIPPED;
    errorMessage = "接收人未绑定企业微信成员 ID，已跳过提醒。";
  } else if (!config.corpId || !config.agentId || !config.secretEncrypted) {
    status = WecomNotificationStatus.FAILED;
    errorMessage = "企业微信 CorpId、AgentId 或 Secret 未完整配置。";
  } else if (process.env.WECOM_INTERNAL_NOTIFY_DRY_RUN_SENT === "true") {
    status = WecomNotificationStatus.SENT;
  } else {
    status = WecomNotificationStatus.FAILED;
    errorMessage = "当前版本未接入真实企业微信发送 API，仅记录内部提醒结果。";
  }

  const log = await prisma.wecomNotificationLog.create({
    data: {
      tenantId: input.tenantId,
      eventType: input.eventType,
      recipientUserId: input.recipientUserId,
      recipientWecomUserId: binding?.wecomUserId ?? null,
      title: input.title,
      content: input.content,
      status,
      errorMessage,
      relatedLeadId: input.relatedLeadId,
      relatedTaskId: input.relatedTaskId,
      relatedTrainingCaseId: input.relatedTrainingCaseId,
      relatedCandidateId: input.relatedCandidateId,
      relatedReplyDraftId: input.relatedReplyDraftId,
      sentAt: status === "SENT" ? new Date() : null
    }
  });

  const auditMetadata: Prisma.InputJsonValue = {
    tenantId: input.tenantId,
    userId: input.recipientUserId ?? null,
    eventType: input.eventType,
    status,
    relatedLeadId: input.relatedLeadId ?? null,
    relatedTaskId: input.relatedTaskId ?? null,
    relatedTrainingCaseId: input.relatedTrainingCaseId ?? null,
    relatedCandidateId: input.relatedCandidateId ?? null,
    relatedReplyDraftId: input.relatedReplyDraftId ?? null,
    title: truncateAuditText(input.title),
    errorMessage: errorMessage ? truncateAuditText(errorMessage) : null
  };

  await safeWriteAuditLog({
    tenantId: input.tenantId,
    userId: input.actorUserId ?? undefined,
    action: auditActionForStatus(status),
    entityType: "WecomNotificationLog",
    entityId: log.id,
    metadata: auditMetadata
  });

  return log;
}
