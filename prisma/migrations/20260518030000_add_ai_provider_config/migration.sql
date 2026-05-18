-- CreateEnum
CREATE TYPE "AiProvider" AS ENUM ('DEEPSEEK', 'OPENAI_COMPATIBLE', 'MOCK');

-- CreateEnum
CREATE TYPE "AiCallStatus" AS ENUM ('SUCCESS', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "AiCallPurpose" AS ENUM ('TEST_CONNECTION', 'KNOWLEDGE_INGESTION_PREVIEW', 'MARKET_CLAW_SANDBOX', 'AGENT_LIBRARY_TEST', 'REPLY_DRAFT_PREVIEW', 'TRAINING_PREVIEW');

-- CreateTable
CREATE TABLE "AiProviderConfig" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "provider" "AiProvider" NOT NULL DEFAULT 'DEEPSEEK',
    "baseUrl" TEXT NOT NULL DEFAULT 'https://api.deepseek.com',
    "model" TEXT NOT NULL DEFAULT 'deepseek-chat',
    "apiKeyEncrypted" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.2,
    "maxTokens" INTEGER NOT NULL DEFAULT 512,
    "lastTestAt" TIMESTAMP(3),
    "lastTestStatus" "AiCallStatus",
    "lastTestMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiProviderConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiCallLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "provider" "AiProvider" NOT NULL,
    "model" TEXT NOT NULL,
    "purpose" "AiCallPurpose" NOT NULL,
    "status" "AiCallStatus" NOT NULL,
    "errorMessage" TEXT,
    "promptTokens" INTEGER,
    "completionTokens" INTEGER,
    "totalTokens" INTEGER,
    "latencyMs" INTEGER,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiCallLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AiProviderConfig_tenantId_key" ON "AiProviderConfig"("tenantId");

-- CreateIndex
CREATE INDEX "AiProviderConfig_tenantId_enabled_idx" ON "AiProviderConfig"("tenantId", "enabled");

-- CreateIndex
CREATE INDEX "AiProviderConfig_tenantId_provider_idx" ON "AiProviderConfig"("tenantId", "provider");

-- CreateIndex
CREATE INDEX "AiCallLog_tenantId_createdAt_idx" ON "AiCallLog"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "AiCallLog_tenantId_purpose_createdAt_idx" ON "AiCallLog"("tenantId", "purpose", "createdAt");

-- CreateIndex
CREATE INDEX "AiCallLog_tenantId_status_createdAt_idx" ON "AiCallLog"("tenantId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "AiCallLog_tenantId_provider_createdAt_idx" ON "AiCallLog"("tenantId", "provider", "createdAt");

-- CreateIndex
CREATE INDEX "AiCallLog_tenantId_createdById_createdAt_idx" ON "AiCallLog"("tenantId", "createdById", "createdAt");

-- AddForeignKey
ALTER TABLE "AiProviderConfig" ADD CONSTRAINT "AiProviderConfig_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiCallLog" ADD CONSTRAINT "AiCallLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiCallLog" ADD CONSTRAINT "AiCallLog_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
