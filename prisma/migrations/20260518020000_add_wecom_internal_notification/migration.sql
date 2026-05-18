-- CreateEnum
CREATE TYPE "WecomNotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "WecomNotificationEventType" AS ENUM ('TEST_MESSAGE', 'NEW_LEAD', 'OVERDUE_TASK', 'TRAINING_REVIEW_PENDING', 'KNOWLEDGE_CANDIDATE_REVIEW_PENDING', 'HIGH_RISK_REPLY', 'SYSTEM_NOTICE');

-- AlterTable
ALTER TABLE "WeComConfig" ADD COLUMN "lastTestAt" TIMESTAMP(3),
ADD COLUMN "lastTestMessage" TEXT,
ADD COLUMN "lastTestStatus" "WecomNotificationStatus";

-- CreateTable
CREATE TABLE "UserWecomBinding" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "wecomUserId" TEXT,
    "displayName" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserWecomBinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WecomNotificationLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "eventType" "WecomNotificationEventType" NOT NULL,
    "recipientUserId" TEXT,
    "recipientWecomUserId" TEXT,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" "WecomNotificationStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "relatedLeadId" TEXT,
    "relatedTaskId" TEXT,
    "relatedTrainingCaseId" TEXT,
    "relatedCandidateId" TEXT,
    "relatedReplyDraftId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "WecomNotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserWecomBinding_userId_key" ON "UserWecomBinding"("userId");

-- CreateIndex
CREATE INDEX "UserWecomBinding_tenantId_enabled_idx" ON "UserWecomBinding"("tenantId", "enabled");

-- CreateIndex
CREATE INDEX "UserWecomBinding_tenantId_wecomUserId_idx" ON "UserWecomBinding"("tenantId", "wecomUserId");

-- CreateIndex
CREATE INDEX "WecomNotificationLog_tenantId_createdAt_idx" ON "WecomNotificationLog"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "WecomNotificationLog_tenantId_eventType_createdAt_idx" ON "WecomNotificationLog"("tenantId", "eventType", "createdAt");

-- CreateIndex
CREATE INDEX "WecomNotificationLog_tenantId_status_createdAt_idx" ON "WecomNotificationLog"("tenantId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "WecomNotificationLog_tenantId_recipientUserId_createdAt_idx" ON "WecomNotificationLog"("tenantId", "recipientUserId", "createdAt");

-- AddForeignKey
ALTER TABLE "UserWecomBinding" ADD CONSTRAINT "UserWecomBinding_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserWecomBinding" ADD CONSTRAINT "UserWecomBinding_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WecomNotificationLog" ADD CONSTRAINT "WecomNotificationLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WecomNotificationLog" ADD CONSTRAINT "WecomNotificationLog_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
