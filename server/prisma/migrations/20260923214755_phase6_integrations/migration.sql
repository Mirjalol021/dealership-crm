-- CreateTable
CREATE TABLE "MetaConnectorSettings" (
    "id" TEXT NOT NULL,
    "dealershipId" TEXT,
    "brandId" TEXT,
    "verifyToken" TEXT NOT NULL,
    "appSecret" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetaConnectorSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TelegramConnectorSettings" (
    "id" TEXT NOT NULL,
    "dealershipId" TEXT,
    "brandId" TEXT,
    "botToken" TEXT,
    "webhookSecret" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TelegramConnectorSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalLeadReference" (
    "id" TEXT NOT NULL,
    "source" "LeadSource" NOT NULL,
    "externalId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExternalLeadReference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PREVIEW',
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "validRows" INTEGER NOT NULL DEFAULT 0,
    "invalidRows" INTEGER NOT NULL DEFAULT 0,
    "duplicateRows" INTEGER NOT NULL DEFAULT 0,
    "summary" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TelegramConnectorSettings_webhookSecret_key" ON "TelegramConnectorSettings"("webhookSecret");

-- CreateIndex
CREATE INDEX "ExternalLeadReference_leadId_idx" ON "ExternalLeadReference"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalLeadReference_source_externalId_key" ON "ExternalLeadReference"("source", "externalId");

-- CreateIndex
CREATE INDEX "ImportBatch_type_idx" ON "ImportBatch"("type");
