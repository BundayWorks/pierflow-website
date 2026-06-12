/**
 * Settlement reconciliation.
 *
 * Walks enrollments that recently went ACTIVE, compares the
 * INSTRUCTED vs EXECUTED ledger entries by account, and writes a
 * LedgerDiscrepancy row whenever the net delta is non-zero.
 *
 * Two entry points:
 *   • reconcileEnrollment(enrollmentId)  — explicit, idempotent
 *   • reconcileRecent(opts)              — bulk, called by the cron
 *
 * Decisions reflected here:
 *   • Tolerance window is 0 kobo. Any non-zero delta is a
 *     discrepancy. We can soften later if real-world rounding
 *     becomes noisy.
 *   • An enrollment with INSTRUCTED but no EXECUTED yet is a
 *     "pending" discrepancy — surfaced so staff can chase. We don't
 *     flag it until the enrollment is at least 48h old to give the
 *     fintech a settlement cycle to catch up.
 *   • A discrepancy already OPEN for an enrollment isn't duplicated —
 *     we update the existing row's breakdown + deltaNgn.
 */

import { Prisma, type LedgerDiscrepancyStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { netByAccountForCorrelation } from "@/lib/insurance/ledger";

const ZERO = BigInt(0);

export type ReconcileResult =
  | {
      ok: true;
      enrollmentId: string;
      status: "BALANCED" | "DISCREPANCY" | "PENDING_EXECUTED";
      deltaNgn: bigint;
      discrepancyId?: string;
    }
  | { ok: false; reason: "ENROLLMENT_NOT_FOUND"; enrollmentId: string };

/**
 * Reconcile a single enrollment. Idempotent — running multiple
 * times either returns BALANCED or updates the existing OPEN
 * discrepancy in place.
 */
export async function reconcileEnrollment(
  enrollmentId: string,
): Promise<ReconcileResult> {
  const enrollment = await db.hmoEnrollment.findUnique({
    where: { id: enrollmentId },
    select: {
      id: true,
      partnerId: true,
      status: true,
      memberPaysNgn: true,
      createdAt: true,
    },
  });
  if (!enrollment) {
    return { ok: false, reason: "ENROLLMENT_NOT_FOUND", enrollmentId };
  }

  const accounts = await netByAccountForCorrelation(enrollmentId);
  const hasInstructed = accounts.some((a) => a.instructed !== ZERO);
  const hasExecuted = accounts.some((a) => a.executed !== ZERO);

  // If there's nothing to compare against, there's nothing to do.
  if (!hasInstructed && !hasExecuted) {
    return {
      ok: true,
      enrollmentId,
      status: "BALANCED",
      deltaNgn: ZERO,
    };
  }

  // INSTRUCTED but no EXECUTED — pending fintech report. Surface only
  // if the enrollment is older than 48h.
  const ageMs = Date.now() - enrollment.createdAt.getTime();
  const pendingThreshold = 48 * 60 * 60 * 1000;
  if (hasInstructed && !hasExecuted) {
    if (ageMs < pendingThreshold) {
      return {
        ok: true,
        enrollmentId,
        status: "PENDING_EXECUTED",
        deltaNgn: enrollment.memberPaysNgn,
      };
    }
    // Treat the full memberPays as the delta — nothing has been
    // executed against an instruction that's been outstanding 48h+.
    return upsertDiscrepancy({
      enrollmentId,
      deltaNgn: enrollment.memberPaysNgn,
      breakdown: accounts.map((a) => ({
        account_id: a.accountId,
        display_name: a.displayName,
        role: a.role,
        settlement_tag: a.settlementTag,
        instructed: a.instructed.toString(),
        executed: a.executed.toString(),
        delta: a.delta.toString(),
      })),
      pending: true,
    });
  }

  // Both sides present — compute net delta.
  const totalDelta = accounts.reduce((acc, a) => acc + a.delta, ZERO);
  if (totalDelta === ZERO) {
    // Balanced — close any existing OPEN discrepancy as RESOLVED.
    const open = await db.ledgerDiscrepancy.findFirst({
      where: { enrollmentId, status: "OPEN" },
      select: { id: true },
    });
    if (open) {
      await db.ledgerDiscrepancy.update({
        where: { id: open.id },
        data: {
          status: "RESOLVED",
          resolvedAt: new Date(),
          reviewerNotes: (open as { reviewerNotes?: string }).reviewerNotes
            ? undefined
            : "Auto-resolved: subsequent reports brought the enrollment back to zero delta.",
        },
      });
    }
    return {
      ok: true,
      enrollmentId,
      status: "BALANCED",
      deltaNgn: ZERO,
    };
  }

  return upsertDiscrepancy({
    enrollmentId,
    deltaNgn: totalDelta,
    breakdown: accounts.map((a) => ({
      account_id: a.accountId,
      display_name: a.displayName,
      role: a.role,
      settlement_tag: a.settlementTag,
      instructed: a.instructed.toString(),
      executed: a.executed.toString(),
      delta: a.delta.toString(),
    })),
    pending: false,
  });
}

async function upsertDiscrepancy(input: {
  enrollmentId: string;
  deltaNgn: bigint;
  breakdown: unknown[];
  pending: boolean;
}): Promise<ReconcileResult> {
  const existing = await db.ledgerDiscrepancy.findFirst({
    where: { enrollmentId: input.enrollmentId, status: "OPEN" },
    select: { id: true },
  });
  if (existing) {
    const updated = await db.ledgerDiscrepancy.update({
      where: { id: existing.id },
      data: {
        deltaNgn: input.deltaNgn,
        breakdown: input.breakdown as Prisma.InputJsonValue,
      },
      select: { id: true },
    });
    return {
      ok: true,
      enrollmentId: input.enrollmentId,
      status: input.pending ? "PENDING_EXECUTED" : "DISCREPANCY",
      deltaNgn: input.deltaNgn,
      discrepancyId: updated.id,
    };
  }
  const created = await db.ledgerDiscrepancy.create({
    data: {
      correlationId: input.enrollmentId,
      enrollmentId: input.enrollmentId,
      deltaNgn: input.deltaNgn,
      breakdown: input.breakdown as Prisma.InputJsonValue,
      status: "OPEN",
    },
    select: { id: true },
  });
  return {
    ok: true,
    enrollmentId: input.enrollmentId,
    status: input.pending ? "PENDING_EXECUTED" : "DISCREPANCY",
    deltaNgn: input.deltaNgn,
    discrepancyId: created.id,
  };
}

/**
 * Bulk-reconcile enrollments that may have new ledger activity.
 * Called by the cron — walks ACTIVE enrollments updated in the last
 * `sinceHours` window (default 72h).
 *
 * Returns aggregate counts so the cron can log a one-line summary.
 */
export async function reconcileRecent(opts?: {
  sinceHours?: number;
  limit?: number;
}): Promise<{
  scanned: number;
  balanced: number;
  discrepancies: number;
  pending: number;
  errors: number;
}> {
  const sinceHours = opts?.sinceHours ?? 72;
  const limit = opts?.limit ?? 500;
  const since = new Date(Date.now() - sinceHours * 60 * 60 * 1000);

  const enrollments = await db.hmoEnrollment.findMany({
    where: {
      status: { in: ["ACTIVE", "CANCELLED"] },
      OR: [{ updatedAt: { gte: since } }, { createdAt: { gte: since } }],
    },
    select: { id: true },
    take: limit,
    orderBy: { updatedAt: "desc" },
  });

  let balanced = 0;
  let discrepancies = 0;
  let pending = 0;
  let errors = 0;
  for (const e of enrollments) {
    try {
      const r = await reconcileEnrollment(e.id);
      if (!r.ok) {
        errors++;
        continue;
      }
      if (r.status === "BALANCED") balanced++;
      else if (r.status === "PENDING_EXECUTED") pending++;
      else discrepancies++;
    } catch {
      errors++;
    }
  }
  return {
    scanned: enrollments.length,
    balanced,
    discrepancies,
    pending,
    errors,
  };
}

// ─────────────────────────────────────────────────────────────────────
// Staff actions
// ─────────────────────────────────────────────────────────────────────

export async function setDiscrepancyStatus(
  discrepancyId: string,
  status: LedgerDiscrepancyStatus,
  reviewerNotes: string | null,
  staffExternalId: string,
) {
  return db.ledgerDiscrepancy.update({
    where: { id: discrepancyId },
    data: {
      status,
      reviewerNotes,
      resolvedAt:
        status === "RESOLVED" || status === "WRITTEN_OFF" ? new Date() : null,
      resolvedByExternalId:
        status === "RESOLVED" || status === "WRITTEN_OFF"
          ? staffExternalId
          : null,
    },
  });
}

export async function listDiscrepancies(filter?: {
  status?: LedgerDiscrepancyStatus | "ALL";
  limit?: number;
}) {
  const status = filter?.status ?? "OPEN";
  const where = status === "ALL" ? {} : { status };
  return db.ledgerDiscrepancy.findMany({
    where,
    orderBy: [{ status: "asc" }, { detectedAt: "desc" }],
    take: filter?.limit ?? 200,
    include: {
      enrollment: {
        select: {
          id: true,
          partnerId: true,
          fintechUserRef: true,
          memberPaysNgn: true,
        },
      },
    },
  });
}
