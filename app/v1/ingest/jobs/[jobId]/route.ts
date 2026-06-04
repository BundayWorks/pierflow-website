import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  resolveIngestActor,
  assertOrgAllowed,
  unauthorized,
  forbidden,
  notFound,
} from "@/lib/ingestAuth";

/**
 * GET /v1/ingest/jobs/{jobId}
 *
 * Returns the current state of a ProcessingJob so partners can poll
 * after submitting documents. Eventually webhooks replace polling for
 * production partners, but the endpoint stays for debugging and for
 * partners who haven't yet wired webhooks.
 *
 * Response shape mirrors what we'd send in a webhook payload so the
 * partner only has to learn one schema.
 */
export async function GET(
  req: Request,
  { params }: { params: { jobId: string } },
) {
  const actor = await resolveIngestActor(req);
  if (!actor) return unauthorized();

  const job = await db.processingJob.findUnique({
    where: { id: params.jobId },
    select: {
      id: true,
      organizationId: true,
      batchId: true,
      status: true,
      pageCount: true,
      recordTypeHint: true,
      priority: true,
      errorCode: true,
      errorDetail: true,
      startedAt: true,
      completedAt: true,
      createdAt: true,
      updatedAt: true,
      extractedRecords: {
        select: {
          id: true,
          documentType: true,
          validationStatus: true,
          completenessScore: true,
          avgConfidence: true,
          importPackageId: true,
        },
      },
    },
  });
  if (!job) return notFound("JOB_NOT_FOUND");

  if (!(await assertOrgAllowed(actor, job.organizationId))) {
    return forbidden("ORG_NOT_LINKED");
  }

  return NextResponse.json({
    job_id: job.id,
    organization_id: job.organizationId,
    batch_id: job.batchId,
    status: job.status,
    page_count: job.pageCount,
    record_type_hint: job.recordTypeHint,
    priority: job.priority,
    error: job.errorCode
      ? { code: job.errorCode, detail: job.errorDetail }
      : null,
    started_at: job.startedAt?.toISOString() ?? null,
    completed_at: job.completedAt?.toISOString() ?? null,
    created_at: job.createdAt.toISOString(),
    updated_at: job.updatedAt.toISOString(),
    records: job.extractedRecords.map((r) => ({
      id: r.id,
      document_type: r.documentType,
      validation_status: r.validationStatus,
      completeness_score: r.completenessScore,
      avg_confidence: r.avgConfidence,
      import_package_id: r.importPackageId,
    })),
  });
}
