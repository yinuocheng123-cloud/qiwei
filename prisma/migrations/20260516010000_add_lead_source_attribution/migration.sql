-- 文件说明：该迁移为 V1.9.2 客户来源归因细化新增独立来源归因表。
-- 功能说明：为 Lead 增加首来源归因记录，支撑活动、页面、二维码、人员、内容和 UTM 的结构化落库。
--
-- 结构概览：
--   第一部分：创建 LeadSourceAttribution 表
--   第二部分：补充唯一约束、索引与外键

CREATE TABLE "LeadSourceAttribution" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "sourceChannel" TEXT,
  "sourceProject" TEXT,
  "sourceCampaign" TEXT,
  "sourceScene" TEXT,
  "sourceTouchpoint" TEXT,
  "sourceQrCode" TEXT,
  "sourceStaffName" TEXT,
  "sourceStaffId" TEXT,
  "sourcePage" TEXT,
  "sourceContent" TEXT,
  "utmSource" TEXT,
  "utmMedium" TEXT,
  "utmCampaign" TEXT,
  "utmContent" TEXT,
  "utmTerm" TEXT,
  "firstSeenAt" TIMESTAMP(3),
  "submittedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "LeadSourceAttribution_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LeadSourceAttribution_leadId_key"
ON "LeadSourceAttribution"("leadId");

CREATE INDEX "LeadSourceAttribution_tenantId_sourceChannel_createdAt_idx"
ON "LeadSourceAttribution"("tenantId", "sourceChannel", "createdAt");

CREATE INDEX "LeadSourceAttribution_tenantId_sourceProject_createdAt_idx"
ON "LeadSourceAttribution"("tenantId", "sourceProject", "createdAt");

CREATE INDEX "LeadSourceAttribution_tenantId_sourceCampaign_createdAt_idx"
ON "LeadSourceAttribution"("tenantId", "sourceCampaign", "createdAt");

CREATE INDEX "LeadSourceAttribution_tenantId_sourceScene_createdAt_idx"
ON "LeadSourceAttribution"("tenantId", "sourceScene", "createdAt");

CREATE INDEX "LeadSourceAttribution_tenantId_sourceStaffId_createdAt_idx"
ON "LeadSourceAttribution"("tenantId", "sourceStaffId", "createdAt");

ALTER TABLE "LeadSourceAttribution"
ADD CONSTRAINT "LeadSourceAttribution_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "LeadSourceAttribution"
ADD CONSTRAINT "LeadSourceAttribution_leadId_fkey"
FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LeadSourceAttribution"
ADD CONSTRAINT "LeadSourceAttribution_sourceStaffId_fkey"
FOREIGN KEY ("sourceStaffId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
