-- CreateEnum
CREATE TYPE "IdentityVerificationStatus" AS ENUM ('AUTO_APPROVED', 'SOFT_REVIEW', 'REJECTED', 'ERROR');

-- CreateEnum
CREATE TYPE "IdentityVerificationProvider" AS ENUM ('STUB', 'NIMC', 'PARTNER_DECLARED');

-- CreateEnum
CREATE TYPE "HmoEnrollmentStatus" AS ENUM ('CREATED', 'PENDING_PAYMENT', 'PENDING_HMO', 'ACTIVE', 'FAILED', 'LAPSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "HmoEnrollmentEventKind" AS ENUM ('CREATED', 'PAYMENT_RECEIVED', 'PAYMENT_FAILED', 'IDENTITY_VERIFIED', 'IDENTITY_REJECTED', 'SUBMITTED_TO_HMO', 'HMO_APPROVED', 'HMO_REJECTED', 'ACTIVATED', 'RENEWED', 'LAPSED', 'CANCELLED', 'WEBHOOK_DELIVERED', 'WEBHOOK_FAILED');

-- CreateTable
CREATE TABLE "identity_verifications" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "ninHash" TEXT,
    "ninLast4" TEXT,
    "bvnHash" TEXT,
    "bvnLast4" TEXT,
    "encryptedPayload" BYTEA,
    "fullName" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3) NOT NULL,
    "sex" TEXT,
    "status" "IdentityVerificationStatus" NOT NULL,
    "provider" "IdentityVerificationProvider" NOT NULL DEFAULT 'STUB',
    "confidence" DOUBLE PRECISION NOT NULL,
    "fieldChecks" JSONB NOT NULL,
    "rawResponse" JSONB,
    "environment" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "identity_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hmo_enrollments" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "quoteId" TEXT,
    "fintechUserRef" TEXT NOT NULL,
    "hmoPolicyId" TEXT,
    "hmoMemberId" TEXT,
    "hmoDependentIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "identityVerificationId" TEXT,
    "fullName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "status" "HmoEnrollmentStatus" NOT NULL DEFAULT 'CREATED',
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "wholesaleNgn" BIGINT NOT NULL,
    "markupNgn" BIGINT NOT NULL,
    "memberPaysNgn" BIGINT NOT NULL,
    "splitsSnapshot" JSONB NOT NULL,
    "contractVersion" INTEGER NOT NULL,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hmo_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hmo_enrollment_events" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "kind" "HmoEnrollmentEventKind" NOT NULL,
    "detail" JSONB,
    "fromStatus" "HmoEnrollmentStatus",
    "toStatus" "HmoEnrollmentStatus",
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hmo_enrollment_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "identity_verifications_partnerId_createdAt_idx" ON "identity_verifications"("partnerId", "createdAt");

-- CreateIndex
CREATE INDEX "identity_verifications_ninHash_idx" ON "identity_verifications"("ninHash");

-- CreateIndex
CREATE INDEX "identity_verifications_bvnHash_idx" ON "identity_verifications"("bvnHash");

-- CreateIndex
CREATE INDEX "hmo_enrollments_partnerId_status_idx" ON "hmo_enrollments"("partnerId", "status");

-- CreateIndex
CREATE INDEX "hmo_enrollments_providerId_status_idx" ON "hmo_enrollments"("providerId", "status");

-- CreateIndex
CREATE INDEX "hmo_enrollments_planId_idx" ON "hmo_enrollments"("planId");

-- CreateIndex
CREATE UNIQUE INDEX "hmo_enrollments_partnerId_idempotencyKey_key" ON "hmo_enrollments"("partnerId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "hmo_enrollments_partnerId_fintechUserRef_planId_key" ON "hmo_enrollments"("partnerId", "fintechUserRef", "planId");

-- CreateIndex
CREATE INDEX "hmo_enrollment_events_enrollmentId_occurredAt_idx" ON "hmo_enrollment_events"("enrollmentId", "occurredAt");

-- AddForeignKey
ALTER TABLE "identity_verifications" ADD CONSTRAINT "identity_verifications_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hmo_enrollments" ADD CONSTRAINT "hmo_enrollments_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hmo_enrollments" ADD CONSTRAINT "hmo_enrollments_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "hmo_providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hmo_enrollments" ADD CONSTRAINT "hmo_enrollments_planId_fkey" FOREIGN KEY ("planId") REFERENCES "hmo_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hmo_enrollments" ADD CONSTRAINT "hmo_enrollments_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "hmo_quotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hmo_enrollments" ADD CONSTRAINT "hmo_enrollments_identityVerificationId_fkey" FOREIGN KEY ("identityVerificationId") REFERENCES "identity_verifications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hmo_enrollment_events" ADD CONSTRAINT "hmo_enrollment_events_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "hmo_enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
