-- CreateEnum
CREATE TYPE "MarketClawReplyRiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'BLOCKED');

-- CreateEnum
CREATE TYPE "MarketClawSendMode" AS ENUM ('AUTO_ALLOWED', 'SALES_CONFIRM_REQUIRED', 'RISK_CONFIRM_REQUIRED', 'INTERNAL_ADVICE_ONLY');

-- AlterTable
ALTER TABLE "MarketClawKnowledgeItem"
ADD COLUMN "replyRiskLevel" "MarketClawReplyRiskLevel" NOT NULL DEFAULT 'MEDIUM',
ADD COLUMN "sendMode" "MarketClawSendMode" NOT NULL DEFAULT 'SALES_CONFIRM_REQUIRED',
ADD COLUMN "riskReason" TEXT,
ADD COLUMN "requiresReview" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "internalOnlyNote" TEXT;

-- AlterTable
ALTER TABLE "MarketClawTrainingCase"
ADD COLUMN "replyRiskLevel" "MarketClawReplyRiskLevel" NOT NULL DEFAULT 'MEDIUM',
ADD COLUMN "sendMode" "MarketClawSendMode" NOT NULL DEFAULT 'SALES_CONFIRM_REQUIRED',
ADD COLUMN "riskReason" TEXT,
ADD COLUMN "requiresReview" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "internalOnlyNote" TEXT;

-- AlterTable
ALTER TABLE "MarketClawReplyDraft"
ADD COLUMN "replyRiskLevel" "MarketClawReplyRiskLevel" NOT NULL DEFAULT 'MEDIUM',
ADD COLUMN "sendMode" "MarketClawSendMode" NOT NULL DEFAULT 'SALES_CONFIRM_REQUIRED',
ADD COLUMN "riskReason" TEXT,
ADD COLUMN "requiresReview" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "internalOnlyNote" TEXT,
ADD COLUMN "highRiskKnowledgeIds" JSONB,
ADD COLUMN "internalAdviceKnowledgeIds" JSONB;

-- AlterTable
ALTER TABLE "MarketClawKnowledgeCandidate"
ADD COLUMN "suggestedReplyRiskLevel" "MarketClawReplyRiskLevel" NOT NULL DEFAULT 'MEDIUM',
ADD COLUMN "suggestedSendMode" "MarketClawSendMode" NOT NULL DEFAULT 'SALES_CONFIRM_REQUIRED',
ADD COLUMN "suggestedRiskReason" TEXT,
ADD COLUMN "requiresReview" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "internalOnlyNote" TEXT;

-- CreateIndex
CREATE INDEX "MarketClawKnowledgeItem_tenantId_replyRiskLevel_sendMode_u_idx" ON "MarketClawKnowledgeItem"("tenantId", "replyRiskLevel", "sendMode", "updatedAt");

-- CreateIndex
CREATE INDEX "MarketClawTrainingCase_tenantId_replyRiskLevel_sendMode_up_idx" ON "MarketClawTrainingCase"("tenantId", "replyRiskLevel", "sendMode", "updatedAt");

-- CreateIndex
CREATE INDEX "MarketClawReplyDraft_tenantId_replyRiskLevel_sendMode_cre_idx" ON "MarketClawReplyDraft"("tenantId", "replyRiskLevel", "sendMode", "createdAt");

-- CreateIndex
CREATE INDEX "MarketClawKnowledgeCandidate_tenantId_suggestedReplyRiskL_idx" ON "MarketClawKnowledgeCandidate"("tenantId", "suggestedReplyRiskLevel", "suggestedSendMode", "createdAt");
