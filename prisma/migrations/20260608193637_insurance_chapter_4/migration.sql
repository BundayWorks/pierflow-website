-- CreateEnum
CREATE TYPE "LedgerAccountRole" AS ENUM ('HMO', 'PIERFLOW', 'EMR_VENDOR', 'FINTECH', 'BROKER', 'REGULATOR_LEVY', 'REFERRER', 'OTHER', 'USER');

-- CreateEnum
CREATE TYPE "LedgerEntryKind" AS ENUM ('INSTRUCTED', 'EXECUTED', 'ADJUSTMENT', 'RECONCILED');

-- CreateEnum
CREATE TYPE "LedgerEntrySource" AS ENUM ('ENROLLMENT_FIRST_PREMIUM', 'ENROLLMENT_FEE', 'RECURRING_PREMIUM', 'CLAIM_PAYOUT', 'MANUAL_ADJUSTMENT');

-- CreateEnum
CREATE TYPE "LedgerDiscrepancyStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'WRITTEN_OFF');

-- CreateEnum
CREATE TYPE "HmoClaimStatus" AS ENUM ('SUBMITTED', 'PENDING_HMO', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'PAID');

-- CreateEnum
CREATE TYPE "HmoClaimEventKind" AS ENUM ('SUBMITTED', 'SENT_TO_HMO', 'STATUS_POLLED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'PAID', 'WEBHOOK_DELIVERED');

-- CreateEnum
CREATE TYPE "HmoNetworkProviderType" AS ENUM ('HOSPITAL', 'CLINIC', 'LAB', 'PHARMACY', 'OTHER');

-- CreateTable
CREATE TABLE "ledger_accounts" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "role" "LedgerAccountRole" NOT NULL,
    "settlementTag" TEXT,
    "displayName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_entries" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "kind" "LedgerEntryKind" NOT NULL,
    "source" "LedgerEntrySource" NOT NULL,
    "amountNgn" BIGINT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "enrollmentId" TEXT,
    "detail" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_discrepancies" (
    "id" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "enrollmentId" TEXT,
    "deltaNgn" BIGINT NOT NULL,
    "breakdown" JSONB NOT NULL,
    "status" "LedgerDiscrepancyStatus" NOT NULL DEFAULT 'OPEN',
    "reviewerNotes" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolvedByExternalId" TEXT,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_discrepancies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hmo_claims" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "fintechUserRef" TEXT NOT NULL,
    "hmoClaimId" TEXT,
    "serviceDate" TIMESTAMP(3) NOT NULL,
    "serviceType" TEXT,
    "facilityName" TEXT,
    "facilityNetworkProviderId" TEXT,
    "amountNgn" BIGINT NOT NULL,
    "diagnosisCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "procedureCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "status" "HmoClaimStatus" NOT NULL DEFAULT 'SUBMITTED',
    "approvedAmountNgn" BIGINT,
    "paidAmountNgn" BIGINT,
    "rejectionReason" TEXT,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastPolledAt" TIMESTAMP(3),

    CONSTRAINT "hmo_claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hmo_claim_events" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "kind" "HmoClaimEventKind" NOT NULL,
    "fromStatus" "HmoClaimStatus",
    "toStatus" "HmoClaimStatus",
    "detail" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hmo_claim_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hmo_network_providers" (
    "id" TEXT NOT NULL,
    "hmoProviderId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "HmoNetworkProviderType" NOT NULL DEFAULT 'HOSPITAL',
    "state" TEXT,
    "lga" TEXT,
    "street" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "specialties" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "contactPhone" TEXT,
    "contactEmail" TEXT,
    "tier" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hmo_network_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hmo_plan_network_providers" (
    "planId" TEXT NOT NULL,
    "networkProviderId" TEXT NOT NULL,

    CONSTRAINT "hmo_plan_network_providers_pkey" PRIMARY KEY ("planId","networkProviderId")
);

-- CreateIndex
CREATE INDEX "ledger_accounts_role_idx" ON "ledger_accounts"("role");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_accounts_partnerId_role_settlementTag_key" ON "ledger_accounts"("partnerId", "role", "settlementTag");

-- CreateIndex
CREATE INDEX "ledger_entries_correlationId_kind_idx" ON "ledger_entries"("correlationId", "kind");

-- CreateIndex
CREATE INDEX "ledger_entries_accountId_occurredAt_idx" ON "ledger_entries"("accountId", "occurredAt");

-- CreateIndex
CREATE INDEX "ledger_entries_enrollmentId_idx" ON "ledger_entries"("enrollmentId");

-- CreateIndex
CREATE INDEX "ledger_discrepancies_status_detectedAt_idx" ON "ledger_discrepancies"("status", "detectedAt");

-- CreateIndex
CREATE INDEX "ledger_discrepancies_enrollmentId_idx" ON "ledger_discrepancies"("enrollmentId");

-- CreateIndex
CREATE INDEX "hmo_claims_partnerId_status_idx" ON "hmo_claims"("partnerId", "status");

-- CreateIndex
CREATE INDEX "hmo_claims_enrollmentId_idx" ON "hmo_claims"("enrollmentId");

-- CreateIndex
CREATE INDEX "hmo_claims_status_lastPolledAt_idx" ON "hmo_claims"("status", "lastPolledAt");

-- CreateIndex
CREATE UNIQUE INDEX "hmo_claims_partnerId_idempotencyKey_key" ON "hmo_claims"("partnerId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "hmo_claim_events_claimId_occurredAt_idx" ON "hmo_claim_events"("claimId", "occurredAt");

-- CreateIndex
CREATE INDEX "hmo_network_providers_state_lga_idx" ON "hmo_network_providers"("state", "lga");

-- CreateIndex
CREATE INDEX "hmo_network_providers_type_idx" ON "hmo_network_providers"("type");

-- CreateIndex
CREATE UNIQUE INDEX "hmo_network_providers_hmoProviderId_externalId_key" ON "hmo_network_providers"("hmoProviderId", "externalId");

-- CreateIndex
CREATE INDEX "hmo_plan_network_providers_networkProviderId_idx" ON "hmo_plan_network_providers"("networkProviderId");

-- AddForeignKey
ALTER TABLE "ledger_accounts" ADD CONSTRAINT "ledger_accounts_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "ledger_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "hmo_enrollments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_discrepancies" ADD CONSTRAINT "ledger_discrepancies_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "hmo_enrollments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hmo_claims" ADD CONSTRAINT "hmo_claims_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hmo_claims" ADD CONSTRAINT "hmo_claims_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "hmo_enrollments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hmo_claims" ADD CONSTRAINT "hmo_claims_facilityNetworkProviderId_fkey" FOREIGN KEY ("facilityNetworkProviderId") REFERENCES "hmo_network_providers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hmo_claim_events" ADD CONSTRAINT "hmo_claim_events_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "hmo_claims"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hmo_network_providers" ADD CONSTRAINT "hmo_network_providers_hmoProviderId_fkey" FOREIGN KEY ("hmoProviderId") REFERENCES "hmo_providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hmo_plan_network_providers" ADD CONSTRAINT "hmo_plan_network_providers_planId_fkey" FOREIGN KEY ("planId") REFERENCES "hmo_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hmo_plan_network_providers" ADD CONSTRAINT "hmo_plan_network_providers_networkProviderId_fkey" FOREIGN KEY ("networkProviderId") REFERENCES "hmo_network_providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
