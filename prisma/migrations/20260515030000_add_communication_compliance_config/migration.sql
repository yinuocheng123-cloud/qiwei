-- 文件说明：该迁移用于新增 V1.9.1 沟通素材合规采集配置中心的数据结构。
-- 功能说明：新增采集通道、状态、provider 枚举与 CommunicationComplianceConfig 配置表，支撑企业确认、范围设置、AI 边界与审计。
--
-- 结构概览：
--   第一部分：新增合规采集枚举
--   第二部分：新增合规采集配置表

-- ========== 第一部分：新增合规采集枚举 ==========
CREATE TYPE "CommunicationComplianceChannel" AS ENUM (
  'WECHAT_ARCHIVE',
  'PHONE_RECORDING',
  'ASR_TRANSCRIPTION'
);

CREATE TYPE "CommunicationComplianceStatus" AS ENUM (
  'DISABLED',
  'APPLYING',
  'ENABLED',
  'PAUSED',
  'ARCHIVED'
);

CREATE TYPE "CommunicationComplianceProvider" AS ENUM (
  'MANUAL',
  'WECHAT_ARCHIVE_PLACEHOLDER',
  'PHONE_SYSTEM_PLACEHOLDER',
  'ASR_PROVIDER_PLACEHOLDER',
  'OTHER'
);

-- ========== 第二部分：新增合规采集配置表 ==========
CREATE TABLE "CommunicationComplianceConfig" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "channel" "CommunicationComplianceChannel" NOT NULL,
  "status" "CommunicationComplianceStatus" NOT NULL DEFAULT 'DISABLED',
  "provider" "CommunicationComplianceProvider" NOT NULL DEFAULT 'MANUAL',
  "scopeConfig" JSONB,
  "noticeConfig" JSONB,
  "retentionConfig" JSONB,
  "aiConfig" JSONB,
  "confirmedById" TEXT,
  "confirmedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CommunicationComplianceConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CommunicationComplianceConfig_tenantId_channel_key"
ON "CommunicationComplianceConfig"("tenantId", "channel");

CREATE INDEX "CommunicationComplianceConfig_tenantId_status_updatedAt_idx"
ON "CommunicationComplianceConfig"("tenantId", "status", "updatedAt");

ALTER TABLE "CommunicationComplianceConfig"
ADD CONSTRAINT "CommunicationComplianceConfig_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CommunicationComplianceConfig"
ADD CONSTRAINT "CommunicationComplianceConfig_confirmedById_fkey"
FOREIGN KEY ("confirmedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
