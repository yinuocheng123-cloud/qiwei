-- 文件说明：该迁移为 V2.7 企业微信真实轻接入新增回调事件日志表。
-- 功能说明：记录企业微信 URL 验证和外部联系人新增回调的签名、解密、处理状态与关联客户。
--
-- 结构概览：
--   第一部分：创建 WecomCallbackEvent 表
--   第二部分：创建查询索引

CREATE TABLE "WecomCallbackEvent" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "msgSignature" TEXT,
  "timestamp" TEXT,
  "nonce" TEXT,
  "rawPayload" TEXT,
  "decryptedPayload" TEXT,
  "eventType" TEXT,
  "changeType" TEXT,
  "externalUserId" TEXT,
  "wecomUserId" TEXT,
  "state" TEXT,
  "relatedLeadId" TEXT,
  "signatureValid" BOOLEAN NOT NULL DEFAULT false,
  "decrypted" BOOLEAN NOT NULL DEFAULT false,
  "processedStatus" TEXT NOT NULL DEFAULT 'PENDING',
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),

  CONSTRAINT "WecomCallbackEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WecomCallbackEvent_tenantId_createdAt_idx"
ON "WecomCallbackEvent"("tenantId", "createdAt");

CREATE INDEX "WecomCallbackEvent_tenantId_externalUserId_createdAt_idx"
ON "WecomCallbackEvent"("tenantId", "externalUserId", "createdAt");

CREATE INDEX "WecomCallbackEvent_tenantId_processedStatus_createdAt_idx"
ON "WecomCallbackEvent"("tenantId", "processedStatus", "createdAt");

ALTER TABLE "WecomCallbackEvent"
ADD CONSTRAINT "WecomCallbackEvent_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
