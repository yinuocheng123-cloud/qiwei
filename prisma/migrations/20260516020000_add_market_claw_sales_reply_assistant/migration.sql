-- 文件说明：该迁移为 V2.0 麻虾 Market Claw 补充知识、训练、回复草稿与反馈模型。
-- 功能说明：落地规则型销售智能回复助手的数据结构，并把回复草稿与 FollowUp 建立可追踪关联。

CREATE TYPE "MarketClawKnowledgeType" AS ENUM (
  'SERVICE_INTRO',
  'FAQ',
  'STANDARD_REPLY',
  'CASE_STUDY',
  'PRICE_BOUNDARY',
  'DELIVERY_PROCESS',
  'OBJECTION_HANDLING',
  'FORBIDDEN_COMMITMENT',
  'RISK_NOTICE',
  'SALES_SCRIPT',
  'OTHER'
);

CREATE TYPE "MarketClawKnowledgeStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ARCHIVED');
CREATE TYPE "MarketClawTrainingRating" AS ENUM ('GOOD', 'NEEDS_EDIT', 'BAD', 'UNRATED');
CREATE TYPE "MarketClawTrainingReviewStatus" AS ENUM ('DRAFT', 'GENERATED', 'REVIEWED', 'SAVED_AS_STANDARD', 'DISMISSED');
CREATE TYPE "MarketClawReplyUseStatus" AS ENUM ('GENERATED', 'COPIED', 'SAVED_AS_FOLLOWUP', 'DISMISSED');
CREATE TYPE "MarketClawFeedbackStatus" AS ENUM ('USEFUL', 'NOT_USEFUL', 'NEEDS_EDIT', 'UNRATED');

ALTER TABLE "FollowUp" ADD COLUMN "marketClawReplyDraftId" TEXT;

CREATE TABLE "MarketClawKnowledgeItem" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "businessLineId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "updatedById" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "knowledgeType" "MarketClawKnowledgeType" NOT NULL,
  "status" "MarketClawKnowledgeStatus" NOT NULL DEFAULT 'ACTIVE',
  "keywords" JSONB,
  "applicableCustomerTypes" JSONB,
  "applicableStages" JSONB,
  "recommendedMaterialIds" JSONB,
  "forbiddenPhrases" JSONB,
  "riskNotes" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 100,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MarketClawKnowledgeItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MarketClawTrainingCase" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "businessLineId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "customerQuestion" TEXT NOT NULL,
  "customerType" "CustomerType",
  "customerStage" "LeadStage",
  "customerTags" JSONB,
  "replyStyle" TEXT,
  "replyLength" TEXT,
  "generatedShortReply" TEXT,
  "generatedProfessionalReply" TEXT,
  "generatedClosingReply" TEXT,
  "manualOptimizedReply" TEXT,
  "rating" "MarketClawTrainingRating" NOT NULL DEFAULT 'UNRATED',
  "reviewStatus" "MarketClawTrainingReviewStatus" NOT NULL DEFAULT 'DRAFT',
  "forbiddenNotes" TEXT,
  "savedAsKnowledgeItemId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MarketClawTrainingCase_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MarketClawReplyDraft" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "businessLineId" TEXT,
  "createdById" TEXT NOT NULL,
  "customerQuestion" TEXT NOT NULL,
  "matchedKnowledgeIds" JSONB,
  "shortReply" TEXT,
  "professionalReply" TEXT,
  "closingReply" TEXT,
  "riskWarnings" JSONB,
  "suggestedTags" JSONB,
  "suggestedMaterials" JSONB,
  "suggestedTask" JSONB,
  "selectedReplyType" TEXT,
  "finalReply" TEXT,
  "useStatus" "MarketClawReplyUseStatus" NOT NULL DEFAULT 'GENERATED',
  "feedbackStatus" "MarketClawFeedbackStatus" NOT NULL DEFAULT 'UNRATED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MarketClawReplyDraft_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MarketClawReplyFeedback" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "replyDraftId" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "feedbackStatus" "MarketClawFeedbackStatus" NOT NULL,
  "feedbackNote" TEXT,
  "salesEditedReply" TEXT,
  "recommendAsTrainingCase" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MarketClawReplyFeedback_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MarketClawKnowledgeItem_tenantId_businessLineId_knowledgeType_sta_idx"
ON "MarketClawKnowledgeItem"("tenantId", "businessLineId", "knowledgeType", "status");

CREATE INDEX "MarketClawKnowledgeItem_tenantId_status_updatedAt_idx"
ON "MarketClawKnowledgeItem"("tenantId", "status", "updatedAt");

CREATE INDEX "MarketClawTrainingCase_tenantId_businessLineId_createdAt_idx"
ON "MarketClawTrainingCase"("tenantId", "businessLineId", "createdAt");

CREATE INDEX "MarketClawTrainingCase_tenantId_createdById_createdAt_idx"
ON "MarketClawTrainingCase"("tenantId", "createdById", "createdAt");

CREATE INDEX "MarketClawReplyDraft_tenantId_leadId_createdById_createdAt_idx"
ON "MarketClawReplyDraft"("tenantId", "leadId", "createdById", "createdAt");

CREATE INDEX "MarketClawReplyDraft_tenantId_createdAt_idx"
ON "MarketClawReplyDraft"("tenantId", "createdAt");

CREATE INDEX "MarketClawReplyFeedback_tenantId_replyDraftId_createdAt_idx"
ON "MarketClawReplyFeedback"("tenantId", "replyDraftId", "createdAt");

CREATE INDEX "MarketClawReplyFeedback_tenantId_createdById_createdAt_idx"
ON "MarketClawReplyFeedback"("tenantId", "createdById", "createdAt");

ALTER TABLE "FollowUp"
ADD CONSTRAINT "FollowUp_marketClawReplyDraftId_fkey"
FOREIGN KEY ("marketClawReplyDraftId") REFERENCES "MarketClawReplyDraft"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MarketClawKnowledgeItem"
ADD CONSTRAINT "MarketClawKnowledgeItem_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MarketClawKnowledgeItem"
ADD CONSTRAINT "MarketClawKnowledgeItem_businessLineId_fkey"
FOREIGN KEY ("businessLineId") REFERENCES "BusinessLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MarketClawKnowledgeItem"
ADD CONSTRAINT "MarketClawKnowledgeItem_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MarketClawKnowledgeItem"
ADD CONSTRAINT "MarketClawKnowledgeItem_updatedById_fkey"
FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MarketClawTrainingCase"
ADD CONSTRAINT "MarketClawTrainingCase_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MarketClawTrainingCase"
ADD CONSTRAINT "MarketClawTrainingCase_businessLineId_fkey"
FOREIGN KEY ("businessLineId") REFERENCES "BusinessLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MarketClawTrainingCase"
ADD CONSTRAINT "MarketClawTrainingCase_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MarketClawTrainingCase"
ADD CONSTRAINT "MarketClawTrainingCase_savedAsKnowledgeItemId_fkey"
FOREIGN KEY ("savedAsKnowledgeItemId") REFERENCES "MarketClawKnowledgeItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MarketClawReplyDraft"
ADD CONSTRAINT "MarketClawReplyDraft_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MarketClawReplyDraft"
ADD CONSTRAINT "MarketClawReplyDraft_leadId_fkey"
FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MarketClawReplyDraft"
ADD CONSTRAINT "MarketClawReplyDraft_businessLineId_fkey"
FOREIGN KEY ("businessLineId") REFERENCES "BusinessLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MarketClawReplyDraft"
ADD CONSTRAINT "MarketClawReplyDraft_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MarketClawReplyFeedback"
ADD CONSTRAINT "MarketClawReplyFeedback_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MarketClawReplyFeedback"
ADD CONSTRAINT "MarketClawReplyFeedback_replyDraftId_fkey"
FOREIGN KEY ("replyDraftId") REFERENCES "MarketClawReplyDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MarketClawReplyFeedback"
ADD CONSTRAINT "MarketClawReplyFeedback_leadId_fkey"
FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MarketClawReplyFeedback"
ADD CONSTRAINT "MarketClawReplyFeedback_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
