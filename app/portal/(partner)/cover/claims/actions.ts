"use server";

import { resolveSession } from "@/lib/auth";
import { adjudicateClaim, type AdjudicationDecision } from "@/lib/cover/adjudication.ts";

export async function adjudicateAction(
  claimId: string,
  decision: AdjudicationDecision,
  approvedAmountNgn?: string,
  rejectionReason?: string,
) {
  const session = await resolveSession();
  if (session.kind !== "partner") {
    return { ok: false, reason: "Unauthorized" } as const;
  }

  const result = await adjudicateClaim({
    claimId,
    decision,
    approvedAmountNgn: approvedAmountNgn ? BigInt(approvedAmountNgn) : null,
    rejectionReason: rejectionReason || null,
    reviewerExternalId: session.partnerUser.externalId ?? null,
  });
  return result;
}
