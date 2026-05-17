-- CreateEnum
CREATE TYPE "MarketClawIngestionSourceType" AS ENUM ('PASTED_TEXT', 'TXT', 'MARKDOWN', 'CSV', 'MANUAL');

-- CreateEnum
CREATE TYPE "MarketClawIngestionStatus" AS ENUM ('DRAFT', 'PROCESSING', 'CANDIDATES_GENERATED', 'REVIEWING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "MarketClawKnowledgeCandidateReviewStatus" AS ENUM ('PENDING_REVIEW', 'ADOPTED', 'ADOPTED_WITH_EDIT', 'REJECTED', 'MERGED');

-- AlterTable
ALTER TABLE "MarketClawKnowledgeItem"
ADD COLUMN "sourceIngestionBatchId" TEXT,
ADD COLUMN "sourceKnowledgeCandidateId" TEXT;

-- CreateTable
CREATE TABLE "MarketClawIngestionBatch" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "businessLineId" TEXT,
    "createdById" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sourceType" "MarketClawIngestionSourceType" NOT NULL,
    "sourceName" TEXT,
    "rawText" TEXT NOT NULL,
    "status" "MarketClawIngestionStatus" NOT NULL DEFAULT 'DRAFT',
    "candidateCount" INTEGER NOT NULL DEFAULT 0,
    "adoptedCount" INTEGER NOT NULL DEFAULT 0,
    "rejectedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketClawIngestionBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketClawKnowledgeCandidate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "businessLineId" TEXT,
    "createdById" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "knowledgeType" "MarketClawKnowledgeType" NOT NULL,
    "suggestedScopeLevel" "MarketClawKnowledgeScopeLevel" NOT NULL DEFAULT 'BUSINESS_LINE',
    "suggestedKeywords" JSONB,
    "suggestedForbiddenPhrases" JSONB,
    "suggestedRiskNotes" TEXT,
    "suggestedReplyShort" TEXT,
    "suggestedReplyProfessional" TEXT,
    "suggestedReplyClosing" TEXT,
    "reviewStatus" "MarketClawKnowledgeCandidateReviewStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "reviewComment" TEXT,
    "adoptedKnowledgeItemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketClawKnowledgeCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MarketClawKnowledgeItem_tenantId_sourceIngestionBatchId_updatedA_idx" ON "MarketClawKnowledgeItem"("tenantId", "sourceIngestionBatchId", "updatedAt");

-- CreateIndex
CREATE INDEX "MarketClawKnowledgeItem_tenantId_sourceKnowledgeCandidateI_idx" ON "MarketClawKnowledgeItem"("tenantId", "sourceKnowledgeCandidateId", "updatedAt");

-- CreateIndex
CREATE INDEX "MarketClawIngestionBatch_tenantId_status_createdAt_idx" ON "MarketClawIngestionBatch"("tenantId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "MarketClawIngestionBatch_tenantId_businessLineId_createdAt_idx" ON "MarketClawIngestionBatch"("tenantId", "businessLineId", "createdAt");

-- CreateIndex
CREATE INDEX "MarketClawIngestionBatch_tenantId_createdById_createdAt_idx" ON "MarketClawIngestionBatch"("tenantId", "createdById", "createdAt");

-- CreateIndex
CREATE INDEX "MarketClawKnowledgeCandidate_tenantId_batchId_reviewStatus__idx" ON "MarketClawKnowledgeCandidate"("tenantId", "batchId", "reviewStatus", "createdAt");

-- CreateIndex
CREATE INDEX "MarketClawKnowledgeCandidate_tenantId_businessLineId_revi_idx" ON "MarketClawKnowledgeCandidate"("tenantId", "businessLineId", "reviewStatus", "createdAt");

-- CreateIndex
CREATE INDEX "MarketClawKnowledgeCandidate_tenantId_createdById_review_idx" ON "MarketClawKnowledgeCandidate"("tenantId", "createdById", "reviewStatus", "createdAt");

-- CreateIndex
CREATE INDEX "MarketClawKnowledgeCandidate_tenantId_adoptedKnowledgeItemI_idx" ON "MarketClawKnowledgeCandidate"("tenantId", "adoptedKnowledgeItemId", "updatedAt");

-- AddForeignKey
ALTER TABLE "MarketClawKnowledgeItem" ADD CONSTRAINT "MarketClawKnowledgeItem_sourceIngestionBatchId_fkey" FOREIGN KEY ("sourceIngestionBatchId") REFERENCES "MarketClawIngestionBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketClawIngestionBatch" ADD CONSTRAINT "MarketClawIngestionBatch_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketClawIngestionBatch" ADD CONSTRAINT "MarketClawIngestionBatch_businessLineId_fkey" FOREIGN KEY ("businessLineId") REFERENCES "BusinessLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketClawIngestionBatch" ADD CONSTRAINT "MarketClawIngestionBatch_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketClawKnowledgeCandidate" ADD CONSTRAINT "MarketClawKnowledgeCandidate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketClawKnowledgeCandidate" ADD CONSTRAINT "MarketClawKnowledgeCandidate_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "MarketClawIngestionBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketClawKnowledgeCandidate" ADD CONSTRAINT "MarketClawKnowledgeCandidate_businessLineId_fkey" FOREIGN KEY ("businessLineId") REFERENCES "BusinessLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketClawKnowledgeCandidate" ADD CONSTRAINT "MarketClawKnowledgeCandidate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
