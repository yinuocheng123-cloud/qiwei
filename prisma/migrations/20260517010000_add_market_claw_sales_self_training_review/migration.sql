-- 文件说明：该迁移为 V2.0.5 补充销售自我训练、训练审核、个人话术与知识分层字段。
-- 功能说明：在现有 Market Claw 模型基础上增量扩展训练分层、审核状态、部门维度和个人话术闭环。

CREATE TYPE "MarketClawKnowledgeScopeLevel" AS ENUM (
  'ENTERPRISE',
  'DEPARTMENT',
  'BUSINESS_LINE',
  'PERSONAL',
  'PLATFORM_TEMPLATE'
);

CREATE TYPE "MarketClawKnowledgeVisibility" AS ENUM ('PRIVATE', 'DEPARTMENT', 'TENANT');

CREATE TYPE "MarketClawKnowledgeReviewStatus" AS ENUM (
  'DRAFT',
  'PENDING_REVIEW',
  'APPROVED',
  'REJECTED',
  'PAUSED',
  'ARCHIVED'
);

CREATE TYPE "MarketClawTrainingScope" AS ENUM (
  'ENTERPRISE_TRAINING',
  'DEPARTMENT_TRAINING',
  'BUSINESS_LINE_TRAINING',
  'SALES_SELF_TRAINING'
);

CREATE TYPE "MarketClawReplySourceScope" AS ENUM ('CUSTOMER_REPLY', 'TRAINING', 'PERSONAL_LIBRARY');

CREATE TYPE "MarketClawReviewResult" AS ENUM (
  'NONE',
  'ADOPT_AS_PERSONAL',
  'ADOPT_AS_TEAM',
  'ADOPT_AS_ENTERPRISE',
  'REJECTED'
);

ALTER TYPE "MarketClawTrainingReviewStatus" RENAME TO "MarketClawTrainingReviewStatus_old";

CREATE TYPE "MarketClawTrainingReviewStatus" AS ENUM (
  'DRAFT',
  'GENERATED',
  'PERSONAL_SAVED',
  'PENDING_REVIEW',
  'TEAM_APPROVED',
  'ENTERPRISE_APPROVED',
  'REJECTED',
  'DISMISSED'
);

ALTER TABLE "MarketClawKnowledgeItem"
ALTER COLUMN "businessLineId" DROP NOT NULL;

ALTER TABLE "MarketClawTrainingCase"
ALTER COLUMN "businessLineId" DROP NOT NULL;

ALTER TABLE "MarketClawTrainingCase"
RENAME COLUMN "savedAsKnowledgeItemId" TO "promotedKnowledgeItemId";

ALTER TABLE "MarketClawTrainingCase"
ALTER COLUMN "reviewStatus" DROP DEFAULT;

ALTER TABLE "MarketClawTrainingCase"
ALTER COLUMN "reviewStatus" TYPE "MarketClawTrainingReviewStatus"
USING (
  CASE "reviewStatus"::text
    WHEN 'DRAFT' THEN 'DRAFT'
    WHEN 'GENERATED' THEN 'GENERATED'
    WHEN 'REVIEWED' THEN 'PENDING_REVIEW'
    WHEN 'SAVED_AS_STANDARD' THEN 'ENTERPRISE_APPROVED'
    WHEN 'DISMISSED' THEN 'DISMISSED'
    ELSE 'DRAFT'
  END
)::"MarketClawTrainingReviewStatus";

ALTER TABLE "MarketClawTrainingCase"
ALTER COLUMN "reviewStatus" SET DEFAULT 'DRAFT';

DROP TYPE "MarketClawTrainingReviewStatus_old";

ALTER TABLE "MarketClawKnowledgeItem"
ADD COLUMN "ownerUserId" TEXT,
ADD COLUMN "departmentName" TEXT,
ADD COLUMN "scopeLevel" "MarketClawKnowledgeScopeLevel" NOT NULL DEFAULT 'BUSINESS_LINE',
ADD COLUMN "visibility" "MarketClawKnowledgeVisibility" NOT NULL DEFAULT 'TENANT',
ADD COLUMN "reviewStatus" "MarketClawKnowledgeReviewStatus" NOT NULL DEFAULT 'APPROVED',
ADD COLUMN "approvedById" TEXT,
ADD COLUMN "approvedAt" TIMESTAMP(3),
ADD COLUMN "sourceTrainingCaseId" TEXT;

ALTER TABLE "MarketClawTrainingCase"
ADD COLUMN "ownerUserId" TEXT,
ADD COLUMN "departmentName" TEXT,
ADD COLUMN "trainingScope" "MarketClawTrainingScope" NOT NULL DEFAULT 'BUSINESS_LINE_TRAINING',
ADD COLUMN "salesNote" TEXT,
ADD COLUMN "submittedForReviewAt" TIMESTAMP(3),
ADD COLUMN "reviewedById" TEXT,
ADD COLUMN "reviewedAt" TIMESTAMP(3),
ADD COLUMN "reviewComment" TEXT;

ALTER TABLE "MarketClawReplyDraft"
ADD COLUMN "departmentName" TEXT,
ADD COLUMN "trainingCaseId" TEXT,
ADD COLUMN "sourceScope" "MarketClawReplySourceScope" NOT NULL DEFAULT 'CUSTOMER_REPLY',
ADD COLUMN "usedPersonalKnowledgeIds" JSONB,
ADD COLUMN "usedDepartmentKnowledgeIds" JSONB,
ADD COLUMN "usedEnterpriseKnowledgeIds" JSONB,
ADD COLUMN "submittedForReviewAt" TIMESTAMP(3);

ALTER TABLE "MarketClawReplyFeedback"
ADD COLUMN "departmentName" TEXT,
ADD COLUMN "submittedToReview" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "reviewedById" TEXT,
ADD COLUMN "reviewedAt" TIMESTAMP(3),
ADD COLUMN "reviewResult" "MarketClawReviewResult" NOT NULL DEFAULT 'NONE',
ADD COLUMN "reviewComment" TEXT;

UPDATE "MarketClawKnowledgeItem"
SET
  "scopeLevel" = CASE WHEN "businessLineId" IS NULL THEN 'ENTERPRISE'::"MarketClawKnowledgeScopeLevel" ELSE 'BUSINESS_LINE'::"MarketClawKnowledgeScopeLevel" END,
  "visibility" = 'TENANT'::"MarketClawKnowledgeVisibility",
  "reviewStatus" = CASE
    WHEN "status" = 'ACTIVE' THEN 'APPROVED'::"MarketClawKnowledgeReviewStatus"
    WHEN "status" = 'PAUSED' THEN 'PAUSED'::"MarketClawKnowledgeReviewStatus"
    ELSE 'ARCHIVED'::"MarketClawKnowledgeReviewStatus"
  END;

UPDATE "MarketClawTrainingCase"
SET
  "ownerUserId" = "createdById",
  "trainingScope" = CASE WHEN "businessLineId" IS NULL THEN 'ENTERPRISE_TRAINING'::"MarketClawTrainingScope" ELSE 'BUSINESS_LINE_TRAINING'::"MarketClawTrainingScope" END;

UPDATE "MarketClawReplyDraft"
SET
  "sourceScope" = 'CUSTOMER_REPLY'::"MarketClawReplySourceScope",
  "usedPersonalKnowledgeIds" = '[]'::jsonb,
  "usedDepartmentKnowledgeIds" = '[]'::jsonb,
  "usedEnterpriseKnowledgeIds" = COALESCE("matchedKnowledgeIds", '[]'::jsonb);

CREATE INDEX "MarketClawKnowledgeItem_tenantId_scopeLevel_reviewStatus_up_idx"
ON "MarketClawKnowledgeItem"("tenantId", "scopeLevel", "reviewStatus", "updatedAt");

CREATE INDEX "MarketClawKnowledgeItem_tenantId_departmentName_reviewStatus_idx"
ON "MarketClawKnowledgeItem"("tenantId", "departmentName", "reviewStatus", "updatedAt");

CREATE INDEX "MarketClawKnowledgeItem_tenantId_ownerUserId_reviewStatus_idx"
ON "MarketClawKnowledgeItem"("tenantId", "ownerUserId", "reviewStatus", "updatedAt");

CREATE INDEX "MarketClawTrainingCase_tenantId_ownerUserId_reviewStatus_idx"
ON "MarketClawTrainingCase"("tenantId", "ownerUserId", "reviewStatus", "updatedAt");

CREATE INDEX "MarketClawTrainingCase_tenantId_departmentName_reviewStatus_idx"
ON "MarketClawTrainingCase"("tenantId", "departmentName", "reviewStatus", "updatedAt");

CREATE INDEX "MarketClawTrainingCase_tenantId_trainingScope_reviewStatus_idx"
ON "MarketClawTrainingCase"("tenantId", "trainingScope", "reviewStatus", "updatedAt");

CREATE INDEX "MarketClawReplyDraft_tenantId_departmentName_sourceScope_idx"
ON "MarketClawReplyDraft"("tenantId", "departmentName", "sourceScope", "createdAt");

CREATE INDEX "MarketClawReplyDraft_tenantId_trainingCaseId_createdAt_idx"
ON "MarketClawReplyDraft"("tenantId", "trainingCaseId", "createdAt");

CREATE INDEX "MarketClawReplyFeedback_tenantId_reviewResult_createdAt_idx"
ON "MarketClawReplyFeedback"("tenantId", "reviewResult", "createdAt");

ALTER TABLE "MarketClawReplyDraft"
ADD CONSTRAINT "MarketClawReplyDraft_trainingCaseId_fkey"
FOREIGN KEY ("trainingCaseId") REFERENCES "MarketClawTrainingCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;
