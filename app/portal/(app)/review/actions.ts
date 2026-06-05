"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireSessionContext } from "@/lib/auth";
import { buildFhirBundle, type ExtractedJson } from "@/lib/fhir/mapper";
import { validateExtraction } from "@/lib/validate/rules";
import { mergePatients } from "@/lib/patients/duplicateScoring";

/**
 * Review surface, scoped by customer organization.
 *
 * Like /portal/capture, the review queue now targets one customer org
 * at a time. Staff pick the org via a URL parameter (?orgId=…) handled
 * by the page; every action below requires the orgId so we don't silently
 * leak across tenants. assertStaffMayReviewFor mirrors the capture-side
 * gate.
 */

async function assertStaffMayReviewFor(orgId: string) {
  await requireSessionContext();
  const org = await db.organization.findUnique({
    where: { id: orgId },
    select: { id: true, name: true, accessStatus: true, isActive: true, mrnSystem: true },
  });
  if (!org || !org.isActive) throw new Error("ORG_NOT_FOUND");
  if (org.accessStatus !== "ACTIVE") throw new Error("ORG_NOT_ACTIVE");
  return org;
}

/* ── Org picker ────────────────────────────────────────────── */

export async function listReviewTargetOrgs() {
  await requireSessionContext();
  return db.organization.findMany({
    where: { accessStatus: "ACTIVE", isActive: true },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      type: true,
      country: true,
      state: true,
      lga: true,
      requestedByPartner: { select: { id: true, name: true } },
      _count: {
        select: {
          processingJobs: { where: { status: "AWAITING_REVIEW" } },
        },
      },
    },
  });
}

/* ── Queue ────────────────────────────────────────────────────── */

export async function listReviewQueue(organizationId: string) {
  await assertStaffMayReviewFor(organizationId);
  return db.processingJob.findMany({
    where: { organizationId, status: "AWAITING_REVIEW" },
    orderBy: [
      { priority: "desc" }, // URGENT first
      { createdAt: "asc" }, // FIFO within priority
    ],
    take: 100,
    select: {
      id: true,
      createdAt: true,
      priority: true,
      recordTypeHint: true,
      sourceAsset: true,
      sourceFilename: true,
      batch: { select: { id: true, label: true } },
      extractedRecords: {
        take: 1,
        select: {
          id: true,
          completenessScore: true,
          avgConfidence: true,
          validationStatus: true,
        },
      },
    },
  });
}

/* ── Detail ───────────────────────────────────────────────────── */

export async function getReviewJob(jobId: string) {
  await requireSessionContext();
  const job = await db.processingJob.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      createdAt: true,
      priority: true,
      status: true,
      organizationId: true,
      recordTypeHint: true,
      sourceAsset: true,
      sourceFilename: true,
      organization: { select: { id: true, name: true, mrnSystem: true } },
      batch: { select: { id: true, label: true } },
      extractedRecords: {
        take: 1,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          extractedJson: true,
          fhirBundle: true,
          avgConfidence: true,
          completenessScore: true,
          lowConfidenceFields: true,
          validationStatus: true,
          reviewerNotes: true,
        },
      },
    },
  });
  if (!job) return null;
  await assertStaffMayReviewFor(job.organizationId);
  return job;
}

/* ── Approve / reject / save ──────────────────────────────────── */

const ApproveInput = z.object({
  recordId: z.string().min(1),
  /** Full edited extractedJson — replaces whatever the model produced. */
  data: z.unknown(),
  reviewerNotes: z.string().max(2000).optional(),
});

export async function approveRecord(input: z.infer<typeof ApproveInput>) {
  const ctx = await requireSessionContext();
  const parsed = ApproveInput.parse(input);

  const record = await db.extractedRecord.findUnique({
    where: { id: parsed.recordId },
    select: {
      id: true,
      jobId: true,
      organizationId: true,
      documentType: true,
      avgConfidence: true,
      organization: { select: { id: true, name: true, mrnSystem: true } },
    },
  });
  if (!record) throw new Error("RECORD_NOT_FOUND");
  await assertStaffMayReviewFor(record.organizationId);

  const data = parsed.data as ExtractedJson;

  const fhir = buildFhirBundle({
    data,
    documentType: record.documentType,
    organization: {
      id: record.organization?.id ?? record.organizationId,
      name: record.organization?.name ?? "Unknown organization",
      mrnSystem: record.organization?.mrnSystem ?? null,
    },
  });

  const validation = validateExtraction({
    data,
    // After human edit the original model confidence is no longer
    // meaningful; pin it at 0.95 so the completeness term reflects a
    // human-curated record.
    avgConfidence: 0.95,
  });

  await db.$transaction([
    db.extractedRecord.update({
      where: { id: record.id },
      data: {
        extractedJson: data as object,
        fhirBundle: fhir as unknown as object,
        avgConfidence: 0.95,
        completenessScore: validation.completenessScore,
        lowConfidenceFields: {
          validation: validation.issues,
          disposition: validation.disposition,
        } as object,
        validationStatus: "VALIDATED",
        reviewerExternalId: ctx.externalId,
        reviewedAt: new Date(),
        reviewerNotes: parsed.reviewerNotes ?? null,
      },
    }),
    db.processingJob.update({
      where: { id: record.jobId },
      data: { status: "VALIDATED" },
    }),
  ]);

  revalidatePath("/portal/review");
  return { ok: true };
}

const SaveDraftInput = z.object({
  recordId: z.string().min(1),
  data: z.unknown(),
  reviewerNotes: z.string().max(2000).optional(),
});

/** Save edits without approving. Status stays REVIEW_REQUIRED. */
export async function saveDraft(input: z.infer<typeof SaveDraftInput>) {
  const ctx = await requireSessionContext();
  const parsed = SaveDraftInput.parse(input);

  const record = await db.extractedRecord.findUnique({
    where: { id: parsed.recordId },
    select: { id: true, organizationId: true },
  });
  if (!record) throw new Error("RECORD_NOT_FOUND");
  await assertStaffMayReviewFor(record.organizationId);

  await db.extractedRecord.update({
    where: { id: record.id },
    data: {
      extractedJson: parsed.data as object,
      reviewerNotes: parsed.reviewerNotes ?? null,
      reviewerExternalId: ctx.externalId,
    },
  });
  return { ok: true };
}

const RejectInput = z.object({
  recordId: z.string().min(1),
  reviewerNotes: z.string().min(1).max(2000),
});

export async function rejectRecord(input: z.infer<typeof RejectInput>) {
  const ctx = await requireSessionContext();
  const parsed = RejectInput.parse(input);

  const record = await db.extractedRecord.findUnique({
    where: { id: parsed.recordId },
    select: { id: true, jobId: true, organizationId: true },
  });
  if (!record) throw new Error("RECORD_NOT_FOUND");
  await assertStaffMayReviewFor(record.organizationId);

  await db.$transaction([
    db.extractedRecord.update({
      where: { id: record.id },
      data: {
        validationStatus: "REJECTED",
        reviewerExternalId: ctx.externalId,
        reviewedAt: new Date(),
        reviewerNotes: parsed.reviewerNotes,
      },
    }),
    db.processingJob.update({
      where: { id: record.jobId },
      data: { status: "FAILED", errorCode: "REJECTED_BY_REVIEWER" },
    }),
  ]);

  revalidatePath("/portal/review");
  return { ok: true };
}

/* ── Merge queue ──────────────────────────────────────────── */

export async function listMergeCandidates(organizationId: string) {
  await assertStaffMayReviewFor(organizationId);
  return db.patientMergeCandidate.findMany({
    where: { organizationId, decision: "PENDING" },
    orderBy: [{ score: "desc" }, { detectedAt: "asc" }],
    take: 100,
    select: {
      id: true,
      score: true,
      reasons: true,
      detectedAt: true,
      primaryPatient: {
        select: {
          id: true,
          fullName: true,
          dateOfBirth: true,
          sex: true,
          createdAt: true,
          identifiers: { select: { system: true, value: true }, take: 6 },
          _count: { select: { extractedRecords: true } },
        },
      },
      candidatePatient: {
        select: {
          id: true,
          fullName: true,
          dateOfBirth: true,
          sex: true,
          createdAt: true,
          identifiers: { select: { system: true, value: true }, take: 6 },
          _count: { select: { extractedRecords: true } },
        },
      },
    },
  });
}

const MergeInput = z.object({
  candidateRowId: z.string().min(1),
  reviewerNotes: z.string().max(2000).optional(),
});

export async function acceptMerge(input: z.infer<typeof MergeInput>) {
  const ctx = await requireSessionContext();
  const parsed = MergeInput.parse(input);

  const row = await db.patientMergeCandidate.findUnique({
    where: { id: parsed.candidateRowId },
    select: {
      id: true,
      organizationId: true,
      primaryPatientId: true,
      candidatePatientId: true,
      decision: true,
    },
  });
  if (!row) throw new Error("CANDIDATE_NOT_FOUND");
  await assertStaffMayReviewFor(row.organizationId);
  if (row.decision !== "PENDING") throw new Error("ALREADY_DECIDED");

  await mergePatients({
    primaryPatientId: row.primaryPatientId,
    candidatePatientId: row.candidatePatientId,
    reviewerExternalId: ctx.externalId,
    reviewerNotes: parsed.reviewerNotes,
  });

  revalidatePath("/portal/review");
  return { ok: true };
}

export async function keepSeparate(input: z.infer<typeof MergeInput>) {
  const ctx = await requireSessionContext();
  const parsed = MergeInput.parse(input);

  const row = await db.patientMergeCandidate.findUnique({
    where: { id: parsed.candidateRowId },
    select: { id: true, organizationId: true, decision: true },
  });
  if (!row) throw new Error("CANDIDATE_NOT_FOUND");
  await assertStaffMayReviewFor(row.organizationId);
  if (row.decision !== "PENDING") throw new Error("ALREADY_DECIDED");

  await db.patientMergeCandidate.update({
    where: { id: row.id },
    data: {
      decision: "KEEP_SEPARATE",
      reviewerExternalId: ctx.externalId,
      reviewerNotes: parsed.reviewerNotes ?? null,
      reviewedAt: new Date(),
    },
  });
  revalidatePath("/portal/review");
  return { ok: true };
}

export async function countPendingMergeCandidates(
  organizationId: string,
): Promise<number> {
  // Best-effort; called from the page header so we don't throw on
  // unexpected errors — show 0 instead.
  try {
    await requireSessionContext();
    return db.patientMergeCandidate.count({
      where: { organizationId, decision: "PENDING" },
    });
  } catch {
    return 0;
  }
}
