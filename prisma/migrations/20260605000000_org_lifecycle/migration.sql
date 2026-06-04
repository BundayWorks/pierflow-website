-- Organization lifecycle: partners can now register their own customer
-- orgs through the portal. Pierflow staff review + approve before the
-- org can be used for capture / ingest.
--
-- Existing orgs are backfilled to ACTIVE so they keep working — they
-- were all created by staff prior to this migration.

CREATE TYPE "OrgAccessStatus" AS ENUM (
  'PENDING',
  'ACTIVE',
  'REJECTED',
  'SUSPENDED'
);

CREATE TYPE "OrgApprovalAction" AS ENUM (
  'REQUESTED',
  'APPROVED',
  'REJECTED',
  'SUSPENDED',
  'REINSTATED',
  'EDITED'
);

ALTER TABLE "organizations"
  ADD COLUMN "mrnSystem"             TEXT,
  ADD COLUMN "accessStatus"          "OrgAccessStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "requestedByPartnerId"  TEXT,
  ADD COLUMN "requestedByExternalId" TEXT,
  ADD COLUMN "approvedByExternalId"  TEXT,
  ADD COLUMN "approvedAt"            TIMESTAMP(3),
  ADD COLUMN "rejectionReason"       TEXT,
  ADD COLUMN "reviewerNotes"         TEXT;

CREATE INDEX "organizations_accessStatus_idx"
  ON "organizations"("accessStatus");

CREATE INDEX "organizations_requestedByPartnerId_idx"
  ON "organizations"("requestedByPartnerId");

ALTER TABLE "organizations"
  ADD CONSTRAINT "organizations_requestedByPartnerId_fkey"
  FOREIGN KEY ("requestedByPartnerId") REFERENCES "partners"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "organization_approval_events" (
  "id"               TEXT PRIMARY KEY,
  "organizationId"   TEXT NOT NULL,
  "action"           "OrgApprovalAction" NOT NULL,
  "actorExternalId"  TEXT,
  "notes"            TEXT,
  "detail"           JSONB,
  "occurredAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "organization_approval_events_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "organization_approval_events_organizationId_occurredAt_idx"
  ON "organization_approval_events"("organizationId", "occurredAt");
