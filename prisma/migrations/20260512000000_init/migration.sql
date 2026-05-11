-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('active', 'paused', 'expired');

-- CreateEnum
CREATE TYPE "TenantPlan" AS ENUM ('flagship');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('PLATFORM_ADMIN', 'TENANT_ADMIN', 'OPERATOR', 'SALES');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('active', 'disabled');

-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('douyin', 'xiaohongshu', 'shipinhao', 'gongzhonghao', 'website', 'friend_circle', 'offline_event', 'referral', 'other');

-- CreateEnum
CREATE TYPE "CustomerType" AS ENUM ('OWNER_CLIENT', 'DEALER_CLIENT', 'DESIGNER_CLIENT', 'FACTORY_CLIENT', 'CHANNEL_PARTNER', 'OLD_CLIENT', 'OTHER');

-- CreateEnum
CREATE TYPE "NeedType" AS ENUM ('PRODUCT_INQUIRY', 'COOPERATION', 'GET_MATERIAL', 'ASK_PRICE', 'BOOK_CONSULTATION', 'AFTER_SALES', 'INVESTMENT_JOIN', 'GROWTH_SYSTEM', 'OTHER');

-- CreateEnum
CREATE TYPE "IntentionLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'STRONG');

-- CreateEnum
CREATE TYPE "LeadStage" AS ENUM ('NEW', 'MATERIAL_SENT', 'CONTACTED', 'DIAGNOSED', 'QUOTED', 'PENDING_DEAL', 'DEAL_DONE', 'LOST', 'TO_REACTIVATE');

-- CreateEnum
CREATE TYPE "DealStatus" AS ENUM ('NONE', 'PENDING', 'WON', 'LOST');

-- CreateEnum
CREATE TYPE "TagGroup" AS ENUM ('SOURCE', 'CUSTOMER_TYPE', 'NEED', 'INTENTION', 'STAGE', 'CUSTOM');

-- CreateEnum
CREATE TYPE "FormType" AS ENUM ('material_request', 'diagnosis', 'booking', 'event_signup');

-- CreateEnum
CREATE TYPE "MaterialType" AS ENUM ('pdf', 'image', 'video', 'link', 'document');

-- CreateEnum
CREATE TYPE "WeComConfigStatus" AS ENUM ('draft', 'enabled', 'disabled');

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "industry" TEXT,
    "status" "TenantStatus" NOT NULL DEFAULT 'active',
    "plan" "TenantPlan" NOT NULL DEFAULT 'flagship',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "wechat" TEXT,
    "company" TEXT,
    "industry" TEXT,
    "city" TEXT,
    "source" "LeadSource" NOT NULL DEFAULT 'other',
    "customerType" "CustomerType" NOT NULL DEFAULT 'OTHER',
    "needType" "NeedType" NOT NULL DEFAULT 'OTHER',
    "intentionLevel" "IntentionLevel" NOT NULL DEFAULT 'MEDIUM',
    "stage" "LeadStage" NOT NULL DEFAULT 'NEW',
    "message" TEXT,
    "ownerId" TEXT,
    "nextFollowAt" TIMESTAMP(3),
    "lastFollowAt" TIMESTAMP(3),
    "dealStatus" "DealStatus" NOT NULL DEFAULT 'NONE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadTag" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "tagName" TEXT NOT NULL,
    "tagGroup" "TagGroup" NOT NULL DEFAULT 'CUSTOM',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FollowUp" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "nextAction" TEXT,
    "nextFollowAt" TIMESTAMP(3),
    "stageBefore" "LeadStage",
    "stageAfter" "LeadStage",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FollowUp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerTypeStrategy" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerType" "CustomerType" NOT NULL,
    "name" TEXT NOT NULL,
    "painPoints" TEXT[],
    "firstMaterials" TEXT[],
    "welcomeScript" TEXT NOT NULL,
    "day3Script" TEXT NOT NULL,
    "day7Script" TEXT NOT NULL,
    "day15Script" TEXT NOT NULL,
    "manualTriggerRules" TEXT[],
    "recommendedNextAction" TEXT NOT NULL,
    "recommendedPrivateContent" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerTypeStrategy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Material" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "MaterialType" NOT NULL DEFAULT 'link',
    "url" TEXT NOT NULL,
    "customerType" "CustomerType",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Material_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntakeForm" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "formType" "FormType" NOT NULL,
    "source" "LeadSource" NOT NULL DEFAULT 'other',
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "wechat" TEXT,
    "company" TEXT,
    "industry" TEXT,
    "city" TEXT,
    "customerType" "CustomerType" NOT NULL DEFAULT 'OTHER',
    "needType" "NeedType" NOT NULL DEFAULT 'OTHER',
    "message" TEXT,
    "createdLeadId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntakeForm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeComConfig" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "corpId" TEXT,
    "agentId" TEXT,
    "secretEncrypted" TEXT,
    "token" TEXT,
    "encodingAESKey" TEXT,
    "callbackUrl" TEXT,
    "status" "WeComConfigStatus" NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeComConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_tenantId_role_idx" ON "User"("tenantId", "role");

-- CreateIndex
CREATE INDEX "Lead_tenantId_createdAt_idx" ON "Lead"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "Lead_tenantId_source_idx" ON "Lead"("tenantId", "source");

-- CreateIndex
CREATE INDEX "Lead_tenantId_customerType_idx" ON "Lead"("tenantId", "customerType");

-- CreateIndex
CREATE INDEX "Lead_tenantId_stage_idx" ON "Lead"("tenantId", "stage");

-- CreateIndex
CREATE INDEX "LeadTag_tenantId_leadId_idx" ON "LeadTag"("tenantId", "leadId");

-- CreateIndex
CREATE INDEX "FollowUp_tenantId_leadId_createdAt_idx" ON "FollowUp"("tenantId", "leadId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerTypeStrategy_tenantId_customerType_key" ON "CustomerTypeStrategy"("tenantId", "customerType");

-- CreateIndex
CREATE INDEX "Material_tenantId_customerType_idx" ON "Material"("tenantId", "customerType");

-- CreateIndex
CREATE INDEX "IntakeForm_tenantId_createdAt_idx" ON "IntakeForm"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WeComConfig_tenantId_key" ON "WeComConfig"("tenantId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadTag" ADD CONSTRAINT "LeadTag_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadTag" ADD CONSTRAINT "LeadTag_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerTypeStrategy" ADD CONSTRAINT "CustomerTypeStrategy_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Material" ADD CONSTRAINT "Material_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntakeForm" ADD CONSTRAINT "IntakeForm_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntakeForm" ADD CONSTRAINT "IntakeForm_createdLeadId_fkey" FOREIGN KEY ("createdLeadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeComConfig" ADD CONSTRAINT "WeComConfig_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
