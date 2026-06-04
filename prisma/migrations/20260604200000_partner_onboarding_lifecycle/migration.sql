-- Partner onboarding lifecycle migration.
--
-- Drops the AccessRequest table (its role is replaced by Partner.accessStatus
-- and the staff partners inbox) and adds the new lifecycle model:
--
--   Partner.accessStatus    PartnerAccessStatus  (PENDING_SANDBOX default)
--   Partner.{sandbox,production}*  timestamps + reviewer ids
--   Partner onboarding context (primaryUseCase, expectedVolume, timeline, country)
--   PartnerProfile          1:1 self-completed company info
--   PartnerAgreement        append-only click-to-sign log
--   PartnerSecurityAssessment 1:1 security questionnaire
--
-- Existing partners (LinkHMS, Porchplus) are backfilled to SANDBOX since
-- they already have keys issued. Anything new starts at PENDING_SANDBOX.

-- ── Drop the old access_requests table ─────────────────────────────
DROP TABLE IF EXISTS "access_requests";
DROP TYPE IF EXISTS "AccessRequestStatus";

-- ── New enums ──────────────────────────────────────────────────────
CREATE TYPE "PartnerAccessStatus" AS ENUM (
  'PENDING_SANDBOX',
  'SANDBOX',
  'PRODUCTION_REQUESTED',
  'PRODUCTION',
  'SUSPENDED'
);

CREATE TYPE "AgreementKind" AS ENUM ('DPA', 'TOS');

-- ── Extend partners ────────────────────────────────────────────────
ALTER TABLE "partners"
  ADD COLUMN "primaryUseCase" TEXT,
  ADD COLUMN "expectedVolume" TEXT,
  ADD COLUMN "timeline" TEXT,
  ADD COLUMN "country" TEXT DEFAULT 'NG',
  ADD COLUMN "accessStatus" "PartnerAccessStatus" NOT NULL DEFAULT 'PENDING_SANDBOX',
  ADD COLUMN "sandboxApprovedAt" TIMESTAMP(3),
  ADD COLUMN "sandboxApprovedBy" TEXT,
  ADD COLUMN "productionRequestedAt" TIMESTAMP(3),
  ADD COLUMN "productionApprovedAt" TIMESTAMP(3),
  ADD COLUMN "productionApprovedBy" TEXT,
  ADD COLUMN "reviewerNotes" TEXT;

-- Existing partners with keys are already trusted — bump them to SANDBOX
-- and backdate sandboxApprovedAt to their creation timestamp.
UPDATE "partners" p
SET
  "accessStatus" = 'SANDBOX',
  "sandboxApprovedAt" = p."createdAt"
WHERE EXISTS (
  SELECT 1 FROM "partner_api_keys" k WHERE k."partnerId" = p.id
);

CREATE INDEX "partners_accessStatus_idx" ON "partners"("accessStatus");

-- ── partner_profiles ───────────────────────────────────────────────
CREATE TABLE "partner_profiles" (
  "partnerId"         TEXT PRIMARY KEY,
  "legalName"         TEXT,
  "registeredAddress" TEXT,
  "contactPhone"      TEXT,
  "completedAt"       TIMESTAMP(3),
  "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "partner_profiles_partnerId_fkey"
    FOREIGN KEY ("partnerId") REFERENCES "partners"(id) ON DELETE CASCADE ON UPDATE CASCADE
);

-- ── partner_agreements ─────────────────────────────────────────────
CREATE TABLE "partner_agreements" (
  "id"                  TEXT PRIMARY KEY,
  "partnerId"           TEXT NOT NULL,
  "kind"                "AgreementKind" NOT NULL,
  "signedAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "signedByExternalId"  TEXT NOT NULL,
  "signedByEmail"       TEXT NOT NULL,
  "signedByName"        TEXT,
  "documentVersion"     TEXT NOT NULL,
  "ipAddress"           TEXT,
  "userAgent"           TEXT,
  CONSTRAINT "partner_agreements_partnerId_fkey"
    FOREIGN KEY ("partnerId") REFERENCES "partners"(id) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "partner_agreements_partnerId_kind_idx" ON "partner_agreements"("partnerId", "kind");

-- ── partner_security_assessments ───────────────────────────────────
CREATE TABLE "partner_security_assessments" (
  "partnerId"           TEXT PRIMARY KEY,
  "dataResidency"       TEXT,
  "retentionDays"       INTEGER,
  "accessControlNotes"  TEXT,
  "encryptsAtRest"      BOOLEAN NOT NULL DEFAULT false,
  "encryptsInTransit"   BOOLEAN NOT NULL DEFAULT false,
  "hasIncidentResponse" BOOLEAN NOT NULL DEFAULT false,
  "hasNda"              BOOLEAN NOT NULL DEFAULT false,
  "completedAt"         TIMESTAMP(3),
  "updatedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "partner_security_assessments_partnerId_fkey"
    FOREIGN KEY ("partnerId") REFERENCES "partners"(id) ON DELETE CASCADE ON UPDATE CASCADE
);
