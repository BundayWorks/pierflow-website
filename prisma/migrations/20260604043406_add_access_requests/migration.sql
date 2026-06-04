-- CreateEnum
CREATE TYPE "AccessRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN');

-- CreateTable
CREATE TABLE "access_requests" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "websiteUrl" TEXT,
    "useCase" TEXT NOT NULL,
    "expectedVolume" TEXT,
    "partnerType" "PartnerType" NOT NULL DEFAULT 'OTHER',
    "status" "AccessRequestStatus" NOT NULL DEFAULT 'PENDING',
    "approvedPartnerId" TEXT,
    "approvedApiKeyLast4" TEXT,
    "reviewerExternalId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewerNotes" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "access_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "access_requests_status_createdAt_idx" ON "access_requests"("status", "createdAt");

-- CreateIndex
CREATE INDEX "access_requests_email_idx" ON "access_requests"("email");

-- AddForeignKey
ALTER TABLE "access_requests" ADD CONSTRAINT "access_requests_approvedPartnerId_fkey" FOREIGN KEY ("approvedPartnerId") REFERENCES "partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;
