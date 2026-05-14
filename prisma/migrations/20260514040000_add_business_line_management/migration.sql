-- 文件说明：该迁移用于新增 V1.7 业务线／产品管理的数据结构。
-- 功能说明：补充 BusinessLine 状态、分类枚举，以及租户级业务线表。

-- ========== 第一部分：新增业务线枚举 ==========
CREATE TYPE "BusinessLineStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ARCHIVED');

CREATE TYPE "BusinessLineCategory" AS ENUM (
  'SERVICE',
  'PRODUCT',
  'ACTIVITY',
  'COURSE',
  'SUPPLY_CHAIN',
  'MEMBERSHIP',
  'PARTNERSHIP',
  'OTHER'
);

-- ========== 第二部分：新增业务线表 ==========
CREATE TABLE "BusinessLine" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "status" "BusinessLineStatus" NOT NULL DEFAULT 'ACTIVE',
  "category" "BusinessLineCategory" NOT NULL DEFAULT 'OTHER',
  "priority" INTEGER NOT NULL DEFAULT 100,
  "targetCustomerTypes" JSONB,
  "recommendedTagNames" JSONB,
  "recommendedMaterialIds" JSONB,
  "recommendedTaskTemplateIds" JSONB,
  "defaultNextAction" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "BusinessLine_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BusinessLine_tenantId_slug_key" ON "BusinessLine"("tenantId", "slug");
CREATE INDEX "BusinessLine_tenantId_status_priority_idx" ON "BusinessLine"("tenantId", "status", "priority");

ALTER TABLE "BusinessLine"
ADD CONSTRAINT "BusinessLine_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
