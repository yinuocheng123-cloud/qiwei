-- CreateEnum
CREATE TYPE "FollowTaskType" AS ENUM ('FIRST_FOLLOW', 'SEND_MATERIAL', 'PHONE_CALL', 'WECHAT_FOLLOW', 'QUOTE_FOLLOW', 'REACTIVATE', 'VISIT_INVITE', 'DEAL_PUSH', 'CUSTOM');

-- CreateEnum
CREATE TYPE "FollowTaskStatus" AS ENUM ('PENDING', 'DONE', 'DELAYED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FollowTaskPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateTable
CREATE TABLE "FollowTask" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "leadId" TEXT,
    "ownerId" TEXT,
    "createdById" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "FollowTaskType" NOT NULL DEFAULT 'CUSTOM',
    "status" "FollowTaskStatus" NOT NULL DEFAULT 'PENDING',
    "priority" "FollowTaskPriority" NOT NULL DEFAULT 'NORMAL',
    "dueAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FollowTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FollowTask_tenantId_status_dueAt_idx" ON "FollowTask"("tenantId", "status", "dueAt");

-- CreateIndex
CREATE INDEX "FollowTask_tenantId_ownerId_status_dueAt_idx" ON "FollowTask"("tenantId", "ownerId", "status", "dueAt");

-- CreateIndex
CREATE INDEX "FollowTask_tenantId_leadId_idx" ON "FollowTask"("tenantId", "leadId");

-- AddForeignKey
ALTER TABLE "FollowTask" ADD CONSTRAINT "FollowTask_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowTask" ADD CONSTRAINT "FollowTask_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowTask" ADD CONSTRAINT "FollowTask_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowTask" ADD CONSTRAINT "FollowTask_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
