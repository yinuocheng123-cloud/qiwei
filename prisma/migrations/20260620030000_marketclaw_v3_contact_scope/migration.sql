-- 文件说明：补齐历史 migration 链中缺失的 MarketClaw V3 企业、联系人和业务归属结构。
-- 关键约束：BusinessLine 必须先按租户回填企业归属和稳定 key，再收紧为 NOT NULL。

CREATE TYPE "EnterpriseStatus" AS ENUM ('ACTIVE', 'PAUSED');

ALTER TYPE "CustomerType" ADD VALUE IF NOT EXISTS 'CNAS_LAB_OWNER';
ALTER TYPE "CustomerType" ADD VALUE IF NOT EXISTS 'CNAS_BUSINESS_OWNER';
ALTER TYPE "CustomerType" ADD VALUE IF NOT EXISTS 'CNAS_QUALITY_OWNER';
ALTER TYPE "CustomerType" ADD VALUE IF NOT EXISTS 'CNAS_TECH_OWNER';
ALTER TYPE "CustomerType" ADD VALUE IF NOT EXISTS 'CNAS_TESTING_AGENCY';
ALTER TYPE "CustomerType" ADD VALUE IF NOT EXISTS 'CNAS_CONSULTING_INTENT';
ALTER TYPE "CustomerType" ADD VALUE IF NOT EXISTS 'ZHENGMU_FACTORY_OWNER';
ALTER TYPE "CustomerType" ADD VALUE IF NOT EXISTS 'ZHENGMU_GEO_INTENT';
ALTER TYPE "CustomerType" ADD VALUE IF NOT EXISTS 'ZHENGMU_MEMBERSHIP_INTENT';
ALTER TYPE "CustomerType" ADD VALUE IF NOT EXISTS 'ZHENGMU_STORE_CLIENT';
ALTER TYPE "CustomerType" ADD VALUE IF NOT EXISTS 'ZHENGMU_SUPPLIER_CLIENT';
ALTER TYPE "CustomerType" ADD VALUE IF NOT EXISTS 'ZHENGMU_TIANTUAN_CLIENT';
ALTER TYPE "CustomerType" ADD VALUE IF NOT EXISTS 'YOUXI_FLOORING_CLIENT';
ALTER TYPE "CustomerType" ADD VALUE IF NOT EXISTS 'YOUXI_WHOLE_HOME_CLIENT';
ALTER TYPE "CustomerType" ADD VALUE IF NOT EXISTS 'YOUXI_FURNITURE_CLIENT';
ALTER TYPE "CustomerType" ADD VALUE IF NOT EXISTS 'YOUXI_DESIGNER_CLIENT';
ALTER TYPE "CustomerType" ADD VALUE IF NOT EXISTS 'YOUXI_VENDOR_CLIENT';
ALTER TYPE "CustomerType" ADD VALUE IF NOT EXISTS 'YOUXI_COMMUNITY_CLIENT';

CREATE TABLE "Enterprise" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT,
    "status" "EnterpriseStatus" NOT NULL DEFAULT 'ACTIVE',
    "sortOrder" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Enterprise_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "enterpriseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "company" TEXT,
    "phone" TEXT NOT NULL,
    "wechat" TEXT,
    "city" TEXT,
    "industry" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "AuditLog" ADD COLUMN "enterpriseId" TEXT;

-- 先以 nullable 形式新增字段，避免历史 BusinessLine 数据阻断 migration。
ALTER TABLE "BusinessLine"
ADD COLUMN "enterpriseId" TEXT,
ADD COLUMN "key" TEXT;

-- 按租户和业务线归属补建 Enterprise；确定性 id 让同一租户和 enterprise key 始终得到相同结果。
WITH "enterpriseScopes" AS (
    SELECT DISTINCT
        "tenantId",
        CASE
            WHEN LOWER(COALESCE(NULLIF("slug", ''), "id")) = 'cnas' THEN 'hangyu'
            WHEN LOWER(COALESCE(NULLIF("slug", ''), "id")) IN ('zhengmu', 'youxi') THEN 'youshi'
            ELSE 'legacy'
        END AS "enterpriseKey"
    FROM "BusinessLine"
)
INSERT INTO "Enterprise" (
    "id",
    "tenantId",
    "name",
    "key",
    "description",
    "updatedAt"
)
SELECT
    'ent_' || md5("tenantId" || ':' || "enterpriseKey"),
    "tenantId",
    CASE
        WHEN "enterpriseKey" = 'hangyu' THEN '杭育公司'
        WHEN "enterpriseKey" = 'youshi' THEN '优势文化'
        ELSE '历史企业空间'
    END,
    "enterpriseKey",
    '由 V3 migration 为存量业务线补建',
    CURRENT_TIMESTAMP
FROM "enterpriseScopes"
ON CONFLICT ("id") DO NOTHING;

-- 优先沿用历史 slug；仅在 slug 为空时回退到 BusinessLine id，确保 tenant 内 key 可用且稳定。
UPDATE "BusinessLine"
SET "key" = COALESCE(NULLIF("slug", ''), "id")
WHERE "key" IS NULL;

-- 按相同映射回填企业归属，未知历史业务线统一进入 tenant 自己的 legacy 企业空间。
UPDATE "BusinessLine"
SET "enterpriseId" = 'ent_' || md5(
    "tenantId" || ':' ||
    CASE
        WHEN LOWER("key") = 'cnas' THEN 'hangyu'
        WHEN LOWER("key") IN ('zhengmu', 'youxi') THEN 'youshi'
        ELSE 'legacy'
    END
)
WHERE "enterpriseId" IS NULL;

-- 所有存量记录完成回填后再恢复 schema.prisma 要求的非空约束。
ALTER TABLE "BusinessLine" ALTER COLUMN "enterpriseId" SET NOT NULL;
ALTER TABLE "BusinessLine" ALTER COLUMN "key" SET NOT NULL;

ALTER TABLE "CustomerTypeStrategy"
ADD COLUMN "businessLineId" TEXT,
ADD COLUMN "enterpriseId" TEXT;

ALTER TABLE "FollowTask"
ADD COLUMN "businessLineId" TEXT,
ADD COLUMN "enterpriseId" TEXT;

ALTER TABLE "FollowUp"
ADD COLUMN "businessLineId" TEXT,
ADD COLUMN "enterpriseId" TEXT;

ALTER TABLE "IntakeForm"
ADD COLUMN "businessLineId" TEXT,
ADD COLUMN "contactId" TEXT,
ADD COLUMN "enterpriseId" TEXT;

ALTER TABLE "Lead"
ADD COLUMN "businessLineId" TEXT,
ADD COLUMN "contactId" TEXT,
ADD COLUMN "enterpriseId" TEXT;

ALTER TABLE "LeadSourceAttribution"
ADD COLUMN "businessLineId" TEXT,
ADD COLUMN "enterpriseId" TEXT;

ALTER TABLE "Material"
ADD COLUMN "businessLineId" TEXT,
ADD COLUMN "enterpriseId" TEXT;

ALTER TABLE "TaskTemplate"
ADD COLUMN "businessLineId" TEXT,
ADD COLUMN "enterpriseId" TEXT;

CREATE INDEX "Enterprise_tenantId_status_sortOrder_idx" ON "Enterprise"("tenantId", "status", "sortOrder");
CREATE UNIQUE INDEX "Enterprise_tenantId_key_key" ON "Enterprise"("tenantId", "key");
CREATE INDEX "Contact_tenantId_enterpriseId_name_idx" ON "Contact"("tenantId", "enterpriseId", "name");
CREATE INDEX "Contact_tenantId_phone_idx" ON "Contact"("tenantId", "phone");
CREATE INDEX "AuditLog_tenantId_enterpriseId_createdAt_idx" ON "AuditLog"("tenantId", "enterpriseId", "createdAt");
CREATE UNIQUE INDEX "BusinessLine_tenantId_key_key" ON "BusinessLine"("tenantId", "key");
CREATE INDEX "CustomerTypeStrategy_tenantId_enterpriseId_businessLineId_c_idx" ON "CustomerTypeStrategy"("tenantId", "enterpriseId", "businessLineId", "customerType");
CREATE INDEX "FollowTask_tenantId_enterpriseId_businessLineId_status_dueA_idx" ON "FollowTask"("tenantId", "enterpriseId", "businessLineId", "status", "dueAt");
CREATE INDEX "FollowUp_tenantId_enterpriseId_businessLineId_createdAt_idx" ON "FollowUp"("tenantId", "enterpriseId", "businessLineId", "createdAt");
CREATE INDEX "IntakeForm_tenantId_enterpriseId_businessLineId_createdAt_idx" ON "IntakeForm"("tenantId", "enterpriseId", "businessLineId", "createdAt");
CREATE INDEX "Lead_tenantId_enterpriseId_businessLineId_createdAt_idx" ON "Lead"("tenantId", "enterpriseId", "businessLineId", "createdAt");
CREATE INDEX "LeadSourceAttribution_tenantId_enterpriseId_businessLineId__idx" ON "LeadSourceAttribution"("tenantId", "enterpriseId", "businessLineId", "createdAt");
CREATE INDEX "Material_tenantId_enterpriseId_businessLineId_customerType_idx" ON "Material"("tenantId", "enterpriseId", "businessLineId", "customerType");
CREATE INDEX "TaskTemplate_tenantId_enterpriseId_businessLineId_isActive_idx" ON "TaskTemplate"("tenantId", "enterpriseId", "businessLineId", "isActive");

ALTER TABLE "Enterprise" ADD CONSTRAINT "Enterprise_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_enterpriseId_fkey" FOREIGN KEY ("enterpriseId") REFERENCES "Enterprise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_enterpriseId_fkey" FOREIGN KEY ("enterpriseId") REFERENCES "Enterprise"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_businessLineId_fkey" FOREIGN KEY ("businessLineId") REFERENCES "BusinessLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_enterpriseId_fkey" FOREIGN KEY ("enterpriseId") REFERENCES "Enterprise"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_businessLineId_fkey" FOREIGN KEY ("businessLineId") REFERENCES "BusinessLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CustomerTypeStrategy" ADD CONSTRAINT "CustomerTypeStrategy_enterpriseId_fkey" FOREIGN KEY ("enterpriseId") REFERENCES "Enterprise"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CustomerTypeStrategy" ADD CONSTRAINT "CustomerTypeStrategy_businessLineId_fkey" FOREIGN KEY ("businessLineId") REFERENCES "BusinessLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Material" ADD CONSTRAINT "Material_enterpriseId_fkey" FOREIGN KEY ("enterpriseId") REFERENCES "Enterprise"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Material" ADD CONSTRAINT "Material_businessLineId_fkey" FOREIGN KEY ("businessLineId") REFERENCES "BusinessLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BusinessLine" ADD CONSTRAINT "BusinessLine_enterpriseId_fkey" FOREIGN KEY ("enterpriseId") REFERENCES "Enterprise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "IntakeForm" ADD CONSTRAINT "IntakeForm_enterpriseId_fkey" FOREIGN KEY ("enterpriseId") REFERENCES "Enterprise"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "IntakeForm" ADD CONSTRAINT "IntakeForm_businessLineId_fkey" FOREIGN KEY ("businessLineId") REFERENCES "BusinessLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "IntakeForm" ADD CONSTRAINT "IntakeForm_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LeadSourceAttribution" ADD CONSTRAINT "LeadSourceAttribution_enterpriseId_fkey" FOREIGN KEY ("enterpriseId") REFERENCES "Enterprise"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LeadSourceAttribution" ADD CONSTRAINT "LeadSourceAttribution_businessLineId_fkey" FOREIGN KEY ("businessLineId") REFERENCES "BusinessLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_enterpriseId_fkey" FOREIGN KEY ("enterpriseId") REFERENCES "Enterprise"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FollowTask" ADD CONSTRAINT "FollowTask_enterpriseId_fkey" FOREIGN KEY ("enterpriseId") REFERENCES "Enterprise"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FollowTask" ADD CONSTRAINT "FollowTask_businessLineId_fkey" FOREIGN KEY ("businessLineId") REFERENCES "BusinessLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TaskTemplate" ADD CONSTRAINT "TaskTemplate_enterpriseId_fkey" FOREIGN KEY ("enterpriseId") REFERENCES "Enterprise"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TaskTemplate" ADD CONSTRAINT "TaskTemplate_businessLineId_fkey" FOREIGN KEY ("businessLineId") REFERENCES "BusinessLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;
