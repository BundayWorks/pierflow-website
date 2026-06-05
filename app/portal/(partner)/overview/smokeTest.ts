"use server";

import { cloudinary, ensureConfigured } from "@/lib/cloudinary";
import { db } from "@/lib/db";
import { requirePartnerUser } from "@/lib/auth";
import { runExtractionForJob } from "@/lib/extraction/runExtraction";

const SAMPLE_IMAGE_URL =
  (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.pierflow.com").replace(
    /\/$/,
    "",
  ) + "/sample-outpatient-card.svg";

export type SmokeTestStep =
  | "key"
  | "organization"
  | "batch"
  | "upload"
  | "ingest";

export type SmokeTestResult =
  | {
      ok: true;
      steps: { step: SmokeTestStep; label: string; detail: string }[];
      jobId: string;
      batchId: string;
      organizationId: string;
      organizationName: string;
    }
  | {
      ok: false;
      steps: { step: SmokeTestStep; label: string; detail: string }[];
      failedStep: SmokeTestStep;
      message: string;
    };

/**
 * One-click "Try the API" runner.
 *
 * Walks the partner-side ingest flow end-to-end against a real sample
 * image so the partner can prove their account works in under a minute:
 *
 *   1. Resolve an active API key for the partner (must exist).
 *   2. Resolve a target ACTIVE organization (link must exist).
 *   3. Create a ScanBatch on that org.
 *   4. Upload the sample image to Cloudinary (server-side; we don't
 *      bounce through the partner's browser to keep this single-call).
 *   5. Create a ProcessingJob from the upload — same code path as the
 *      partner's own /v1/ingest/documents calls would hit, just minus
 *      the bearer-token unwrap. Extraction kicks off async.
 *
 * Returns step-by-step status so the UI can render a progress list.
 */
export async function runSmokeTest(): Promise<SmokeTestResult> {
  const { partner } = await requirePartnerUser();
  const steps: { step: SmokeTestStep; label: string; detail: string }[] = [];

  // ── 1. Active key ──────────────────────────────────────────
  const activeKey = await db.partnerApiKey.findFirst({
    where: {
      partnerId: partner.id,
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, last4: true, label: true },
  });
  if (!activeKey) {
    return {
      ok: false,
      steps,
      failedStep: "key",
      message:
        "You don't have an active API key yet. Issue one from the API keys page first.",
    };
  }
  steps.push({
    step: "key",
    label: "Active API key",
    detail: `${activeKey.label ?? "Unlabeled"} · …${activeKey.last4}`,
  });

  // ── 2. Target org ──────────────────────────────────────────
  const orgLink = await db.partnerOrganizationLink.findFirst({
    where: {
      partnerId: partner.id,
      organization: { accessStatus: "ACTIVE", isActive: true },
    },
    select: {
      organization: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  if (!orgLink) {
    return {
      ok: false,
      steps,
      failedStep: "organization",
      message:
        "You're not linked to any ACTIVE organization. Register one from the Organizations page and wait for Pierflow to approve it.",
    };
  }
  const organizationId = orgLink.organization.id;
  steps.push({
    step: "organization",
    label: "Target organization",
    detail: orgLink.organization.name,
  });

  // ── 3. Scan batch ──────────────────────────────────────────
  let batchId: string;
  try {
    const batch = await db.scanBatch.create({
      data: {
        organizationId,
        label: "Try the API — sample outpatient card",
        priority: "NORMAL",
        operatorId: `partner:${partner.id}`,
        metadata: { source: "try-the-api" },
      },
      select: { id: true },
    });
    batchId = batch.id;
  } catch (err) {
    return {
      ok: false,
      steps,
      failedStep: "batch",
      message:
        err instanceof Error
          ? `Couldn't create a batch: ${err.message}`
          : "Couldn't create a batch.",
    };
  }
  steps.push({
    step: "batch",
    label: "Scan batch created",
    detail: batchId,
  });

  // ── 4. Upload the sample image to Cloudinary ──────────────
  let publicId: string;
  let secureUrl: string;
  let width: number | undefined;
  let height: number | undefined;
  let bytes: number | undefined;
  let format: string | undefined;
  let version: string | undefined;
  try {
    // The Cloudinary SDK is lazy — nothing reads CLOUDINARY_* until we
    // call config(). The buildSignedUpload / destroyAsset / etc. helpers
    // call ensureConfigured() themselves; we use the raw uploader here
    // so we have to do it explicitly.
    ensureConfigured();
    const result = await cloudinary.uploader.upload(SAMPLE_IMAGE_URL, {
      folder: `pierflow/${organizationId}/${batchId}`,
      resource_type: "image",
      type: "upload",
    });
    publicId = result.public_id;
    secureUrl = result.secure_url;
    width = result.width;
    height = result.height;
    bytes = result.bytes;
    format = result.format;
    version = String(result.version);
  } catch (err) {
    return {
      ok: false,
      steps,
      failedStep: "upload",
      message:
        err instanceof Error
          ? `Cloudinary upload failed: ${err.message}`
          : "Cloudinary upload failed.",
    };
  }
  steps.push({
    step: "upload",
    label: "Sample image uploaded",
    detail: publicId,
  });

  // ── 5. Ingest job (same code path as /v1/ingest/documents) ─
  let jobId: string;
  try {
    const job = await db.processingJob.create({
      data: {
        batchId,
        organizationId,
        sourceAsset: {
          publicId,
          secureUrl,
          format,
          bytes,
          width,
          height,
          version,
        },
        sourceFilename: "sample-outpatient-card.svg",
        pageCount: 1,
        recordTypeHint: "OUTPATIENT_CARD",
        priority: "NORMAL",
        status: "QUEUED",
      },
      select: { id: true },
    });
    jobId = job.id;

    // Fire-and-forget extraction so the user sees a job_id immediately
    // and the worker runs in the background — same as production ingest.
    void runExtractionForJob(jobId).catch((err) => {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[smoke-test] extraction kickoff failed:", err);
      }
    });
  } catch (err) {
    return {
      ok: false,
      steps,
      failedStep: "ingest",
      message:
        err instanceof Error
          ? `Couldn't register the ingest job: ${err.message}`
          : "Couldn't register the ingest job.",
    };
  }
  steps.push({
    step: "ingest",
    label: "Ingest job queued",
    detail: jobId,
  });

  return {
    ok: true,
    steps,
    jobId,
    batchId,
    organizationId,
    organizationName: orgLink.organization.name,
  };
}

/**
 * Look up the current state of a smoke-test job. Used by the UI to
 * poll until the job moves out of QUEUED / PROCESSING.
 */
export async function getSmokeTestJob(jobId: string) {
  const { partner } = await requirePartnerUser();

  const job = await db.processingJob.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      organizationId: true,
      status: true,
      errorCode: true,
      errorDetail: true,
      startedAt: true,
      completedAt: true,
      extractedRecords: {
        select: {
          id: true,
          patientId: true,
          documentType: true,
          validationStatus: true,
          avgConfidence: true,
          completenessScore: true,
        },
      },
    },
  });
  if (!job) throw new Error("JOB_NOT_FOUND");

  // Ensure the job actually belongs to one of the partner's orgs.
  const link = await db.partnerOrganizationLink.findUnique({
    where: {
      partnerId_organizationId: {
        partnerId: partner.id,
        organizationId: job.organizationId,
      },
    },
    select: { partnerId: true },
  });
  if (!link) throw new Error("ORG_NOT_LINKED");

  const record = job.extractedRecords[0] ?? null;
  return {
    jobId: job.id,
    status: job.status,
    errorCode: job.errorCode,
    errorDetail: job.errorDetail,
    startedAt: job.startedAt?.toISOString() ?? null,
    completedAt: job.completedAt?.toISOString() ?? null,
    record: record
      ? {
          id: record.id,
          patientId: record.patientId,
          documentType: record.documentType,
          validationStatus: record.validationStatus,
          avgConfidence: record.avgConfidence,
          completenessScore: record.completenessScore,
        }
      : null,
  };
}
