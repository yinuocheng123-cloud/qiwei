-- 文件说明：该迁移用于新增 V1.8 客户导入能力所需的批次、行记录和枚举补充。
-- 功能说明：补充导入来源、标签分组与导入批次/导入行数据结构，支撑预览、去重、导入结果追踪和审计。

-- ========== 第一部分：补充现有枚举 ==========
ALTER TYPE "LeadSource" ADD VALUE IF NOT EXISTS 'imported';
ALTER TYPE "TagGroup" ADD VALUE IF NOT EXISTS 'BUSINESS_LINE';
ALTER TYPE "TagGroup" ADD VALUE IF NOT EXISTS 'IMPORTED';

-- ========== 第二部分：新增导入状态枚举 ==========
CREATE TYPE "ImportBatchStatus" AS ENUM (
  'PENDING',
  'PREVIEWED',
  'COMPLETED',
  'FAILED',
  'CANCELLED'
);

CREATE TYPE "ImportRowStatus" AS ENUM (
  'PENDING',
  'IMPORTED',
  'FAILED',
  'DUPLICATE',
  'SKIPPED'
);

-- ========== 第三部分：新增导入批次表 ==========
CREATE TABLE "ImportBatch" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "fileType" TEXT NOT NULL,
  "status" "ImportBatchStatus" NOT NULL DEFAULT 'PENDING',
  "totalRows" INTEGER NOT NULL DEFAULT 0,
  "successRows" INTEGER NOT NULL DEFAULT 0,
  "failedRows" INTEGER NOT NULL DEFAULT 0,
  "duplicateRows" INTEGER NOT NULL DEFAULT 0,
  "skippedRows" INTEGER NOT NULL DEFAULT 0,
  "generatedTaskRows" INTEGER NOT NULL DEFAULT 0,
  "mapping" JSONB,
  "defaultOwnerId" TEXT,
  "defaultTags" JSONB,
  "defaultBusinessLineIds" JSONB,
  "autoCreateFirstTask" BOOLEAN NOT NULL DEFAULT false,
  "skipDuplicates" BOOLEAN NOT NULL DEFAULT true,
  "errorSummary" JSONB,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ImportBatch_tenantId_createdAt_idx" ON "ImportBatch"("tenantId", "createdAt");
CREATE INDEX "ImportBatch_tenantId_status_createdAt_idx" ON "ImportBatch"("tenantId", "status", "createdAt");

ALTER TABLE "ImportBatch"
ADD CONSTRAINT "ImportBatch_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ImportBatch"
ADD CONSTRAINT "ImportBatch_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ========== 第四部分：新增导入行表 ==========
CREATE TABLE "ImportRow" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "batchId" TEXT NOT NULL,
  "rowIndex" INTEGER NOT NULL,
  "rawData" JSONB NOT NULL,
  "normalizedData" JSONB,
  "status" "ImportRowStatus" NOT NULL DEFAULT 'PENDING',
  "leadId" TEXT,
  "errorMessage" TEXT,
  "duplicateLeadId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ImportRow_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ImportRow_tenantId_batchId_rowIndex_idx" ON "ImportRow"("tenantId", "batchId", "rowIndex");
CREATE INDEX "ImportRow_tenantId_status_createdAt_idx" ON "ImportRow"("tenantId", "status", "createdAt");

ALTER TABLE "ImportRow"
ADD CONSTRAINT "ImportRow_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ImportRow"
ADD CONSTRAINT "ImportRow_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ImportRow"
ADD CONSTRAINT "ImportRow_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
