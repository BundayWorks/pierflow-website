import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import type { DocumentType, JobPriority } from "@prisma/client";
import { runExtractionForJob } from "@/lib/extraction/runExtraction";
import {
  resolveIngestActor,
  assertOrgAllowed,
  unauthorized,
  forbidden,
  notFound,
  validationError,
} from "@/lib/ingestAuth";

/**
 * POST /v1/ingest/documents
 *
 * Called after a file has been uploaded to Cloudinary (via /v1/uploads/sign).
 * Creates a ProcessingJob row tied to a ScanBatch + Organization. The
 * request returns 202 with a job_id immediately; extraction (Haiku)
 * runs out of band.
 *
 * Accepts:
 *   - Staff Clerk session (the /portal/capture flow)
 *   - Partner bearer token (programmatic ingest)
 *
 * Partners MUST pass organizationId in the body. The organization must
 * be ACTIVE and the partner must have a PartnerOrganizationLink to it.
 */

const SourceAsset = z.object({
  publicId: z.string().min(1),
  secureUrl: z.string().url().optional(),
  format: z.string().optional(),
  bytes: z.number().int().nonnegative().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  version: z.union([z.string(), z.number()]).optional(),
});

const Body = z.object({
  organizationId: z.string().min(1).optional(),
  batchId: z.string().min(1),
  /**
   * Optional chart-folder id this page belongs to. When set, the
   * extracted record's identity is resolved at folder level once the
   * folder closes (see lib/extraction/resolveChartFolderIdentity).
   */
  chartFolderId: z.string().min(1).optional(),
  source: SourceAsset,
  filename: z.string().max(255).optional(),
  documentType: z
    .enum([
      "AUTO",
      "OUTPATIENT_CARD",
      "REGISTRATION",
      "LAB_RESULT",
      "PRESCRIPTION",
      "ANTENATAL",
      "IMMUNISATION",
      "DISCHARGE_SUMMARY",
      "XRAY_REPORT",
      "ULTRASOUND_REPORT",
      "OPERATION_NOTE",
      "REFERRAL_LETTER",
      "OTHER",
    ])
    .optional(),
  priority: z.enum(["NORMAL", "URGENT"]).optional(),
  pageCount: z.number().int().positive().max(200).optional(),
  /** Optional idempotency key so retries don't double-insert. */
  idempotencyKey: z.string().max(120).optional(),
});

export async function POST(req: Request) {
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (err) {
    return validationError(err instanceof z.ZodError ? err.issues : undefined);
  }

  const actor = await resolveIngestActor(req);
  if (!actor) return unauthorized();

  // Always-explicit organization scoping (see /v1/uploads/sign for the
  // history): jobs used to silently target the staff user's org, which
  // pushed customer-org captures into the platform org. Now every
  // ingest request has to name the target org and pass the
  // assertOrgAllowed check below.
  if (!body.organizationId) {
    return validationError({ organizationId: "REQUIRED" });
  }
  const organizationId = body.organizationId;

  if (!(await assertOrgAllowed(actor, organizationId))) {
    return forbidden("ORG_NOT_LINKED");
  }

  // Verify the batch exists in that org. Stops a client from creating
  // jobs against a batch in another tenant.
  const batch = await db.scanBatch.findUnique({
    where: { id: body.batchId },
    select: { organizationId: true, priority: true },
  });
  if (!batch || batch.organizationId !== organizationId) {
    return notFound("BATCH_NOT_FOUND");
  }

  // If a chart folder was supplied, validate it belongs to this batch
  // and that it isn't already closed (closed folders are eligible for
  // resolution and shouldn't take new pages).
  if (body.chartFolderId) {
    const folder = await db.chartFolder.findUnique({
      where: { id: body.chartFolderId },
      select: { id: true, batchId: true, closedAt: true },
    });
    if (!folder || folder.batchId !== body.batchId) {
      return notFound("CHART_FOLDER_NOT_FOUND");
    }
    if (folder.closedAt) {
      return validationError({ chartFolderId: "CHART_FOLDER_CLOSED" });
    }
  }

  // Idempotency: same key in the same org returns the original row.
  if (body.idempotencyKey) {
    const existing = await db.processingJob.findUnique({
      where: {
        organizationId_idempotencyKey: {
          organizationId,
          idempotencyKey: body.idempotencyKey,
        },
      },
    });
    if (existing) {
      return NextResponse.json(
        {
          status: "accepted",
          job_id: existing.id,
          batch_id: existing.batchId,
          deduped: true,
        },
        { status: 202 },
      );
    }
  }

  const documentType: DocumentType = body.documentType ?? "AUTO";
  const priority: JobPriority = body.priority ?? batch.priority;

  const job = await db.processingJob.create({
    data: {
      batchId: body.batchId,
      organizationId,
      chartFolderId: body.chartFolderId ?? null,
      sourceAsset: body.source as object,
      sourceFilename: body.filename ?? null,
      pageCount: body.pageCount ?? 1,
      recordTypeHint: documentType,
      priority,
      status: "QUEUED",
      idempotencyKey: body.idempotencyKey ?? null,
    },
    select: { id: true, batchId: true, status: true, pageCount: true },
  });

  // Maintain the folder's page count so the capture UI can show
  // progress without a join on every list query.
  if (body.chartFolderId) {
    void db.chartFolder
      .update({
        where: { id: body.chartFolderId },
        data: { pageCount: { increment: 1 } },
      })
      .catch(() => {});
  }

  // Fire-and-forget extraction. Vercel Fluid Compute keeps the function
  // instance alive past the response.
  void runExtractionForJob(job.id).catch((err) => {
    if (process.env.NODE_ENV !== "production") {
      console.error("[ingest] extraction kickoff failed:", err);
    }
  });

  return NextResponse.json(
    {
      status: "accepted",
      job_id: job.id,
      batch_id: job.batchId,
      pages: job.pageCount,
      job_status: job.status,
    },
    { status: 202 },
  );
}
