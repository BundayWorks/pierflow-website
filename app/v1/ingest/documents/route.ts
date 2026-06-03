import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import { getOrCreateSessionContext } from "@/lib/auth";
import { db } from "@/lib/db";
import type { DocumentType, JobPriority } from "@prisma/client";

/**
 * POST /v1/ingest/documents
 *
 * Called by the capture page (and, in the future, by direct-upload
 * server-to-server integrations) after a file has been uploaded to
 * Cloudinary. Creates a ProcessingJob row tied to a ScanBatch and the
 * caller's Organization.
 *
 * This is the asynchronous handoff point — the request returns 202 with
 * a job_id immediately; extraction (Haiku) runs out of band in the next
 * step of the pipeline.
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
  batchId: z.string().min(1),
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
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      {
        error: "VALIDATION_ERROR",
        details: err instanceof z.ZodError ? err.issues : undefined,
      },
      { status: 422 },
    );
  }

  const ctx = await getOrCreateSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  // Verify the batch exists in the caller's organization. This is what
  // stops a client from creating jobs against someone else's batch.
  const batch = await db.scanBatch.findUnique({
    where: { id: body.batchId },
    select: { organizationId: true, priority: true },
  });
  if (!batch || batch.organizationId !== ctx.organization.id) {
    return NextResponse.json({ error: "BATCH_NOT_FOUND" }, { status: 404 });
  }

  // Idempotency: same key in the same org returns the original row.
  if (body.idempotencyKey) {
    const existing = await db.processingJob.findUnique({
      where: {
        organizationId_idempotencyKey: {
          organizationId: ctx.organization.id,
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
      organizationId: ctx.organization.id,
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

  // Phase 1 ships without auto-trigger — extraction happens in the next
  // step. When that's wired we'll enqueue here.

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
