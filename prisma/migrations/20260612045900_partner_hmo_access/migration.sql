-- CreateEnum
CREATE TYPE "PartnerHmoAccessStatus" AS ENUM ('PENDING_ACCEPTANCE', 'ACTIVE', 'SUSPENDED');

-- CreateTable
CREATE TABLE "partner_hmo_access" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "hmoProviderId" TEXT NOT NULL,
    "status" "PartnerHmoAccessStatus" NOT NULL DEFAULT 'PENDING_ACCEPTANCE',
    "acceptedAt" TIMESTAMP(3),
    "contractId" TEXT,
    "rateCardSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "partner_hmo_access_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "partner_hmo_access_partnerId_status_idx" ON "partner_hmo_access"("partnerId", "status");

-- CreateIndex
CREATE INDEX "partner_hmo_access_hmoProviderId_idx" ON "partner_hmo_access"("hmoProviderId");

-- CreateIndex
CREATE UNIQUE INDEX "partner_hmo_access_partnerId_hmoProviderId_key" ON "partner_hmo_access"("partnerId", "hmoProviderId");

-- AddForeignKey
ALTER TABLE "partner_hmo_access" ADD CONSTRAINT "partner_hmo_access_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_hmo_access" ADD CONSTRAINT "partner_hmo_access_hmoProviderId_fkey" FOREIGN KEY ("hmoProviderId") REFERENCES "hmo_providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_hmo_access" ADD CONSTRAINT "partner_hmo_access_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "hmo_contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
