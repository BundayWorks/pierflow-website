/**
 * Run extraction for a single ProcessingJob: pull its source asset,
 * call Haiku, map to FHIR R4, validate, and persist the result as an
 * ExtractedRecord. Idempotent — safe to call again on a job that's
 * already PROCESSING.
 *
 * Designed to be invoked as a fire-and-forget step right after the
 * /v1/ingest/documents row insert. On Vercel Fluid Compute the
 * function instance stays alive long enough to finish.
 */

import { db } from "@/lib/db";
import { extractPage } from "./extract";
import { buildFhirBundle, type ExtractedJson } from "@/lib/fhir/mapper";
import { validateExtraction } from "@/lib/validate/rules";
import type { RecordValidationStatus } from "@prisma/client";
import { emitFireAndForget } from "@/lib/webhooks";

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
      organization: { select: { id: true, name: true } },
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
    // 1. Extract structured JSON from the image.
    const result = await extractPage({
      imageUrl: src.secureUrl,
      hint: job.recordTypeHint,
      facilityName: job.organization?.name,
    });

    const extractedData = result.data as ExtractedJson;

    // 2. Map to FHIR R4 — defensive, accepts partial input.
    const fhir = buildFhirBundle({
      data: extractedData,
      documentType: job.recordTypeHint,
      organization: {
        id: job.organization?.id ?? job.organizationId,
        name: job.organization?.name ?? "Unknown organization",
      },
    });

    // 3. Validate: required fields, clinical consistency, completeness.
    const validation = validateExtraction({
      data: extractedData,
      avgConfidence: result.avgConfidence,
    });

    // 4. Decide the next state. Validator's disposition is authoritative —
    //    it already considered both completeness and error severity.
    const validationStatus: RecordValidationStatus =
      validation.disposition === "AUTO_APPROVE"
        ? "AUTO_APPROVED"
        : "REVIEW_REQUIRED";

    const jobStatus =
      validation.disposition === "AUTO_APPROVE"
        ? "VALIDATED"
        : "AWAITING_REVIEW";

    // Persist the record and advance the job in one round-trip.
    await db.$transaction([
      db.extractedRecord.create({
        data: {
          jobId: job.id,
          organizationId: job.organizationId,
          documentType: job.recordTypeHint,
          pageNumbers: Array.from({ length: job.pageCount }, (_, i) => i + 1),
          extractedJson: result.data as object,
          fhirBundle: fhir as unknown as object,
          completenessScore: validation.completenessScore,
          avgConfidence: result.avgConfidence,
          lowConfidenceFields: {
            confidence: result.lowConfidenceFields,
            validation: validation.issues,
            disposition: validation.disposition,
          } as object,
          validationStatus,
        },
      }),
      db.processingJob.update({
        where: { id: job.id },
        data: {
          status: jobStatus,
          completedAt: new Date(),
        },
      }),
    ]);

    // Notify partners linked to this org. processing_job.completed
    // fires for both auto-approved and review-required outcomes.
    await emitProcessingJobEvent(
      job.id,
      job.organizationId,
      "processing_job.completed",
      {
        completeness_score: validation.completenessScore,
        avg_confidence: result.avgConfidence,
        validation_status: validationStatus,
        job_status: jobStatus,
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await markFailed(jobId, "EXTRACTION_FAILED", message);
  }
}

async function markFailed(jobId: string, code: string, detail: string) {
  const job = await db.processingJob.update({
    where: { id: jobId },
    data: {
      status: "FAILED",
      errorCode: code,
      errorDetail: detail,
      completedAt: new Date(),
    },
    select: { id: true, organizationId: true },
  });
  await emitProcessingJobEvent(
    job.id,
    job.organizationId,
    "processing_job.failed",
    { error_code: code, error_detail: detail },
  );
}

/**
 * Emit a processing_job.* event to every partner linked to the org.
 * Fire-and-forget per partner so a slow webhook doesn't block the
 * extraction pipeline.
 */
async function emitProcessingJobEvent(
  jobId: string,
  organizationId: string,
  event: "processing_job.completed" | "processing_job.failed",
  extra: Record<string, unknown>,
): Promise<void> {
  const links = await db.partnerOrganizationLink.findMany({
    where: { organizationId },
    select: { partnerId: true },
  });
  for (const { partnerId } of links) {
    emitFireAndForget(partnerId, event, {
      job_id: jobId,
      organization_id: organizationId,
      ...extra,
    });
  }
}
