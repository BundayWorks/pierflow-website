"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireSessionContext } from "@/lib/auth";
import { destroyAsset } from "@/lib/cloudinary";

/**
 * Server actions used by the capture page.
 *
 * Each action resolves the caller's Organization via the Clerk session,
 * so we never trust an organizationId passed from the client.
 */

const CreateBatchInput = z.object({
  label: z.string().trim().max(120).optional(),
  priority: z.enum(["NORMAL", "URGENT"]).optional(),
});

export async function createBatch(input: z.infer<typeof CreateBatchInput>) {
  const ctx = await requireSessionContext();
  const parsed = CreateBatchInput.parse(input);

  const batch = await db.scanBatch.create({
    data: {
      organizationId: ctx.organization.id,
      label: parsed.label?.length ? parsed.label : null,
      priority: parsed.priority ?? "NORMAL",
      operatorId: ctx.externalId,
    },
  });

  revalidatePath("/portal/capture");
  return { batchId: batch.id };
}

/**
 * Pull the most recent active-ish batches so an operator can resume one
 * instead of starting a fresh batch every time the page reloads.
 */
export async function listRecentBatches() {
  const ctx = await requireSessionContext();
  return db.scanBatch.findMany({
    where: { organizationId: ctx.organization.id },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      label: true,
      priority: true,
      createdAt: true,
      _count: { select: { jobs: true } },
    },
  });
}

/**
 * Permanently delete a ProcessingJob (a captured page) and its
 * Cloudinary asset. Scoped to the caller's organization — a malicious
 * client cannot delete someone else's job.
 *
 * We delete the DB row first so a duplicate request can't both succeed.
 * The Cloudinary destroy is best-effort: if it fails, we leave the
 * orphan and a future janitor can clean it up. The user's view doesn't
 * depend on Cloudinary state.
 */
export async function deleteJob(jobId: string) {
  const ctx = await requireSessionContext();

  const job = await db.processingJob.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      organizationId: true,
      sourceAsset: true,
      batchId: true,
    },
  });
  if (!job || job.organizationId !== ctx.organization.id) {
    throw new Error("JOB_NOT_FOUND");
  }

  // ExtractedRecords cascade via Prisma's relation, so we can just drop
  // the job and Postgres handles the rest.
  await db.processingJob.delete({ where: { id: jobId } });

  const src = (job.sourceAsset ?? {}) as {
    publicId?: string;
    secureUrl?: string;
  };
  if (src.publicId) {
    void destroyAsset(src.publicId);
  }

  revalidatePath("/portal/capture");
  return { deleted: true };
}

/**
 * Resolve a single batch the caller is allowed to see, together with
 * the jobs that have been ingested into it. Used by the capture page on
 * resume / refresh so the queue persists across reloads.
 */
export async function getBatchForCapture(batchId: string) {
  const ctx = await requireSessionContext();
  return db.scanBatch.findFirst({
    where: { id: batchId, organizationId: ctx.organization.id },
    select: {
      id: true,
      label: true,
      priority: true,
      createdAt: true,
      jobs: {
        orderBy: { createdAt: "desc" },
        take: 100,
        select: {
          id: true,
          status: true,
          recordTypeHint: true,
          sourceAsset: true,
          sourceFilename: true,
          createdAt: true,
        },
      },
    },
  });
}
