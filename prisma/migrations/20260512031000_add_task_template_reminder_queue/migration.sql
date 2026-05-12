-- 文件说明：该迁移为 V1.3.1 增加任务模板和提醒队列基础表。
-- 功能说明：任务模板用于快速创建 FollowTask，提醒队列为后续企业微信内部应用消息预留。
-- 结构概览：
--   第一部分：新增提醒枚举
--   第二部分：新增任务模板表
--   第三部分：新增提醒队列表和索引

CREATE TYPE "ReminderChannel" AS ENUM ('IN_APP', 'WECOM_APP', 'EMAIL', 'SMS');

CREATE TYPE "ReminderStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'CANCELLED');

CREATE TABLE "TaskTemplate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "FollowTaskType" NOT NULL DEFAULT 'CUSTOM',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "priority" "FollowTaskPriority" NOT NULL DEFAULT 'NORMAL',
    "defaultDueDays" INTEGER NOT NULL DEFAULT 1,
    "customerType" "CustomerType",
    "stage" "LeadStage",
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReminderQueue" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "taskId" TEXT,
    "leadId" TEXT,
    "userId" TEXT,
    "channel" "ReminderChannel" NOT NULL DEFAULT 'IN_APP',
    "status" "ReminderStatus" NOT NULL DEFAULT 'PENDING',
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "payload" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReminderQueue_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TaskTemplate_tenantId_isActive_idx" ON "TaskTemplate"("tenantId", "isActive");
CREATE INDEX "TaskTemplate_tenantId_customerType_stage_idx" ON "TaskTemplate"("tenantId", "customerType", "stage");
CREATE INDEX "ReminderQueue_tenantId_status_scheduledAt_idx" ON "ReminderQueue"("tenantId", "status", "scheduledAt");
CREATE INDEX "ReminderQueue_tenantId_userId_status_idx" ON "ReminderQueue"("tenantId", "userId", "status");
CREATE INDEX "ReminderQueue_taskId_status_idx" ON "ReminderQueue"("taskId", "status");

ALTER TABLE "TaskTemplate" ADD CONSTRAINT "TaskTemplate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReminderQueue" ADD CONSTRAINT "ReminderQueue_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReminderQueue" ADD CONSTRAINT "ReminderQueue_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "FollowTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReminderQueue" ADD CONSTRAINT "ReminderQueue_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReminderQueue" ADD CONSTRAINT "ReminderQueue_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
