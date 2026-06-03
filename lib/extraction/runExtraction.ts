/**
 * Run extraction for a single ProcessingJob: pull its source asset,
 * call Haiku, persist the result as an ExtractedRecord, and advance
 * the job's status. Idempotent — safe to call again on a job that's
 * already PROCESSING.
 *
 * Designed to be invoked as a fire-and-forget step right after the
 * /v1/ingest/documents row insert. On Vercel Fluid Compute the
 * function instance stays alive long enough to finish.
 */

import { db } from "@/lib/db";
import { extractPage } from "./extract";

export async function runExtractionForJob(jobId: string): Promise<void> {
  // Atomic claim — only one worker can advance a QUEUED job at a time.
  // If the row is already PROCESSING, returns null and we exit.
  const claim = await db.processingJob.updateMany({
    where: { id: jobId, status: "QUEUED" },
    data: { status: "PROCESSING", startedAt: new Date() },
  });
  if (claim.count === 0) return;

  const job = await db.processingJob.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      organizationId: true,
      sourceAsset: true,
      recordTypeHint: true,
      pageCount: true,
      organization: { select: { name: true } },
    },
  });
  if (!job) return;

  const src = (job.sourceAsset ?? {}) as {
    publicId?: string;
    secureUrl?: string;
  };
  if (!src.secureUrl) {
    await markFailed(jobId, "ASSET_MISSING_URL", "sourceAsset.secureUrl was missing");
    return;
  }

  try {
    const result = await extractPage({
      imageUrl: src.secureUrl,
      hint: job.recordTypeHint,
      facilityName: job.organization?.name,
    });

    await db.extractedRecord.create({
      data: {
        jobId: job.id,
        organizationId: job.organizationId,
        documentType: job.recordTypeHint,
        pageNumbers: Array.from({ length: job.pageCount }, (_, i) => i + 1),
        extractedJson: result.data as object,
        avgConfidence: result.avgConfidence,
        lowConfidenceFields: result.lowConfidenceFields as object,
        validationStatus:
          result.avgConfidence >= 0.85
            ? "AUTO_APPROVED"
            : result.lowConfidenceFields.length > 0
              ? "REVIEW_REQUIRED"
              : "PENDING",
      },
    });

    await db.processingJob.update({
      where: { id: job.id },
      data: {
        status:
          result.avgConfidence >= 0.85 ? "VALIDATED" : "AWAITING_REVIEW",
        completedAt: new Date(),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await markFailed(jobId, "EXTRACTION_FAILED", message);
  }
}

async function markFailed(jobId: string, code: string, detail: string) {
  await db.processingJob.update({
    where: { id: jobId },
    data: {
      status: "FAILED",
      errorCode: code,
      errorDetail: detail,
      completedAt: new Date(),
    },
  });
}
