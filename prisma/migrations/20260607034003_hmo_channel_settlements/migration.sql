-- CreateTable
CREATE TABLE "hmo_provider_channel_settlements" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "settlementMode" "HmoSettlementMode",
    "settlementBankName" TEXT,
    "settlementBankAccount" TEXT,
    "settlementBankCode" TEXT,
    "inFintechAccountId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedByExternalId" TEXT,

    CONSTRAINT "hmo_provider_channel_settlements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "hmo_provider_channel_settlements_partnerId_idx" ON "hmo_provider_channel_settlements"("partnerId");

-- CreateIndex
CREATE UNIQUE INDEX "hmo_provider_channel_settlements_providerId_partnerId_key" ON "hmo_provider_channel_settlements"("providerId", "partnerId");

-- AddForeignKey
ALTER TABLE "hmo_provider_channel_settlements" ADD CONSTRAINT "hmo_provider_channel_settlements_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "hmo_providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hmo_provider_channel_settlements" ADD CONSTRAINT "hmo_provider_channel_settlements_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;
