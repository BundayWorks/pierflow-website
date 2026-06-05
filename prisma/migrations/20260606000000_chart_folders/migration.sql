-- Chart folders: group pages from one capture session for a single
-- patient so identity is resolved at folder level, not per page.
--
-- ProcessingJob gains an optional `chartFolderId`. Existing jobs are
-- left null and the resolver treats them as single-page charts so
-- nothing breaks.

CREATE TYPE "ChartFolderResolution" AS ENUM (
  'UNRESOLVED',
  'DECLARED_BY_OPERATOR',
  'MRN_LOOKUP',
  'FUZZY_MATCH',
  'NEW_PATIENT'
);

CREATE TABLE "chart_folders" (
  "id"                  TEXT PRIMARY KEY,
  "batchId"             TEXT NOT NULL,
  "organizationId"      TEXT NOT NULL,
  "label"               TEXT,
  "operatorId"          TEXT,
  "declaredPatientId"   TEXT,
  "declaredMrn"         TEXT,
  "declaredAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedPatientId"   TEXT,
  "resolvedAt"          TIMESTAMP(3),
  "resolvedConfidence"  DOUBLE PRECISION,
  "resolvedSource"      "ChartFolderResolution" NOT NULL DEFAULT 'UNRESOLVED',
  "reviewerNotes"       TEXT,
  "pageCount"           INTEGER NOT NULL DEFAULT 0,
  "closedAt"            TIMESTAMP(3),
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "chart_folders_batchId_fkey"
    FOREIGN KEY ("batchId") REFERENCES "scan_batches"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "chart_folders_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "chart_folders_declaredPatientId_fkey"
    FOREIGN KEY ("declaredPatientId") REFERENCES "patients"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "chart_folders_resolvedPatientId_fkey"
    FOREIGN KEY ("resolvedPatientId") REFERENCES "patients"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "chart_folders_batchId_idx" ON "chart_folders"("batchId");
CREATE INDEX "chart_folders_organizationId_idx" ON "chart_folders"("organizationId");
CREATE INDEX "chart_folders_resolvedSource_idx" ON "chart_folders"("resolvedSource");

ALTER TABLE "processing_jobs"
  ADD COLUMN "chartFolderId" TEXT,
  ADD CONSTRAINT "processing_jobs_chartFolderId_fkey"
    FOREIGN KEY ("chartFolderId") REFERENCES "chart_folders"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "processing_jobs_chartFolderId_idx"
  ON "processing_jobs"("chartFolderId");
