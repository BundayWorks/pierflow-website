-- Patient merge candidates: append-only flags written by the
-- duplicate-scoring cron. A reviewer's MERGE decision re-parents
-- ExtractedRecords from the candidate to the primary; KEEP_SEPARATE
-- is recorded so we never re-flag the same pair.

CREATE TYPE "MergeDecision" AS ENUM (
  'PENDING',
  'MERGE',
  'KEEP_SEPARATE'
);

CREATE TABLE "patient_merge_candidates" (
  "id"                  TEXT PRIMARY KEY,
  "organizationId"      TEXT NOT NULL,
  "primaryPatientId"    TEXT NOT NULL,
  "candidatePatientId"  TEXT NOT NULL,
  "score"               DOUBLE PRECISION NOT NULL,
  "reasons"             JSONB NOT NULL,
  "detectedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewerExternalId"  TEXT,
  "reviewedAt"          TIMESTAMP(3),
  "decision"            "MergeDecision" NOT NULL DEFAULT 'PENDING',
  "reviewerNotes"       TEXT,
  CONSTRAINT "patient_merge_candidates_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "patient_merge_candidates_primaryPatientId_fkey"
    FOREIGN KEY ("primaryPatientId") REFERENCES "patients"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "patient_merge_candidates_candidatePatientId_fkey"
    FOREIGN KEY ("candidatePatientId") REFERENCES "patients"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "patient_merge_candidates_primary_candidate_key"
  ON "patient_merge_candidates"("primaryPatientId", "candidatePatientId");
CREATE INDEX "patient_merge_candidates_org_decision_idx"
  ON "patient_merge_candidates"("organizationId", "decision");
CREATE INDEX "patient_merge_candidates_decision_detectedAt_idx"
  ON "patient_merge_candidates"("decision", "detectedAt");
