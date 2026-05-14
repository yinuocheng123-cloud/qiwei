-- CreateEnum
CREATE TYPE "ReplySuggestionStyle" AS ENUM ('DIRECT', 'WARM', 'PROFESSIONAL');

-- CreateTable
CREATE TABLE "ReplySuggestion" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "customerQuestion" TEXT NOT NULL,
    "suggestionText" TEXT NOT NULL,
    "recommendedMaterialIds" JSONB,
    "recommendedNextAction" TEXT NOT NULL,
    "style" "ReplySuggestionStyle" NOT NULL,
    "warning" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReplySuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReplySuggestion_tenantId_leadId_userId_createdAt_idx" ON "ReplySuggestion"("tenantId", "leadId", "userId", "createdAt");

-- CreateIndex
CREATE INDEX "ReplySuggestion_tenantId_createdAt_idx" ON "ReplySuggestion"("tenantId", "createdAt");

-- AddForeignKey
ALTER TABLE "ReplySuggestion" ADD CONSTRAINT "ReplySuggestion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReplySuggestion" ADD CONSTRAINT "ReplySuggestion_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReplySuggestion" ADD CONSTRAINT "ReplySuggestion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
