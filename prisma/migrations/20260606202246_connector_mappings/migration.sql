-- CreateEnum
CREATE TYPE "ConnectorMappingStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SUPERSEDED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "connector_mappings" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "ConnectorMappingStatus" NOT NULL DEFAULT 'DRAFT',
    "sample" JSONB NOT NULL,
    "proposal" JSONB NOT NULL,
    "template" JSONB NOT NULL,
    "notes" TEXT,
    "averageConfidence" DOUBLE PRECISION,
    "lowConfidenceFields" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByExternalId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedByExternalId" TEXT,
    "activatedAt" TIMESTAMP(3),
    "modelId" TEXT,
    "promptVersion" TEXT,

    CONSTRAINT "connector_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "connector_mappings_providerId_status_idx" ON "connector_mappings"("providerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "connector_mappings_providerId_version_key" ON "connector_mappings"("providerId", "version");

-- AddForeignKey
ALTER TABLE "connector_mappings" ADD CONSTRAINT "connector_mappings_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "hmo_providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
