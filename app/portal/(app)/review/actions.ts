"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireSessionContext } from "@/lib/auth";
import { buildFhirBundle, type ExtractedJson } from "@/lib/fhir/mapper";
import { validateExtraction } from "@/lib/validate/rules";

/* ── Queue ────────────────────────────────────────────────────── */

export async function listReviewQueue() {
  const ctx = await requireSessionContext();
  return db.processingJob.findMany({
    where: {
      organizationId: ctx.organization.id,
      status: "AWAITING_REVIEW",
    },
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
  const ctx = await requireSessionContext();
  return db.processingJob.findFirst({
    where: { id: jobId, organizationId: ctx.organization.id },
    select: {
      id: true,
      createdAt: true,
      priority: true,
      status: true,
      recordTypeHint: true,
      sourceAsset: true,
      sourceFilename: true,
      organization: { select: { id: true, name: true } },
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
}

/* ── Approve / reject / save ──────────────────────────────────── */

const ApproveInput = z.object({
  recordId: z.string().min(1),
  /** Full edited extractedJson — replaces whatever the model produced. */
  data: z.unknown(),
  reviewerNotes: z.string().max(2000).optional(),
});

/**
 * Apply edits and approve the record. Rebuilds the FHIR bundle from the
 * edited data and revalidates so the disposition reflects human work.
 */
export async function approveRecord(input: z.infer<typeof ApproveInput>) {
  const ctx = await requireSessionContext();
  const parsed = ApproveInput.parse(input);

  const record = await db.extractedRecord.findFirst({
    where: { id: parsed.recordId, organizationId: ctx.organization.id },
    select: {
      id: true,
      jobId: true,
      documentType: true,
      avgConfidence: true,
      organization: { select: { id: true, name: true } },
    },
  });
  if (!record) throw new Error("RECORD_NOT_FOUND");

  const data = parsed.data as ExtractedJson;

  const fhir = buildFhirBundle({
    data,
    documentType: record.documentType,
    organization: {
      id: record.organization?.id ?? ctx.organization.id,
      name: record.organization?.name ?? ctx.organization.name,
    },
  });

  // Re-run validation against the edited data. A reviewer can decide to
  // approve even with WARN-level issues; we record the latest state.
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

  const record = await db.extractedRecord.findFirst({
    where: { id: parsed.recordId, organizationId: ctx.organization.id },
    select: { id: true },
  });
  if (!record) throw new Error("RECORD_NOT_FOUND");

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

  const record = await db.extractedRecord.findFirst({
    where: { id: parsed.recordId, organizationId: ctx.organization.id },
    select: { id: true, jobId: true },
  });
  if (!record) throw new Error("RECORD_NOT_FOUND");

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
