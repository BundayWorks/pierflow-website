/**
 * Enrollment orchestrator.
 *
 * Owns the full enrollment lifecycle from the fintech's `POST
 * /v1/enrollments` call through to `ACTIVE` (or `FAILED`):
 *
 *   1. createEnrollment(input)
 *        • Idempotency lookup (returns the existing row on retry).
 *        • Loads the chosen plan + provider + active contract.
 *        • If a quote id is provided, reads the frozen splits snapshot.
 *          Otherwise computes a fresh wholesale + markup via the engine.
 *        • Runs identity verification (stub or real).
 *        • Persists HmoEnrollment + IdentityVerification + the
 *          CREATED + IDENTITY_VERIFIED events atomically.
 *        • Returns the enrollment id; status starts at PENDING_PAYMENT
 *          (the fintech is expected to debit + confirm next).
 *
 *   2. recordPaymentReceived(enrollmentId, ...)
 *        • Idempotent. PENDING_PAYMENT → PENDING_HMO.
 *        • Calls the stub connector to issue the HMO policy.
 *        • PENDING_HMO → ACTIVE on connector success.
 *        • Emits webhook events along the way.
 *
 *   3. cancelEnrollment(enrollmentId, reason)
 *        • Calls connector to terminate. Records CANCELLED event.
 *
 * All state transitions go through `transitionStatus()` which records
 * the audit event in the same transaction as the column update.
 */

import {
  Prisma,
  type HmoContract,
  type HmoContractParty,
  type HmoEnrollmentStatus,
  type HmoEnrollmentEventKind,
  type HmoQuote,
} from "@prisma/client";
import { db } from "@/lib/db";
import { computePremiumSplits } from "@/lib/insurance/split-engine.ts";
import { assembleQuotePricing } from "@/lib/insurance/personalisation.ts";
import {
  verifyIdentity,
  getIdentityEnvironment,
  type VerifyIdentityInput,
} from "@/lib/insurance/identity.ts";
import { stubEnrollMember, stubCancelPolicy } from "@/lib/insurance/stub-connector.ts";
import { emitFireAndForget, type WebhookEventName } from "@/lib/webhooks";
import { syncEnrollmentToMedplum } from "@/lib/cover/sync.ts";
import {
  writeInstructedFromEnrollment,
  writeExecutedFromReport,
  type ExecutedReportLine,
} from "@/lib/insurance/ledger";

/**
 * Public-facing event shape — exactly what fintech endpoints will see
 * in webhook deliveries. Keep stable across patch versions; additive
 * fields only.
 */
function buildEventPayload(enrollment: EnrollmentSummary) {
  return {
    enrollment_id: enrollment.id,
    plan_id: enrollment.plan_id,
    provider_id: enrollment.provider_id,
    fintech_user_ref: enrollment.fintech_user_ref,
    status: enrollment.status,
    hmo_policy_id: enrollment.hmo_policy_id,
    hmo_member_id: enrollment.hmo_member_id,
    member_pays_ngn: enrollment.member_pays_ngn,
    wholesale_ngn: enrollment.wholesale_ngn,
    markup_ngn: enrollment.markup_ngn,
    contract_version: enrollment.contract_version,
    splits_snapshot: enrollment.splits_snapshot,
    effective_from: enrollment.effective_from,
    effective_to: enrollment.effective_to,
    updated_at: enrollment.updated_at,
  };
}

/**
 * Fire-and-forget webhook emit for an enrollment lifecycle event.
 * Never throws — webhook delivery failures don't block the
 * orchestrator from completing the underlying state transition.
 */
function fireEnrollmentWebhook(
  partnerId: string,
  event: WebhookEventName,
  enrollment: EnrollmentSummary,
  extra?: Record<string, unknown>,
) {
  emitFireAndForget(partnerId, event, {
    ...buildEventPayload(enrollment),
    ...(extra ?? {}),
  });
}

// ─────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────

export type CreateEnrollmentInput = {
  partnerId: string;
  planId: string;
  /** Optional. When supplied, the frozen quote pricing is used. */
  quoteId?: string;
  fintechUserRef: string;
  /** Partner-supplied. Same key within 24h returns the existing row. */
  idempotencyKey?: string;
  identity: VerifyIdentityInput;
  effectiveFrom?: Date;
};

export type CreateEnrollmentResult =
  | {
      ok: true;
      enrollment: EnrollmentSummary;
      identity: {
        status: string;
        confidence: number;
        provider: string;
      };
      /** True when this returned an existing idempotent enrollment. */
      idempotentReplay: boolean;
    }
  | {
      ok: false;
      reason:
        | "PLAN_NOT_FOUND"
        | "PROVIDER_INACTIVE"
        | "NO_ACTIVE_CONTRACT"
        | "QUOTE_NOT_FOUND_OR_EXPIRED"
        | "QUOTE_PLAN_MISMATCH"
        | "IDENTITY_REJECTED"
        | "SETTLEMENT_COMPUTE_FAILED"
        | "INTERNAL";
      detail?: string;
      issues?: string[];
    };

export type EnrollmentSummary = {
  id: string;
  partner_id: string;
  provider_id: string;
  plan_id: string;
  quote_id: string | null;
  fintech_user_ref: string;
  hmo_policy_id: string | null;
  hmo_member_id: string | null;
  status: HmoEnrollmentStatus;
  effective_from: string | null;
  effective_to: string | null;
  wholesale_ngn: string;
  markup_ngn: string;
  member_pays_ngn: string;
  splits_snapshot: unknown;
  contract_version: number;
  created_at: string;
  updated_at: string;
};

// ─────────────────────────────────────────────────────────────────────
// createEnrollment
// ─────────────────────────────────────────────────────────────────────

export async function createEnrollment(
  input: CreateEnrollmentInput,
): Promise<CreateEnrollmentResult> {
  // ── 0. Idempotency replay ──────────────────────────────────────
  if (input.idempotencyKey) {
    const existing = await db.hmoEnrollment.findUnique({
      where: {
        partnerId_idempotencyKey: {
          partnerId: input.partnerId,
          idempotencyKey: input.idempotencyKey,
        },
      },
      include: { identityVerification: true },
    });
    if (existing) {
      return {
        ok: true,
        idempotentReplay: true,
        enrollment: toSummary(existing),
        identity: existing.identityVerification
          ? {
              status: existing.identityVerification.status,
              confidence: existing.identityVerification.confidence,
              provider: existing.identityVerification.provider,
            }
          : { status: "UNKNOWN", confidence: 0, provider: "STUB" },
      };
    }
  }

  // ── 1. Load plan + provider + contract ─────────────────────────
  const plan = await db.hmoPlan.findUnique({
    where: { id: input.planId },
    include: { provider: true },
  });
  if (!plan) return { ok: false, reason: "PLAN_NOT_FOUND" };
  if (plan.provider.status !== "ACTIVE") {
    return { ok: false, reason: "PROVIDER_INACTIVE" };
  }

  const contract = await db.hmoContract.findFirst({
    where: { providerId: plan.providerId, status: "ACTIVE" },
    include: { parties: true },
    orderBy: { version: "desc" },
  });
  if (!contract) {
    return { ok: false, reason: "NO_ACTIVE_CONTRACT" };
  }

  // ── 2. Pricing: read frozen quote OR compute fresh ─────────────
  let quote: HmoQuote | null = null;
  let wholesaleNgn: bigint;
  let markupNgn: bigint;
  let memberPaysNgn: bigint;
  let splitsSnapshot: unknown;
  let contractVersion: number;

  if (input.quoteId) {
    quote = await db.hmoQuote.findUnique({ where: { id: input.quoteId } });
    if (!quote || quote.partnerId !== input.partnerId) {
      return { ok: false, reason: "QUOTE_NOT_FOUND_OR_EXPIRED" };
    }
    if (quote.expiresAt < new Date()) {
      return {
        ok: false,
        reason: "QUOTE_NOT_FOUND_OR_EXPIRED",
        detail: `Quote expired at ${quote.expiresAt.toISOString()}`,
      };
    }
    if (quote.planId !== input.planId) {
      return { ok: false, reason: "QUOTE_PLAN_MISMATCH" };
    }
    wholesaleNgn = quote.wholesaleNgn;
    markupNgn = quote.markupNgn;
    memberPaysNgn = quote.memberPaysNgn;
    splitsSnapshot = quote.splitsSnapshot;
    contractVersion = quote.contractVersion;
  } else {
    // No quote — compute fresh via the engine.
    const pricing = plan.pricing as { individual_monthly?: number } | null;
    wholesaleNgn = BigInt(pricing?.individual_monthly ?? 0);
    const splits = computePremiumSplits(
      contract as HmoContract & { parties: HmoContractParty[] },
      wholesaleNgn,
    );
    if (!splits.ok) {
      return {
        ok: false,
        reason: "SETTLEMENT_COMPUTE_FAILED",
        issues: splits.issues,
      };
    }
    const assembled = assembleQuotePricing(
      contract.markupMode,
      wholesaleNgn,
      splits.markupNgn,
    );
    markupNgn = assembled.markupNgn;
    memberPaysNgn = assembled.memberPaysNgn;
    splitsSnapshot = summariseSplits(splits);
    contractVersion = contract.version;
  }

  // ── 3. Verify identity ─────────────────────────────────────────
  const identity = await verifyIdentity(input.identity);

  if (identity.status === "REJECTED") {
    // We still record the verification attempt so the audit trail
    // shows what happened, but we don't create an enrollment row.
    await db.identityVerification.create({
      data: {
        partnerId: input.partnerId,
        ninHash: identity.toPersist.ninHash,
        ninLast4: identity.toPersist.ninLast4,
        bvnHash: identity.toPersist.bvnHash,
        bvnLast4: identity.toPersist.bvnLast4,
        encryptedPayload:
          identity.toPersist.encryptedPayload !== null
            ? new Uint8Array(identity.toPersist.encryptedPayload)
            : null,
        fullName: input.identity.fullName,
        dateOfBirth: new Date(input.identity.dateOfBirth),
        sex: input.identity.sex,
        status: identity.status,
        provider: identity.provider,
        confidence: identity.confidence,
        fieldChecks: identity.fieldChecks as Prisma.InputJsonValue,
        rawResponse: identity.raw
          ? (identity.raw as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        environment: getIdentityEnvironment(),
      },
    });
    // No enrollment row exists, so fire a lightweight rejection
    // event so fintechs can prompt the user to fix their data.
    emitFireAndForget(input.partnerId, "hmo_enrollment.identity_rejected", {
      enrollment_id: null,
      plan_id: input.planId,
      fintech_user_ref: input.fintechUserRef,
      identity_status: identity.status,
      identity_confidence: identity.confidence,
      identity_provider: identity.provider,
    });
    return {
      ok: false,
      reason: "IDENTITY_REJECTED",
      detail: `Identity check returned ${identity.confidence}% confidence (below 60 threshold).`,
    };
  }

  // ── 4. Atomic create: enrollment + identity + 2 events ─────────
  try {
    const out = await db.$transaction(async (tx) => {
      const idRow = await tx.identityVerification.create({
        data: {
          partnerId: input.partnerId,
          ninHash: identity.toPersist.ninHash,
          ninLast4: identity.toPersist.ninLast4,
          bvnHash: identity.toPersist.bvnHash,
          bvnLast4: identity.toPersist.bvnLast4,
          encryptedPayload:
            identity.toPersist.encryptedPayload !== null
              ? new Uint8Array(identity.toPersist.encryptedPayload)
              : null,
          fullName: input.identity.fullName,
          dateOfBirth: new Date(input.identity.dateOfBirth),
          sex: input.identity.sex,
          status: identity.status,
          provider: identity.provider,
          confidence: identity.confidence,
          fieldChecks: identity.fieldChecks as Prisma.InputJsonValue,
          rawResponse: identity.raw
            ? (identity.raw as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          environment: getIdentityEnvironment(),
        },
        select: { id: true },
      });

      const enrollment = await tx.hmoEnrollment.create({
        data: {
          partnerId: input.partnerId,
          providerId: plan.providerId,
          planId: plan.id,
          quoteId: input.quoteId ?? null,
          fintechUserRef: input.fintechUserRef,
          fullName: input.identity.fullName,
          phone: input.identity.phone ?? null,
          identityVerificationId: idRow.id,
          status: "PENDING_PAYMENT",
          effectiveFrom: input.effectiveFrom ?? null,
          wholesaleNgn,
          markupNgn,
          memberPaysNgn,
          splitsSnapshot: splitsSnapshot as Prisma.InputJsonValue,
          contractVersion,
          idempotencyKey: input.idempotencyKey ?? null,
        },
      });

      await tx.hmoEnrollmentEvent.createMany({
        data: [
          {
            enrollmentId: enrollment.id,
            kind: "CREATED",
            toStatus: "PENDING_PAYMENT",
            detail: { partner_user_ref: input.fintechUserRef },
          },
          {
            enrollmentId: enrollment.id,
            kind: identity.status === "SOFT_REVIEW"
              ? ("IDENTITY_VERIFIED" as HmoEnrollmentEventKind)
              : ("IDENTITY_VERIFIED" as HmoEnrollmentEventKind),
            detail: {
              status: identity.status,
              provider: identity.provider,
              confidence: identity.confidence,
            },
          },
        ],
      });

      return enrollment;
    });

    const summary = toSummary(out);
    fireEnrollmentWebhook(input.partnerId, "hmo_enrollment.created", summary);
    fireEnrollmentWebhook(
      input.partnerId,
      "hmo_enrollment.identity_verified",
      summary,
      {
        identity_status: identity.status,
        identity_confidence: identity.confidence,
        identity_provider: identity.provider,
      },
    );
    return {
      ok: true,
      idempotentReplay: false,
      enrollment: summary,
      identity: {
        status: identity.status,
        confidence: identity.confidence,
        provider: identity.provider,
      },
    };
  } catch (e) {
    // Re-throw unique-constraint replays as idempotent successes —
    // race condition when two requests arrive simultaneously.
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002" &&
      input.idempotencyKey
    ) {
      const existing = await db.hmoEnrollment.findUnique({
        where: {
          partnerId_idempotencyKey: {
            partnerId: input.partnerId,
            idempotencyKey: input.idempotencyKey,
          },
        },
        include: { identityVerification: true },
      });
      if (existing) {
        return {
          ok: true,
          idempotentReplay: true,
          enrollment: toSummary(existing),
          identity: existing.identityVerification
            ? {
                status: existing.identityVerification.status,
                confidence: existing.identityVerification.confidence,
                provider: existing.identityVerification.provider,
              }
            : { status: "UNKNOWN", confidence: 0, provider: "STUB" },
        };
      }
    }
    console.error("createEnrollment failed:", e);
    return {
      ok: false,
      reason: "INTERNAL",
      detail: (e as Error).message,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────
// recordPaymentReceived — fintech confirms wallet debit succeeded
// ─────────────────────────────────────────────────────────────────────

export type PaymentReceivedInput = {
  enrollmentId: string;
  partnerId: string;
  /** The fintech's payment reference, opaque to us. */
  paymentRef?: string;
  /** Amount actually debited from the user. We verify it matches member_pays. */
  amountNgn: bigint;
  /**
   * Optional inline executed-credit report. When supplied, Pierflow
   * writes EXECUTED ledger entries alongside the INSTRUCTED set so
   * reconciliation has both sides immediately.
   *
   * If absent, the INSTRUCTED entries still land but EXECUTED ones
   * have to come via a future settlements endpoint (deferred).
   */
  executedCredits?: ExecutedReportLine[];
};

export type PaymentReceivedResult =
  | { ok: true; enrollment: EnrollmentSummary }
  | {
      ok: false;
      reason:
        | "ENROLLMENT_NOT_FOUND"
        | "INVALID_STATE"
        | "AMOUNT_MISMATCH"
        | "HMO_REJECTED"
        | "INTERNAL";
      detail?: string;
    };

export async function recordPaymentReceived(
  input: PaymentReceivedInput,
): Promise<PaymentReceivedResult> {
  const existing = await db.hmoEnrollment.findUnique({
    where: { id: input.enrollmentId },
    include: { plan: true },
  });
  if (!existing || existing.partnerId !== input.partnerId) {
    return { ok: false, reason: "ENROLLMENT_NOT_FOUND" };
  }

  // Idempotent: if already past PENDING_PAYMENT, return success.
  if (
    existing.status === "ACTIVE" ||
    existing.status === "PENDING_HMO"
  ) {
    return { ok: true, enrollment: toSummary(existing) };
  }
  if (existing.status !== "PENDING_PAYMENT" && existing.status !== "CREATED") {
    return {
      ok: false,
      reason: "INVALID_STATE",
      detail: `Cannot record payment on enrollment in state ${existing.status}.`,
    };
  }
  if (input.amountNgn !== existing.memberPaysNgn) {
    return {
      ok: false,
      reason: "AMOUNT_MISMATCH",
      detail: `Expected ${existing.memberPaysNgn} kobo, received ${input.amountNgn} kobo.`,
    };
  }

  // Move PENDING_PAYMENT → PENDING_HMO; call connector; → ACTIVE.
  const pendingHmo = await db.$transaction(async (tx) => {
    const updated = await tx.hmoEnrollment.update({
      where: { id: existing.id },
      data: { status: "PENDING_HMO" },
    });
    await tx.hmoEnrollmentEvent.create({
      data: {
        enrollmentId: existing.id,
        kind: "PAYMENT_RECEIVED",
        fromStatus: existing.status,
        toStatus: "PENDING_HMO",
        detail: {
          amount_ngn: input.amountNgn.toString(),
          payment_ref: input.paymentRef ?? null,
        },
      },
    });
    await tx.hmoEnrollmentEvent.create({
      data: {
        enrollmentId: existing.id,
        kind: "SUBMITTED_TO_HMO",
        detail: { plan_external_id: existing.plan.externalId },
      },
    });
    return updated;
  });
  fireEnrollmentWebhook(
    existing.partnerId,
    "hmo_enrollment.payment_received",
    toSummary(pendingHmo),
    {
      amount_ngn: input.amountNgn.toString(),
      payment_ref: input.paymentRef ?? null,
    },
  );
  fireEnrollmentWebhook(
    existing.partnerId,
    "hmo_enrollment.submitted_to_hmo",
    toSummary(pendingHmo),
  );

  try {
    const connectorOut = await stubEnrollMember({
      planExternalId: existing.plan.externalId,
      fullName: existing.fullName,
      partnerMemberRef: existing.fintechUserRef,
      effectiveFrom: existing.effectiveFrom?.toISOString(),
    });

    const activated = await db.$transaction(async (tx) => {
      const updated = await tx.hmoEnrollment.update({
        where: { id: existing.id },
        data: {
          status: "ACTIVE",
          hmoPolicyId: connectorOut.hmoPolicyId,
          hmoMemberId: connectorOut.hmoMemberId,
          effectiveFrom:
            existing.effectiveFrom ?? new Date(connectorOut.effectiveFrom),
        },
      });
      await tx.hmoEnrollmentEvent.createMany({
        data: [
          {
            enrollmentId: existing.id,
            kind: "HMO_APPROVED",
            detail: {
              hmo_policy_id: connectorOut.hmoPolicyId,
              hmo_member_id: connectorOut.hmoMemberId,
            },
          },
          {
            enrollmentId: existing.id,
            kind: "ACTIVATED",
            fromStatus: "PENDING_HMO",
            toStatus: "ACTIVE",
          },
        ],
      });
      return updated;
    });
    fireEnrollmentWebhook(
      existing.partnerId,
      "hmo_enrollment.activated",
      toSummary(activated),
    );

    // ── Ledger ──────────────────────────────────────────────────
    // Write INSTRUCTED entries from the frozen splits snapshot now
    // that settlement is real. Idempotent — safe to re-run on retry.
    // Failures here are logged but do not roll back the activation:
    // the enrollment is still ACTIVE; staff can re-run via
    // reconciliation tooling.
    try {
      const snap = activated.splitsSnapshot as Parameters<
        typeof writeInstructedFromEnrollment
      >[0]["splitsSnapshot"];
      const r = await writeInstructedFromEnrollment({
        enrollmentId: activated.id,
        partnerId: existing.partnerId,
        splitsSnapshot: snap,
      });
      if (!r.ok) {
        console.warn(
          "[ledger] writeInstructedFromEnrollment failed for",
          activated.id,
          r,
        );
      }
    } catch (err) {
      console.warn("[ledger] INSTRUCTED write threw:", (err as Error).message);
    }

    // If the fintech sent inline executed credits, write the
    // EXECUTED side too. Reconciliation can now compare both
    // immediately.
    if (input.executedCredits && input.executedCredits.length > 0) {
      try {
        const r = await writeExecutedFromReport({
          enrollmentId: activated.id,
          partnerId: existing.partnerId,
          reports: input.executedCredits,
        });
        if (!r.ok) {
          console.warn(
            "[ledger] writeExecutedFromReport failed for",
            activated.id,
            r,
          );
        }
      } catch (err) {
        console.warn(
          "[ledger] EXECUTED write threw:",
          (err as Error).message,
        );
      }
    }

    // ── Pierflow Cover: sync to Medplum (fire-and-forget) ────────
    void syncEnrollmentToMedplum(activated.id);

    return { ok: true, enrollment: toSummary(activated) };
  } catch (e) {
    // Connector failed — mark FAILED + emit event.
    const failed = await db.$transaction(async (tx) => {
      const updated = await tx.hmoEnrollment.update({
        where: { id: existing.id },
        data: { status: "FAILED" },
      });
      await tx.hmoEnrollmentEvent.createMany({
        data: [
          {
            enrollmentId: existing.id,
            kind: "HMO_REJECTED",
            detail: { error: (e as Error).message },
          },
          {
            enrollmentId: existing.id,
            kind: "CANCELLED", // FAILED is a terminal state; we reuse CANCELLED kind
            fromStatus: "PENDING_HMO",
            toStatus: "FAILED",
          },
        ],
      });
      return updated;
    });
    const failedSummary = toSummary(failed);
    fireEnrollmentWebhook(
      existing.partnerId,
      "hmo_enrollment.hmo_rejected",
      failedSummary,
      { error: (e as Error).message },
    );
    fireEnrollmentWebhook(
      existing.partnerId,
      "hmo_enrollment.failed",
      failedSummary,
    );
    return {
      ok: false,
      reason: "HMO_REJECTED",
      detail: (e as Error).message,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────
// cancelEnrollment
// ─────────────────────────────────────────────────────────────────────

export async function cancelEnrollment(
  enrollmentId: string,
  partnerId: string,
  reason: string,
): Promise<
  | { ok: true; enrollment: EnrollmentSummary }
  | {
      ok: false;
      reason: "ENROLLMENT_NOT_FOUND" | "INVALID_STATE" | "INTERNAL";
      detail?: string;
    }
> {
  const existing = await db.hmoEnrollment.findUnique({
    where: { id: enrollmentId },
  });
  if (!existing || existing.partnerId !== partnerId) {
    return { ok: false, reason: "ENROLLMENT_NOT_FOUND" };
  }
  if (existing.status === "CANCELLED") {
    return { ok: true, enrollment: toSummary(existing) };
  }
  if (
    existing.status !== "ACTIVE" &&
    existing.status !== "PENDING_PAYMENT" &&
    existing.status !== "PENDING_HMO"
  ) {
    return {
      ok: false,
      reason: "INVALID_STATE",
      detail: `Cannot cancel enrollment in state ${existing.status}.`,
    };
  }

  // Call connector only when the policy was actually issued.
  if (existing.hmoPolicyId) {
    try {
      await stubCancelPolicy(existing.hmoPolicyId, reason);
    } catch {
      // Swallow — we still want to mark Pierflow-side cancellation.
    }
  }

  const cancelled = await db.$transaction(async (tx) => {
    const updated = await tx.hmoEnrollment.update({
      where: { id: existing.id },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancellationReason: reason,
      },
    });
    await tx.hmoEnrollmentEvent.create({
      data: {
        enrollmentId: existing.id,
        kind: "CANCELLED",
        fromStatus: existing.status,
        toStatus: "CANCELLED",
        detail: { reason },
      },
    });
    return updated;
  });

  const cancelledSummary = toSummary(cancelled);
  fireEnrollmentWebhook(
    partnerId,
    "hmo_enrollment.cancelled",
    cancelledSummary,
    { reason },
  );
  return { ok: true, enrollment: cancelledSummary };
}

// ─────────────────────────────────────────────────────────────────────
// Lookup helpers
// ─────────────────────────────────────────────────────────────────────

export async function getEnrollment(
  enrollmentId: string,
  partnerId: string,
): Promise<EnrollmentSummary | null> {
  const e = await db.hmoEnrollment.findUnique({
    where: { id: enrollmentId },
  });
  if (!e || e.partnerId !== partnerId) return null;
  return toSummary(e);
}

export async function listEnrollmentsByUserRef(
  partnerId: string,
  fintechUserRef: string,
): Promise<EnrollmentSummary[]> {
  const rows = await db.hmoEnrollment.findMany({
    where: { partnerId, fintechUserRef },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toSummary);
}

// ─────────────────────────────────────────────────────────────────────
// Shape conversion
// ─────────────────────────────────────────────────────────────────────

function toSummary(e: {
  id: string;
  partnerId: string;
  providerId: string;
  planId: string;
  quoteId: string | null;
  fintechUserRef: string;
  hmoPolicyId: string | null;
  hmoMemberId: string | null;
  status: HmoEnrollmentStatus;
  effectiveFrom: Date | null;
  effectiveTo: Date | null;
  wholesaleNgn: bigint;
  markupNgn: bigint;
  memberPaysNgn: bigint;
  splitsSnapshot: unknown;
  contractVersion: number;
  createdAt: Date;
  updatedAt: Date;
}): EnrollmentSummary {
  return {
    id: e.id,
    partner_id: e.partnerId,
    provider_id: e.providerId,
    plan_id: e.planId,
    quote_id: e.quoteId,
    fintech_user_ref: e.fintechUserRef,
    hmo_policy_id: e.hmoPolicyId,
    hmo_member_id: e.hmoMemberId,
    status: e.status,
    effective_from: e.effectiveFrom?.toISOString() ?? null,
    effective_to: e.effectiveTo?.toISOString() ?? null,
    wholesale_ngn: e.wholesaleNgn.toString(),
    markup_ngn: e.markupNgn.toString(),
    member_pays_ngn: e.memberPaysNgn.toString(),
    splits_snapshot: e.splitsSnapshot,
    contract_version: e.contractVersion,
    created_at: e.createdAt.toISOString(),
    updated_at: e.updatedAt.toISOString(),
  };
}

// Mirrors lib/insurance/quotes.ts summariseSplits.
function summariseSplits(splits: ReturnType<typeof computePremiumSplits>) {
  if (!splits.ok) return null;
  return {
    mode: splits.mode,
    wholesale_ngn: splits.wholesaleNgn.toString(),
    markup_ngn: splits.markupNgn.toString(),
    member_pays_ngn: splits.memberPaysNgn.toString(),
    hmo_line: {
      role: splits.hmoLine.role,
      amount_ngn: splits.hmoLine.amountNgn.toString(),
      settlement_tag: splits.hmoLine.settlementAccountTag,
    },
    lines: splits.lines.map((l) => ({
      role: l.role,
      amount_ngn: l.amountNgn.toString(),
      raw_amount_ngn:
        l.rawAmountNgn !== undefined ? l.rawAmountNgn.toString() : null,
      settlement_tag: l.settlementAccountTag,
      is_remainder: l.isRemainder,
    })),
  };
}
