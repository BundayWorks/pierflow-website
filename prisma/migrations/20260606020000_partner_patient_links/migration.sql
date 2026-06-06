-- Partner ↔ Pierflow patient id mappings. Enables EMR vendors to
-- query Pierflow with their own external patient id (e.g. their
-- customer's EMR row id) and receive the merged FHIR Bundle without
-- maintaining their own mapping table.
--
-- One row per (partner, Pierflow patient) and one per
-- (partner, external id) — a partner cannot have two external ids for
-- the same patient, nor two of our patients claiming the same
-- external id.

CREATE TYPE "PartnerPatientLinkSource" AS ENUM (
  'AUTO_MRN',
  'AUTO_FUZZY',
  'PARTNER_API',
  'REVIEWER',
  'IMPORT_ACK',
  'PLACEHOLDER_FROM_MRN'
);

CREATE TABLE "partner_patient_links" (
  "id"                  TEXT PRIMARY KEY,
  "partnerId"           TEXT NOT NULL,
  "patientId"           TEXT NOT NULL,
  "organizationId"      TEXT NOT NULL,
  "externalId"          TEXT NOT NULL,
  "externalSystem"      TEXT,
  "source"              "PartnerPatientLinkSource" NOT NULL,
  "confidence"          DOUBLE PRECISION DEFAULT 1.0,
  "linkedAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "linkedByExternalId"  TEXT,
  CONSTRAINT "partner_patient_links_partnerId_fkey"
    FOREIGN KEY ("partnerId") REFERENCES "partners"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "partner_patient_links_patientId_fkey"
    FOREIGN KEY ("patientId") REFERENCES "patients"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "partner_patient_links_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "partner_patient_links_partner_patient_key"
  ON "partner_patient_links"("partnerId", "patientId");
CREATE UNIQUE INDEX "partner_patient_links_partner_external_key"
  ON "partner_patient_links"("partnerId", "externalId");
CREATE INDEX "partner_patient_links_patientId_idx"
  ON "partner_patient_links"("patientId");
CREATE INDEX "partner_patient_links_organizationId_idx"
  ON "partner_patient_links"("organizationId");
