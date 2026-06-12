/**
 * Claim adjudication — the HMO admin approves or rejects a claim
 * from the Cover portal.
 *
 * On decision:
 *   1. Updates HmoClaim status + amounts + reason.
 *   2. Records an HmoClaimEvent.
 *   3. Syncs ClaimResponse + EOB to Medplum (fire-and-forget).
 *   4. Fires webhook to the fintech.
 */

import { db } from "@/lib/db";
import type { HmoClaimStatus, Prisma } from "@prisma/client";
import { emitFireAndForget } from "@/lib/webhooks";
import { syncClaimToMedplumFull } from "@/lib/cover/sync.ts";

export type AdjudicationDecision = "APPROVED" | "REJECTED";

export type AdjudicateInput = {
  claimId: string;
  decision: AdjudicationDecision;
  approvedAmountNgn?: bigint | null;
  rejectionReason?: string | null;
  reviewerExternalId?: string | null;
};

export type AdjudicateResult =
  | { ok: true; claim: { id: string; status: HmoClaimStatus } }
  | { ok: false; reason: string };

export async function adjudicateClaim(
  input: AdjudicateInput,
): Promise<AdjudicateResult> {
  const existing = await db.hmoClaim.findUnique({
    where: { id: input.claimId },
    select: { id: true, status: true, partnerId: true, enrollmentId: true, fintechUserRef: true, amountNgn: true },
  });
  if (!existing) {
    return { ok: false, reason: "Claim not found." };
  }

  // Only claims in reviewable states can be adjudicated.
  const reviewable: HmoClaimStatus[] = [
    "SUBMITTED",
    "PENDING_HMO",
    "UNDER_REVIEW",
  ];
  if (!reviewable.includes(existing.status)) {
    return {
      ok: false,
      reason: `Claim is in state ${existing.status} and cannot be adjudicated.`,
    };
  }

  const newStatus: HmoClaimStatus = input.decision;
  const eventKind = input.decision === "APPROVED" ? "APPROVED" : "REJECTED";

  const updated = await db.$transaction(async (tx) => {
    const row = await tx.hmoClaim.update({
      where: { id: input.claimId },
      data: {
        status: newStatus,
        approvedAmountNgn:
          input.decision === "APPROVED"
            ? (input.approvedAmountNgn ?? existing.amountNgn)
            : null,
        rejectionReason: input.rejectionReason ?? null,
      },
    });
    await tx.hmoClaimEvent.create({
      data: {
        claimId: row.id,
        kind: eventKind,
        fromStatus: existing.status,
        toStatus: newStatus,
        detail: {
          reviewer: input.reviewerExternalId,
          approved_amount_ngn: input.approvedAmountNgn?.toString(),
          rejection_reason: input.rejectionReason,
        } as Prisma.InputJsonValue,
      },
    });
    return row;
  });

  // Webhook to the fintech.
  const webhookEvent =
    input.decision === "APPROVED"
      ? "hmo_claim.approved"
      : "hmo_claim.rejected";
  emitFireAndForget(existing.partnerId, webhookEvent as "hmo_claim.approved", {
    claim_id: existing.id,
    enrollment_id: existing.enrollmentId,
    fintech_user_ref: existing.fintechUserRef,
    status: newStatus,
    approved_amount_ngn: updated.approvedAmountNgn?.toString() ?? null,
    rejection_reason: updated.rejectionReason,
  });

  // Sync to Medplum (fire-and-forget).
  void syncClaimToMedplumFull(updated.id);

  return { ok: true, claim: { id: updated.id, status: updated.status } };
}
