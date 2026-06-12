/**
 * Claims orchestrator.
 *
 * Mirrors the enrollment shape — the fintech submits a claim on
 * behalf of a member; we forward to the HMO connector; status is
 * polled every 4h by the cron until terminal. No auto-adjudication.
 *
 * Lifecycle events fire as webhooks (`hmo_claim.*`) so the fintech
 * can update its UI in real time:
 *
 *   SUBMITTED → PENDING_HMO → UNDER_REVIEW → APPROVED → PAID
 *                                          ↓
 *                                       REJECTED (terminal)
 */

import {
  Prisma,
  type HmoClaimStatus,
  type HmoClaimEventKind,
} from "@prisma/client";
import { db } from "@/lib/db";
import {
  stubSubmitClaim,
  stubGetClaimStatus,
  type StubClaimStatus,
} from "@/lib/insurance/stub-connector.ts";
import { emitFireAndForget, type WebhookEventName } from "@/lib/webhooks";
import { syncClaimToMedplumFull } from "@/lib/cover/sync.ts";

// ─────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────

export type CreateClaimInput = {
  partnerId: string;
  enrollmentId: string;
  fintechUserRef: string;
  serviceDate: string; // ISO date
  serviceType?: string | null;
  facilityName?: string | null;
  facilityNetworkProviderId?: string | null;
  amountNgn: bigint;
  diagnosisCodes: string[];
  procedureCodes?: string[];
  notes?: string | null;
  idempotencyKey?: string;
};

export type CreateClaimResult =
  | { ok: true; claim: ClaimSummary; idempotentReplay: boolean }
  | {
      ok: false;
      reason:
        | "ENROLLMENT_NOT_FOUND"
        | "ENROLLMENT_NOT_ACTIVE"
        | "CONNECTOR_REFUSED"
        | "INTERNAL";
      detail?: string;
    };

export type ClaimSummary = {
  id: string;
  partner_id: string;
  enrollment_id: string;
  fintech_user_ref: string;
  hmo_claim_id: string | null;
  service_date: string;
  service_type: string | null;
  facility_name: string | null;
  amount_ngn: string;
  status: HmoClaimStatus;
  approved_amount_ngn: string | null;
  paid_amount_ngn: string | null;
  rejection_reason: string | null;
  diagnosis_codes: string[];
  procedure_codes: string[];
  notes: string | null;
  created_at: string;
  updated_at: string;
  last_polled_at: string | null;
};

// ─────────────────────────────────────────────────────────────────────
// Webhook helper
// ─────────────────────────────────────────────────────────────────────

function fireClaimWebhook(
  partnerId: string,
  event: WebhookEventName,
  claim: ClaimSummary,
  extra?: Record<string, unknown>,
) {
  emitFireAndForget(partnerId, event, {
    claim_id: claim.id,
    enrollment_id: claim.enrollment_id,
    fintech_user_ref: claim.fintech_user_ref,
    hmo_claim_id: claim.hmo_claim_id,
    status: claim.status,
    amount_ngn: claim.amount_ngn,
    approved_amount_ngn: claim.approved_amount_ngn,
    paid_amount_ngn: claim.paid_amount_ngn,
    rejection_reason: claim.rejection_reason,
    updated_at: claim.updated_at,
    ...(extra ?? {}),
  });
}

// ─────────────────────────────────────────────────────────────────────
// createClaim
// ─────────────────────────────────────────────────────────────────────

export async function createClaim(
  input: CreateClaimInput,
): Promise<CreateClaimResult> {
  // Idempotency replay
  if (input.idempotencyKey) {
    const existing = await db.hmoClaim.findUnique({
      where: {
        partnerId_idempotencyKey: {
          partnerId: input.partnerId,
          idempotencyKey: input.idempotencyKey,
        },
      },
    });
    if (existing) {
      return {
        ok: true,
        idempotentReplay: true,
        claim: toSummary(existing),
      };
    }
  }

  const enrollment = await db.hmoEnrollment.findUnique({
    where: { id: input.enrollmentId },
    select: { id: true, partnerId: true, status: true, hmoPolicyId: true },
  });
  if (!enrollment || enrollment.partnerId !== input.partnerId) {
    return { ok: false, reason: "ENROLLMENT_NOT_FOUND" };
  }
  if (enrollment.status !== "ACTIVE") {
    return {
      ok: false,
      reason: "ENROLLMENT_NOT_ACTIVE",
      detail: `Cannot file a claim against enrollment in state ${enrollment.status}.`,
    };
  }
  if (!enrollment.hmoPolicyId) {
    return {
      ok: false,
      reason: "ENROLLMENT_NOT_ACTIVE",
      detail: "Enrollment has no HMO policy id — was never confirmed by the HMO.",
    };
  }

  // Persist as SUBMITTED, then call connector.
  const created = await db.$transaction(async (tx) => {
    const claim = await tx.hmoClaim.create({
      data: {
        partnerId: input.partnerId,
        enrollmentId: input.enrollmentId,
        fintechUserRef: input.fintechUserRef,
        serviceDate: new Date(input.serviceDate),
        serviceType: input.serviceType ?? null,
        facilityName: input.facilityName ?? null,
        facilityNetworkProviderId: input.facilityNetworkProviderId ?? null,
        amountNgn: input.amountNgn,
        diagnosisCodes: input.diagnosisCodes,
        procedureCodes: input.procedureCodes ?? [],
        notes: input.notes ?? null,
        idempotencyKey: input.idempotencyKey ?? null,
        status: "SUBMITTED",
      },
    });
    await tx.hmoClaimEvent.create({
      data: {
        claimId: claim.id,
        kind: "SUBMITTED",
        toStatus: "SUBMITTED",
        detail: { fintech_user_ref: input.fintechUserRef },
      },
    });
    return claim;
  });
  fireClaimWebhook(input.partnerId, "hmo_claim.submitted", toSummary(created));

  // Forward to connector. Failures land as REJECTED so the fintech
  // sees a terminal state rather than the claim being stuck SUBMITTED.
  try {
    const connectorOut = await stubSubmitClaim({
      hmoPolicyId: enrollment.hmoPolicyId,
      amountNgn: input.amountNgn,
      serviceDate: input.serviceDate,
      diagnosisCodes: input.diagnosisCodes,
      notes: input.notes,
    });
    const updated = await db.$transaction(async (tx) => {
      const row = await tx.hmoClaim.update({
        where: { id: created.id },
        data: {
          hmoClaimId: connectorOut.hmoClaimId,
          status: "PENDING_HMO",
          lastPolledAt: new Date(),
        },
      });
      await tx.hmoClaimEvent.create({
        data: {
          claimId: row.id,
          kind: "SENT_TO_HMO",
          fromStatus: "SUBMITTED",
          toStatus: "PENDING_HMO",
          detail: { hmo_claim_id: connectorOut.hmoClaimId },
        },
      });
      return row;
    });
    // ── Pierflow Cover: sync to Medplum (fire-and-forget) ────────
    void syncClaimToMedplumFull(updated.id);

    return {
      ok: true,
      idempotentReplay: false,
      claim: toSummary(updated),
    };
  } catch (e) {
    const failed = await db.$transaction(async (tx) => {
      const row = await tx.hmoClaim.update({
        where: { id: created.id },
        data: {
          status: "REJECTED",
          rejectionReason: `Connector refused: ${(e as Error).message}`,
        },
      });
      await tx.hmoClaimEvent.create({
        data: {
          claimId: row.id,
          kind: "REJECTED",
          fromStatus: "SUBMITTED",
          toStatus: "REJECTED",
          detail: { error: (e as Error).message },
        },
      });
      return row;
    });
    fireClaimWebhook(
      input.partnerId,
      "hmo_claim.rejected",
      toSummary(failed),
    );
    return {
      ok: false,
      reason: "CONNECTOR_REFUSED",
      detail: (e as Error).message,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────
// Polling — called by the cron to advance open claims
// ─────────────────────────────────────────────────────────────────────

const TERMINAL = new Set<HmoClaimStatus>(["REJECTED", "PAID"]);

export type PollResult = {
  scanned: number;
  advanced: number;
  unchanged: number;
  errors: number;
};

export async function pollOpenClaims(opts?: {
  limit?: number;
  staleSeconds?: number;
}): Promise<PollResult> {
  const limit = opts?.limit ?? 200;
  const staleSeconds = opts?.staleSeconds ?? 60 * 60 * 4; // 4h
  const staleBefore = new Date(Date.now() - staleSeconds * 1000);
  const candidates = await db.hmoClaim.findMany({
    where: {
      status: { notIn: Array.from(TERMINAL) as HmoClaimStatus[] },
      OR: [{ lastPolledAt: null }, { lastPolledAt: { lt: staleBefore } }],
      hmoClaimId: { not: null },
    },
    take: limit,
    orderBy: { lastPolledAt: { sort: "asc", nulls: "first" } },
  });

  let advanced = 0;
  let unchanged = 0;
  let errors = 0;
  for (const c of candidates) {
    try {
      const next = await stubGetClaimStatus({
        hmoClaimId: c.hmoClaimId!,
        currentStatus: c.status as StubClaimStatus,
        notesHint: c.notes,
        ageMs: Date.now() - c.createdAt.getTime(),
      });
      const fromStatus = c.status;
      if (next.status === fromStatus) {
        await db.$transaction(async (tx) => {
          await tx.hmoClaim.update({
            where: { id: c.id },
            data: { lastPolledAt: new Date() },
          });
          await tx.hmoClaimEvent.create({
            data: {
              claimId: c.id,
              kind: "STATUS_POLLED",
              detail: { status: next.status, advanced: false },
            },
          });
        });
        unchanged++;
        continue;
      }
      const updated = await db.$transaction(async (tx) => {
        const row = await tx.hmoClaim.update({
          where: { id: c.id },
          data: {
            status: next.status,
            approvedAmountNgn:
              next.approvedAmountNgn !== undefined
                ? next.approvedAmountNgn
                : c.approvedAmountNgn,
            paidAmountNgn:
              next.paidAmountNgn !== undefined
                ? next.paidAmountNgn
                : c.paidAmountNgn,
            rejectionReason: next.rejectionReason ?? c.rejectionReason,
            lastPolledAt: new Date(),
          },
        });
        await tx.hmoClaimEvent.create({
          data: {
            claimId: row.id,
            kind: eventKindFor(next.status),
            fromStatus,
            toStatus: next.status,
            detail: next.raw as Prisma.InputJsonValue,
          },
        });
        return row;
      });
      fireClaimWebhook(
        updated.partnerId,
        webhookEventFor(next.status),
        toSummary(updated),
      );
      // ── Pierflow Cover: sync updated claim to Medplum ──────────
      void syncClaimToMedplumFull(updated.id);
      advanced++;
    } catch {
      errors++;
    }
  }
  return { scanned: candidates.length, advanced, unchanged, errors };
}

function eventKindFor(status: HmoClaimStatus): HmoClaimEventKind {
  if (status === "UNDER_REVIEW") return "UNDER_REVIEW";
  if (status === "APPROVED") return "APPROVED";
  if (status === "REJECTED") return "REJECTED";
  if (status === "PAID") return "PAID";
  return "STATUS_POLLED";
}

function webhookEventFor(status: HmoClaimStatus): WebhookEventName {
  if (status === "UNDER_REVIEW") return "hmo_claim.under_review";
  if (status === "APPROVED") return "hmo_claim.approved";
  if (status === "REJECTED") return "hmo_claim.rejected";
  if (status === "PAID") return "hmo_claim.paid";
  return "hmo_claim.submitted";
}

// ─────────────────────────────────────────────────────────────────────
// Read paths
// ─────────────────────────────────────────────────────────────────────

export async function getClaim(
  claimId: string,
  partnerId: string,
): Promise<ClaimSummary | null> {
  const c = await db.hmoClaim.findUnique({ where: { id: claimId } });
  if (!c || c.partnerId !== partnerId) return null;
  return toSummary(c);
}

export async function listClaimsByUserRef(
  partnerId: string,
  fintechUserRef: string,
): Promise<ClaimSummary[]> {
  const rows = await db.hmoClaim.findMany({
    where: { partnerId, fintechUserRef },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toSummary);
}

// ─────────────────────────────────────────────────────────────────────
// Summary shape
// ─────────────────────────────────────────────────────────────────────

function toSummary(c: {
  id: string;
  partnerId: string;
  enrollmentId: string;
  fintechUserRef: string;
  hmoClaimId: string | null;
  serviceDate: Date;
  serviceType: string | null;
  facilityName: string | null;
  amountNgn: bigint;
  status: HmoClaimStatus;
  approvedAmountNgn: bigint | null;
  paidAmountNgn: bigint | null;
  rejectionReason: string | null;
  diagnosisCodes: string[];
  procedureCodes: string[];
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastPolledAt: Date | null;
}): ClaimSummary {
  return {
    id: c.id,
    partner_id: c.partnerId,
    enrollment_id: c.enrollmentId,
    fintech_user_ref: c.fintechUserRef,
    hmo_claim_id: c.hmoClaimId,
    service_date: c.serviceDate.toISOString(),
    service_type: c.serviceType,
    facility_name: c.facilityName,
    amount_ngn: c.amountNgn.toString(),
    status: c.status,
    approved_amount_ngn: c.approvedAmountNgn?.toString() ?? null,
    paid_amount_ngn: c.paidAmountNgn?.toString() ?? null,
    rejection_reason: c.rejectionReason,
    diagnosis_codes: c.diagnosisCodes,
    procedure_codes: c.procedureCodes,
    notes: c.notes,
    created_at: c.createdAt.toISOString(),
    updated_at: c.updatedAt.toISOString(),
    last_polled_at: c.lastPolledAt?.toISOString() ?? null,
  };
}
