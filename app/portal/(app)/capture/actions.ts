"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireSessionContext } from "@/lib/auth";
import { destroyAsset } from "@/lib/cloudinary";

/**
 * Server actions used by the capture page.
 *
 * Every action is scoped by an explicit organizationId — the customer
 * org the operator is capturing for, not the operator's own staff
 * org. We still verify the operator's staff session via Clerk, then
 * confirm the target org is ACTIVE.
 */

async function assertStaffMayCaptureFor(orgId: string) {
  await requireSessionContext();
  // Any staff member can capture for any ACTIVE customer org. When
  // non-admin capture operators land, scope this by OrgMember role.
  const org = await db.organization.findUnique({
    where: { id: orgId },
    select: { id: true, name: true, accessStatus: true, isActive: true, mrnSystem: true },
  });
  if (!org || !org.isActive) throw new Error("ORG_NOT_FOUND");
  if (org.accessStatus !== "ACTIVE") throw new Error("ORG_NOT_ACTIVE");
  return org;
}

/* ── Org picker ────────────────────────────────────────────── */

/**
 * Lists every ACTIVE customer organization the operator may capture
 * for. Sorted with the most recently used by *this* operator first so
 * the picker remembers context across sessions.
 */
export async function listCaptureTargetOrgs() {
  const ctx = await requireSessionContext();
  const orgs = await db.organization.findMany({
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
    },
  });

  // Compute "last used by me" so we can surface the operator's recent
  // org at the top of the picker. Single query, no N+1.
  const recent = await db.scanBatch.findMany({
    where: { operatorId: ctx.externalId },
    orderBy: { createdAt: "desc" },
    take: 1,
    select: { organizationId: true },
  });
  const lastUsedId = recent[0]?.organizationId ?? null;

  if (lastUsedId) {
    orgs.sort((a, b) => {
      if (a.id === lastUsedId) return -1;
      if (b.id === lastUsedId) return 1;
      return 0;
    });
  }
  return orgs;
}

/* ── Batches ────────────────────────────────────────────────── */

const CreateBatchInput = z.object({
  organizationId: z.string().min(1),
  label: z.string().trim().max(120).optional(),
  priority: z.enum(["NORMAL", "URGENT"]).optional(),
});

export async function createBatch(input: z.infer<typeof CreateBatchInput>) {
  const ctx = await requireSessionContext();
  const parsed = CreateBatchInput.parse(input);
  await assertStaffMayCaptureFor(parsed.organizationId);

  const batch = await db.scanBatch.create({
    data: {
      organizationId: parsed.organizationId,
      label: parsed.label?.length ? parsed.label : null,
      priority: parsed.priority ?? "NORMAL",
      operatorId: ctx.externalId,
    },
  });

  revalidatePath("/portal/capture");
  return { batchId: batch.id };
}

/**
 * Pull the most recent batches the operator can resume, scoped to the
 * org they're currently capturing for. Returns an empty list if no org
 * is selected.
 */
export async function listRecentBatches(organizationId: string | null) {
  await requireSessionContext();
  if (!organizationId) return [];
  return db.scanBatch.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      label: true,
      priority: true,
      createdAt: true,
      organizationId: true,
      _count: { select: { jobs: true } },
    },
  });
}

/**
 * Permanently delete a ProcessingJob (a captured page) and its
 * Cloudinary asset. Org-scoped: the staff caller must be allowed to
 * act on the job's org.
 */
export async function deleteJob(jobId: string) {
  await requireSessionContext();

  const job = await db.processingJob.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      organizationId: true,
      sourceAsset: true,
      batchId: true,
    },
  });
  if (!job) throw new Error("JOB_NOT_FOUND");
  await assertStaffMayCaptureFor(job.organizationId);

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
 * Resolve a single batch the caller is allowed to see together with
 * its jobs. Used by the capture page on resume / refresh so the queue
 * persists across reloads.
 */
export async function getBatchForCapture(batchId: string) {
  await requireSessionContext();
  const batch = await db.scanBatch.findUnique({
    where: { id: batchId },
    select: {
      id: true,
      label: true,
      priority: true,
      createdAt: true,
      organizationId: true,
      jobs: {
        orderBy: { createdAt: "desc" },
        take: 100,
        select: {
          id: true,
          status: true,
          recordTypeHint: true,
          chartFolderId: true,
          sourceAsset: true,
          sourceFilename: true,
          createdAt: true,
        },
      },
      chartFolders: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          label: true,
          declaredMrn: true,
          declaredPatientId: true,
          declaredPatient: { select: { id: true, fullName: true } },
          pageCount: true,
          closedAt: true,
          resolvedSource: true,
          resolvedPatient: { select: { id: true, fullName: true } },
        },
      },
    },
  });
  if (!batch) return null;
  await assertStaffMayCaptureFor(batch.organizationId);
  return batch;
}

/* ── Chart folders ────────────────────────────────────────── */

const StartChartInput = z.object({
  batchId: z.string().min(1),
  // Operator declarations — both optional.
  declaredPatientId: z.string().min(1).optional(),
  declaredMrn: z.string().trim().max(80).optional(),
  label: z.string().trim().max(160).optional(),
});

/**
 * Open a new chart inside a batch. The operator photographs pages
 * while the chart is open, then calls closeChartFolder() and the
 * next addFiles() goes into a fresh chart.
 */
export async function startChartFolder(
  input: z.infer<typeof StartChartInput>,
) {
  const ctx = await requireSessionContext();
  const parsed = StartChartInput.parse(input);

  const batch = await db.scanBatch.findUnique({
    where: { id: parsed.batchId },
    select: { id: true, organizationId: true },
  });
  if (!batch) throw new Error("BATCH_NOT_FOUND");
  await assertStaffMayCaptureFor(batch.organizationId);

  if (parsed.declaredPatientId) {
    const patient = await db.patient.findFirst({
      where: { id: parsed.declaredPatientId, organizationId: batch.organizationId },
      select: { id: true },
    });
    if (!patient) throw new Error("DECLARED_PATIENT_NOT_FOUND");
  }

  const folder = await db.chartFolder.create({
    data: {
      batchId: batch.id,
      organizationId: batch.organizationId,
      label: parsed.label?.length ? parsed.label : null,
      operatorId: ctx.externalId,
      declaredPatientId: parsed.declaredPatientId ?? null,
      declaredMrn: parsed.declaredMrn?.length ? parsed.declaredMrn : null,
    },
    select: { id: true },
  });
  revalidatePath("/portal/capture");
  return { chartFolderId: folder.id };
}

export async function closeChartFolder(chartFolderId: string) {
  await requireSessionContext();
  const folder = await db.chartFolder.findUnique({
    where: { id: chartFolderId },
    select: { id: true, organizationId: true, closedAt: true },
  });
  if (!folder) throw new Error("CHART_FOLDER_NOT_FOUND");
  await assertStaffMayCaptureFor(folder.organizationId);

  if (!folder.closedAt) {
    await db.chartFolder.update({
      where: { id: folder.id },
      data: { closedAt: new Date() },
    });
  }

  // Attempt resolution now in case every job in the folder has already
  // finished extracting. If some are still in flight, the extraction
  // worker will re-trigger when the last one lands.
  try {
    const { maybeResolveChartFolderForJob } = await import(
      "@/lib/extraction/chartFolderTrigger"
    );
    await maybeResolveChartFolderForJob(folder.id);
  } catch {
    // best-effort — resolver will run via extraction trigger
  }

  revalidatePath("/portal/capture");
  return { ok: true };
}

/**
 * Look up patients in the current org so the operator can pick one
 * before opening a chart. Returns the top N by name match.
 */
const SearchPatientsInput = z.object({
  organizationId: z.string().min(1),
  query: z.string().trim().max(80),
});

export async function searchPatientsForChart(
  input: z.infer<typeof SearchPatientsInput>,
) {
  await requireSessionContext();
  const parsed = SearchPatientsInput.parse(input);
  await assertStaffMayCaptureFor(parsed.organizationId);
  const q = parsed.query;
  if (q.length < 2) return [];
  return db.patient.findMany({
    where: {
      organizationId: parsed.organizationId,
      OR: [
        { fullName: { contains: q, mode: "insensitive" } },
        {
          identifiers: {
            some: { value: { contains: q, mode: "insensitive" } },
          },
        },
      ],
    },
    take: 10,
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      fullName: true,
      dateOfBirth: true,
      identifiers: {
        take: 3,
        select: { system: true, value: true },
      },
    },
  });
}

/** Increment pageCount on the folder when a new job is registered. */
export async function bumpChartFolderPageCount(
  chartFolderId: string,
  organizationId: string,
) {
  await requireSessionContext();
  await assertStaffMayCaptureFor(organizationId);
  await db.chartFolder.update({
    where: { id: chartFolderId },
    data: { pageCount: { increment: 1 } },
  });
}
