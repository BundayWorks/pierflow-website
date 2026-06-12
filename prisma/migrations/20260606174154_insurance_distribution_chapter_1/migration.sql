-- CreateEnum
CREATE TYPE "HmoPlanScope" AS ENUM ('INDIVIDUAL', 'FAMILY', 'EMPLOYEE_GROUP', 'STUDENT', 'OTHER');

-- CreateEnum
CREATE TYPE "HmoPlanStatus" AS ENUM ('DRAFT', 'ACTIVE', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "BillingFrequency" AS ENUM ('MONTHLY', 'QUARTERLY', 'ANNUAL');

-- CreateEnum
CREATE TYPE "HmoSettlementMode" AS ENUM ('IN_FINTECH_ACCOUNT', 'EXTERNAL_BANK_SWEEP');

-- CreateEnum
CREATE TYPE "HmoProviderStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "HmoPlanFreshnessKind" AS ENUM ('BULK_SYNC', 'PARTIAL_UPDATE', 'CHANGE_NOTIFICATION', 'LIVE_VERIFY', 'WITHDRAWAL');

-- CreateEnum
CREATE TYPE "HmoContractStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SUPERSEDED', 'TERMINATED');

-- CreateEnum
CREATE TYPE "HmoContractPartyRole" AS ENUM ('HMO', 'PIERFLOW', 'EMR_VENDOR', 'FINTECH', 'BROKER', 'REGULATOR_LEVY', 'REFERRER', 'OTHER');

-- CreateEnum
CREATE TYPE "HmoContractFeeKind" AS ENUM ('FLAT', 'PERCENTAGE');

-- CreateEnum
CREATE TYPE "HmoContractFeeTiming" AS ENUM ('ENROLLMENT_ONLY', 'RECURRING_ONLY', 'BOTH');

-- AlterTable
ALTER TABLE "chart_folders" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "partner_profiles" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "partner_security_assessments" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "hmo_providers" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "registrationNo" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "websiteUrl" TEXT,
    "logoAssetId" TEXT,
    "status" "HmoProviderStatus" NOT NULL DEFAULT 'PENDING',
    "defaultSettlementMode" "HmoSettlementMode" NOT NULL DEFAULT 'IN_FINTECH_ACCOUNT',
    "settlementBankName" TEXT,
    "settlementBankAccount" TEXT,
    "settlementBankCode" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hmo_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hmo_plans" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scope" "HmoPlanScope" NOT NULL DEFAULT 'INDIVIDUAL',
    "status" "HmoPlanStatus" NOT NULL DEFAULT 'ACTIVE',
    "billingFrequency" "BillingFrequency" NOT NULL DEFAULT 'MONTHLY',
    "coverage" JSONB NOT NULL,
    "pricing" JSONB NOT NULL,
    "waitingPeriods" JSONB,
    "exclusions" JSONB,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastVerifiedAt" TIMESTAMP(3),
    "staleAfter" TIMESTAMP(3),
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hmo_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hmo_plan_freshness_events" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "kind" "HmoPlanFreshnessKind" NOT NULL,
    "changed" BOOLEAN NOT NULL DEFAULT false,
    "detail" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hmo_plan_freshness_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hmo_contracts" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "HmoContractStatus" NOT NULL DEFAULT 'DRAFT',
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "enrollmentFeeNgn" BIGINT,
    "remainderBearer" "HmoContractPartyRole" NOT NULL DEFAULT 'HMO',
    "notes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByExternalId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hmo_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hmo_contract_parties" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "role" "HmoContractPartyRole" NOT NULL,
    "displayName" TEXT,
    "partnerId" TEXT,
    "kind" "HmoContractFeeKind" NOT NULL,
    "timing" "HmoContractFeeTiming" NOT NULL,
    "amountFlatNgn" BIGINT,
    "amountBps" INTEGER,
    "minPerCycleNgn" BIGINT,
    "maxPerCycleNgn" BIGINT,
    "settlementAccountTag" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hmo_contract_parties_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "hmo_providers_organizationId_key" ON "hmo_providers"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "hmo_providers_slug_key" ON "hmo_providers"("slug");

-- CreateIndex
CREATE INDEX "hmo_providers_status_idx" ON "hmo_providers"("status");

-- CreateIndex
CREATE INDEX "hmo_plans_providerId_status_idx" ON "hmo_plans"("providerId", "status");

-- CreateIndex
CREATE INDEX "hmo_plans_scope_status_idx" ON "hmo_plans"("scope", "status");

-- CreateIndex
CREATE UNIQUE INDEX "hmo_plans_providerId_externalId_key" ON "hmo_plans"("providerId", "externalId");

-- CreateIndex
CREATE INDEX "hmo_plan_freshness_events_planId_occurredAt_idx" ON "hmo_plan_freshness_events"("planId", "occurredAt");

-- CreateIndex
CREATE INDEX "hmo_contracts_providerId_status_idx" ON "hmo_contracts"("providerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "hmo_contracts_providerId_version_key" ON "hmo_contracts"("providerId", "version");

-- CreateIndex
CREATE INDEX "hmo_contract_parties_contractId_idx" ON "hmo_contract_parties"("contractId");

-- CreateIndex
CREATE INDEX "hmo_contract_parties_role_idx" ON "hmo_contract_parties"("role");

-- CreateIndex
CREATE INDEX "hmo_contract_parties_partnerId_idx" ON "hmo_contract_parties"("partnerId");

-- AddForeignKey
ALTER TABLE "hmo_providers" ADD CONSTRAINT "hmo_providers_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hmo_plans" ADD CONSTRAINT "hmo_plans_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "hmo_providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hmo_plan_freshness_events" ADD CONSTRAINT "hmo_plan_freshness_events_planId_fkey" FOREIGN KEY ("planId") REFERENCES "hmo_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hmo_contracts" ADD CONSTRAINT "hmo_contracts_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "hmo_providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hmo_contract_parties" ADD CONSTRAINT "hmo_contract_parties_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "hmo_contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "partner_patient_links_partner_external_key" RENAME TO "partner_patient_links_partnerId_externalId_key";

-- RenameIndex
ALTER INDEX "partner_patient_links_partner_patient_key" RENAME TO "partner_patient_links_partnerId_patientId_key";

-- RenameIndex
ALTER INDEX "patient_merge_candidates_org_decision_idx" RENAME TO "patient_merge_candidates_organizationId_decision_idx";

-- RenameIndex
ALTER INDEX "patient_merge_candidates_primary_candidate_key" RENAME TO "patient_merge_candidates_primaryPatientId_candidatePatientI_key";
