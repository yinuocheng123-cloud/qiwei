-- AlterTable
ALTER TABLE "MarketClawKnowledgeItem"
ADD COLUMN "sourceCandidateIds" JSONB,
ADD COLUMN "sourceBatchIds" JSONB,
ADD COLUMN "lastMergedAt" TIMESTAMP(3),
ADD COLUMN "lastMergedById" TEXT;

-- AlterTable
ALTER TABLE "MarketClawKnowledgeCandidate"
ADD COLUMN "similarKnowledgeItemIds" JSONB,
ADD COLUMN "similarityHints" JSONB,
ADD COLUMN "mergeTargetKnowledgeItemId" TEXT,
ADD COLUMN "mergeAction" TEXT,
ADD COLUMN "mergeReason" TEXT,
ADD COLUMN "mergedAt" TIMESTAMP(3),
ADD COLUMN "mergedById" TEXT;

-- CreateIndex
CREATE INDEX "MarketClawKnowledgeCandidate_tenantId_mergeTargetKnowled_idx" ON "MarketClawKnowledgeCandidate"("tenantId", "mergeTargetKnowledgeItemId", "updatedAt");
