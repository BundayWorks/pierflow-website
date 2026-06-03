-- CreateEnum
CREATE TYPE "OrganizationType" AS ENUM ('HOSPITAL', 'CLINIC', 'LAB', 'PHARMACY', 'INSURER', 'EMR_VENDOR', 'HMS_VENDOR', 'GOVERNMENT', 'COOPERATIVE', 'OTHER');

-- CreateEnum
CREATE TYPE "OrgRole" AS ENUM ('OWNER', 'ADMIN', 'CLINICAL_REVIEWER', 'DATA_OFFICER', 'CAPTURE_OPERATOR', 'VIEWER');

-- CreateEnum
CREATE TYPE "PartnerType" AS ENUM ('EMR_VENDOR', 'HMS_VENDOR', 'EHR_VENDOR', 'INSURER', 'GOVERNMENT', 'ANALYTICS', 'OTHER');

-- CreateEnum
CREATE TYPE "PatientSex" AS ENUM ('M', 'F', 'U');

-- CreateEnum
CREATE TYPE "JobPriority" AS ENUM ('NORMAL', 'URGENT');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('AUTO', 'OUTPATIENT_CARD', 'REGISTRATION', 'LAB_RESULT', 'PRESCRIPTION', 'ANTENATAL', 'IMMUNISATION', 'DISCHARGE_SUMMARY', 'XRAY_REPORT', 'ULTRASOUND_REPORT', 'OPERATION_NOTE', 'REFERRAL_LETTER', 'OTHER', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('QUEUED', 'PROCESSING', 'AWAITING_REVIEW', 'VALIDATED', 'IMPORTED', 'FAILED');

-- CreateEnum
CREATE TYPE "RecordValidationStatus" AS ENUM ('PENDING', 'AUTO_APPROVED', 'REVIEW_REQUIRED', 'VALIDATED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ImportPackageStatus" AS ENUM ('BUILDING', 'READY', 'ACKNOWLEDGED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'READ', 'UPDATE', 'DELETE', 'EXPORT', 'IMPORT', 'LOGIN', 'LOGOUT');

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "OrganizationType" NOT NULL,
    "slug" TEXT,
    "street" TEXT,
    "lga" TEXT,
    "state" TEXT,
    "country" TEXT NOT NULL DEFAULT 'NG',
    "metadata" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sites" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "street" TEXT,
    "lga" TEXT,
    "state" TEXT,
    "country" TEXT NOT NULL DEFAULT 'NG',
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_members" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" "OrgRole" NOT NULL DEFAULT 'VIEWER',
    "email" TEXT,
    "displayName" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "org_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partners" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" "PartnerType" NOT NULL,
    "websiteUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "partners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_api_keys" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "last4" TEXT NOT NULL,
    "label" TEXT,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "revokedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "partner_api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_organization_links" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "preferredFormat" TEXT NOT NULL DEFAULT 'FHIR_R4_JSON',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partner_organization_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patients" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3),
    "sex" "PatientSex" NOT NULL DEFAULT 'U',
    "bloodGroup" TEXT,
    "genotype" TEXT,
    "possibleDuplicateOfId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_identifiers" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "system" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "use" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patient_identifiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scan_batches" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "siteId" TEXT,
    "label" TEXT,
    "priority" "JobPriority" NOT NULL DEFAULT 'NORMAL',
    "operatorId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scan_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processing_jobs" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sourceAsset" JSONB NOT NULL,
    "sourceFilename" TEXT,
    "pageCount" INTEGER NOT NULL DEFAULT 1,
    "recordTypeHint" "DocumentType" NOT NULL DEFAULT 'AUTO',
    "priority" "JobPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
    "idempotencyKey" TEXT,
    "errorCode" TEXT,
    "errorDetail" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "processing_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "extracted_records" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "patientId" TEXT,
    "documentType" "DocumentType" NOT NULL,
    "pageNumbers" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "extractedJson" JSONB NOT NULL,
    "fhirBundle" JSONB,
    "completenessScore" DOUBLE PRECISION,
    "avgConfidence" DOUBLE PRECISION,
    "lowConfidenceFields" JSONB,
    "validationStatus" "RecordValidationStatus" NOT NULL DEFAULT 'PENDING',
    "reviewerExternalId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewerNotes" TEXT,
    "importPackageId" TEXT,
    "importedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "extracted_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_packages" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "status" "ImportPackageStatus" NOT NULL DEFAULT 'BUILDING',
    "patientCount" INTEGER NOT NULL DEFAULT 0,
    "recordCount" INTEGER NOT NULL DEFAULT 0,
    "archiveAsset" JSONB,
    "fileSizeBytes" BIGINT,
    "checksumSha256" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "acknowledgedAt" TIMESTAMP(3),
    "ackImportedCount" INTEGER,
    "ackFailedCount" INTEGER,
    "ackPayload" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "import_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_endpoints" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "events" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "secretHash" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "webhook_endpoints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT,
    "organizationId" TEXT,
    "partnerId" TEXT,
    "action" "AuditAction" NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "detail" JSONB,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE INDEX "organizations_type_idx" ON "organizations"("type");

-- CreateIndex
CREATE INDEX "organizations_isActive_idx" ON "organizations"("isActive");

-- CreateIndex
CREATE INDEX "sites_organizationId_idx" ON "sites"("organizationId");

-- CreateIndex
CREATE INDEX "org_members_organizationId_idx" ON "org_members"("organizationId");

-- CreateIndex
CREATE INDEX "org_members_externalId_idx" ON "org_members"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "org_members_externalId_organizationId_key" ON "org_members"("externalId", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "partners_slug_key" ON "partners"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "partner_api_keys_keyHash_key" ON "partner_api_keys"("keyHash");

-- CreateIndex
CREATE INDEX "partner_api_keys_partnerId_idx" ON "partner_api_keys"("partnerId");

-- CreateIndex
CREATE INDEX "partner_organization_links_partnerId_idx" ON "partner_organization_links"("partnerId");

-- CreateIndex
CREATE INDEX "partner_organization_links_organizationId_idx" ON "partner_organization_links"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "partner_organization_links_partnerId_organizationId_key" ON "partner_organization_links"("partnerId", "organizationId");

-- CreateIndex
CREATE INDEX "patients_organizationId_idx" ON "patients"("organizationId");

-- CreateIndex
CREATE INDEX "patients_fullName_idx" ON "patients"("fullName");

-- CreateIndex
CREATE INDEX "patient_identifiers_system_value_idx" ON "patient_identifiers"("system", "value");

-- CreateIndex
CREATE UNIQUE INDEX "patient_identifiers_patientId_system_value_key" ON "patient_identifiers"("patientId", "system", "value");

-- CreateIndex
CREATE INDEX "scan_batches_organizationId_idx" ON "scan_batches"("organizationId");

-- CreateIndex
CREATE INDEX "processing_jobs_batchId_idx" ON "processing_jobs"("batchId");

-- CreateIndex
CREATE INDEX "processing_jobs_organizationId_status_idx" ON "processing_jobs"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "processing_jobs_organizationId_idempotencyKey_key" ON "processing_jobs"("organizationId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "extracted_records_organizationId_validationStatus_idx" ON "extracted_records"("organizationId", "validationStatus");

-- CreateIndex
CREATE INDEX "extracted_records_jobId_idx" ON "extracted_records"("jobId");

-- CreateIndex
CREATE INDEX "extracted_records_patientId_idx" ON "extracted_records"("patientId");

-- CreateIndex
CREATE INDEX "import_packages_partnerId_status_idx" ON "import_packages"("partnerId", "status");

-- CreateIndex
CREATE INDEX "import_packages_organizationId_status_idx" ON "import_packages"("organizationId", "status");

-- CreateIndex
CREATE INDEX "webhook_endpoints_partnerId_idx" ON "webhook_endpoints"("partnerId");

-- CreateIndex
CREATE INDEX "audit_log_occurredAt_idx" ON "audit_log"("occurredAt");

-- CreateIndex
CREATE INDEX "audit_log_organizationId_occurredAt_idx" ON "audit_log"("organizationId", "occurredAt");

-- CreateIndex
CREATE INDEX "audit_log_partnerId_occurredAt_idx" ON "audit_log"("partnerId", "occurredAt");

-- CreateIndex
CREATE INDEX "audit_log_actorType_actorId_idx" ON "audit_log"("actorType", "actorId");

-- AddForeignKey
ALTER TABLE "sites" ADD CONSTRAINT "sites_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_members" ADD CONSTRAINT "org_members_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_api_keys" ADD CONSTRAINT "partner_api_keys_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_organization_links" ADD CONSTRAINT "partner_organization_links_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_organization_links" ADD CONSTRAINT "partner_organization_links_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_possibleDuplicateOfId_fkey" FOREIGN KEY ("possibleDuplicateOfId") REFERENCES "patients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_identifiers" ADD CONSTRAINT "patient_identifiers_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scan_batches" ADD CONSTRAINT "scan_batches_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scan_batches" ADD CONSTRAINT "scan_batches_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processing_jobs" ADD CONSTRAINT "processing_jobs_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "scan_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processing_jobs" ADD CONSTRAINT "processing_jobs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extracted_records" ADD CONSTRAINT "extracted_records_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "processing_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extracted_records" ADD CONSTRAINT "extracted_records_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extracted_records" ADD CONSTRAINT "extracted_records_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extracted_records" ADD CONSTRAINT "extracted_records_importPackageId_fkey" FOREIGN KEY ("importPackageId") REFERENCES "import_packages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_packages" ADD CONSTRAINT "import_packages_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_packages" ADD CONSTRAINT "import_packages_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_endpoints" ADD CONSTRAINT "webhook_endpoints_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;
