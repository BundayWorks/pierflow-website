/**
 * HmoContract persistence + lifecycle.
 *
 *   createContractDraft()   capture a new versioned DRAFT with parties
 *   activateContract()      flip DRAFT → ACTIVE, supersede the old one
 *   getActiveContract()     the runtime read path (settlement instructor + quote engine)
 *   listContractsForProvider()  staff portal queue
 *   computeContractPreview()    dry-run the split engine at a chosen amount
 *
 * All writes are transactional. Activation atomically supersedes any
 * prior ACTIVE so the runtime never sees two ACTIVE contracts.
 */

import type {
  HmoContractStatus,
  HmoContractPartyRole,
  HmoContractFeeKind,
  HmoContractFeeTiming,
  HmoContractMarkupMode,
} from "@prisma/client";
import { db } from "@/lib/db";
import { emitFireAndForget } from "@/lib/webhooks";
import {
  computeSplits,
  computePremiumSplits,
  computeEnrollmentSplits,
  validateContract,
  type SplitResult,
  type SplitEvent,
  type PremiumSplitResult,
} from "@/lib/insurance/split-engine.ts";

// ─────────────────────────────────────────────────────────────────────
// Inputs
// ─────────────────────────────────────────────────────────────────────

export type DraftPartyInput = {
  role: HmoContractPartyRole;
  displayName?: string | null;
  partnerId?: string | null;
  kind: HmoContractFeeKind;
  timing: HmoContractFeeTiming;
  /** Required when kind=FLAT. Naira (we coerce to kobo BigInt). */
  amountFlatNaira?: number | null;
  /** Required when kind=PERCENTAGE. Percentage 0..100 (we coerce to bps). */
  amountPercent?: number | null;
  minPerCycleNaira?: number | null;
  maxPerCycleNaira?: number | null;
  settlementAccountTag?: string | null;
  notes?: string | null;
};

export type CreateContractDraftInput = {
  providerId: string;
  effectiveFrom: Date;
  effectiveTo?: Date | null;
  /** Defaults to GROSS_SHARE for backwards compatibility. */
  markupMode?: HmoContractMarkupMode;
  /** Required when markupMode = MARKUP_FIXED. Naira (we coerce to kobo). */
  markupFixedNaira?: number | null;
  enrollmentFeeNaira?: number | null;
  /**
   * Who receives the enrollment fee. Required in markup modes when
   * enrollment fee > 0. Ignored in GROSS_SHARE (split by party timing).
   */
  enrollmentBeneficiaryRole?: HmoContractPartyRole | null;
  remainderBearer: HmoContractPartyRole;
  parties: DraftPartyInput[];
  notes?: string | null;
  createdByExternalId?: string | null;
};

export type CreateContractOutcome =
  | {
      ok: true;
      contractId: string;
      version: number;
      status: HmoContractStatus;
    }
  | {
      ok: false;
      reason: "VALIDATION_FAILED";
      issues: string[];
    };

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────

const ZERO = BigInt(0);
const KOBO_PER_NAIRA = BigInt(100);
const BPS_PER_PERCENT = 100;

function nairaToKobo(n: number | null | undefined): bigint | null {
  if (n === null || n === undefined || !Number.isFinite(n)) return null;
  return BigInt(Math.round(n)) * KOBO_PER_NAIRA;
}

function percentToBps(p: number | null | undefined): number | null {
  if (p === null || p === undefined || !Number.isFinite(p)) return null;
  return Math.round(p * BPS_PER_PERCENT);
}

// ─────────────────────────────────────────────────────────────────────
// Lifecycle
// ─────────────────────────────────────────────────────────────────────

/**
 * Create a versioned DRAFT contract + its parties in one transaction.
 * Runs the split-engine static validator before writing — refuses to
 * persist anything that wouldn't compute cleanly.
 */
export async function createContractDraft(
  input: CreateContractDraftInput,
): Promise<CreateContractOutcome> {
  // Coerce naira inputs to kobo / bps once.
  const partiesData = input.parties.map((p) => ({
    role: p.role,
    displayName: p.displayName ?? null,
    partnerId: p.partnerId ?? null,
    kind: p.kind,
    timing: p.timing,
    amountFlatNgn:
      p.kind === "FLAT" ? nairaToKobo(p.amountFlatNaira ?? 0) : null,
    amountBps: p.kind === "PERCENTAGE" ? percentToBps(p.amountPercent) : null,
    minPerCycleNgn: nairaToKobo(p.minPerCycleNaira),
    maxPerCycleNgn: nairaToKobo(p.maxPerCycleNaira),
    settlementAccountTag: p.settlementAccountTag ?? null,
    notes: p.notes ?? null,
  }));

  // Pre-flight validation. We build a stand-in shape the engine
  // accepts so we surface clean errors before the DB write.
  const markupMode = input.markupMode ?? "GROSS_SHARE";
  const trialContract = {
    id: "preflight",
    providerId: input.providerId,
    version: 0,
    status: "DRAFT" as HmoContractStatus,
    effectiveFrom: input.effectiveFrom,
    effectiveTo: input.effectiveTo ?? null,
    markupMode,
    markupFixedNgn: nairaToKobo(input.markupFixedNaira),
    enrollmentFeeNgn: nairaToKobo(input.enrollmentFeeNaira),
    enrollmentBeneficiaryRole: input.enrollmentBeneficiaryRole ?? null,
    remainderBearer: input.remainderBearer,
    notes: input.notes ?? null,
    metadata: null,
    createdAt: new Date(),
    createdByExternalId: input.createdByExternalId ?? null,
    updatedAt: new Date(),
    parties: partiesData.map((p, i) => ({
      id: `pre_${i}`,
      contractId: "preflight",
      createdAt: new Date(),
      ...p,
    })),
  };

  const validation = validateContract(trialContract);
  if (!validation.ok) {
    return { ok: false, reason: "VALIDATION_FAILED", issues: validation.issues };
  }

  // Allocate a version number per provider.
  const latest = await db.hmoContract.findFirst({
    where: { providerId: input.providerId },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const nextVersion = (latest?.version ?? 0) + 1;

  const created = await db.$transaction(async (tx) => {
    const contract = await tx.hmoContract.create({
      data: {
        providerId: input.providerId,
        version: nextVersion,
        status: "DRAFT",
        effectiveFrom: input.effectiveFrom,
        effectiveTo: input.effectiveTo ?? null,
        markupMode,
        markupFixedNgn: nairaToKobo(input.markupFixedNaira),
        enrollmentFeeNgn: nairaToKobo(input.enrollmentFeeNaira),
        enrollmentBeneficiaryRole: input.enrollmentBeneficiaryRole ?? null,
        remainderBearer: input.remainderBearer,
        notes: input.notes ?? null,
        createdByExternalId: input.createdByExternalId ?? null,
        parties: { create: partiesData },
      },
      select: { id: true, version: true, status: true },
    });
    return contract;
  });

  return {
    ok: true,
    contractId: created.id,
    version: created.version,
    status: created.status,
  };
}

/**
 * Flip a DRAFT to ACTIVE. Atomically supersedes any prior ACTIVE for
 * the same provider so the runtime never sees two.
 *
 * After the transaction commits, fire hmo.rate_card.updated webhooks to
 * every fintech with an ACTIVE opt-in for this HMO so they know the
 * rate card has changed and can re-accept if desired.
 */
export async function activateContract(contractId: string) {
  const activated = await db.$transaction(async (tx) => {
    const draft = await tx.hmoContract.findUnique({
      where: { id: contractId },
      select: { id: true, providerId: true, status: true, version: true },
    });
    if (!draft) throw new Error("CONTRACT_NOT_FOUND");
    if (draft.status === "ACTIVE") return draft;
    if (draft.status === "TERMINATED") {
      throw new Error("Cannot activate a terminated contract.");
    }

    await tx.hmoContract.updateMany({
      where: {
        providerId: draft.providerId,
        status: "ACTIVE",
        id: { not: draft.id },
      },
      data: { status: "SUPERSEDED" },
    });

    return tx.hmoContract.update({
      where: { id: draft.id },
      data: { status: "ACTIVE" },
      select: { id: true, providerId: true, status: true, version: true },
    });
  });

  // Notify fintechs with an active opt-in (fire-and-forget — webhook
  // delivery failures must not break contract activation).
  void notifyRateCardUpdated(activated.providerId, activated.id, activated.version);

  return activated;
}

/**
 * Find all fintechs with ACTIVE access to this HMO and emit
 * hmo.rate_card.updated to each one. Runs after the transaction
 * commits so webhooks see the new contract as the active one.
 */
async function notifyRateCardUpdated(
  providerId: string,
  contractId: string,
  version: number,
) {
  try {
    const accessRows = await db.partnerHmoAccess.findMany({
      where: { hmoProviderId: providerId, status: "ACTIVE" },
      select: {
        partnerId: true,
        provider: { select: { slug: true, displayName: true } },
      },
    });
    for (const row of accessRows) {
      emitFireAndForget(row.partnerId, "hmo.rate_card.updated", {
        provider_slug: row.provider.slug,
        provider_name: row.provider.displayName,
        contract_id: contractId,
        contract_version: version,
      });
    }
  } catch {
    // Swallow — webhook delivery is best-effort.
  }
}

export async function getActiveContract(providerId: string) {
  return db.hmoContract.findFirst({
    where: { providerId, status: "ACTIVE" },
    orderBy: { version: "desc" },
    include: { parties: { orderBy: { createdAt: "asc" } } },
  });
}

export async function listContractsForProvider(providerId: string) {
  return db.hmoContract.findMany({
    where: { providerId },
    orderBy: [{ version: "desc" }],
    select: {
      id: true,
      version: true,
      status: true,
      effectiveFrom: true,
      effectiveTo: true,
      markupMode: true,
      markupFixedNgn: true,
      enrollmentFeeNgn: true,
      enrollmentBeneficiaryRole: true,
      remainderBearer: true,
      createdAt: true,
      _count: { select: { parties: true } },
    },
  });
}

export async function getContractDetail(contractId: string) {
  return db.hmoContract.findUnique({
    where: { id: contractId },
    include: { parties: { orderBy: { createdAt: "asc" } } },
  });
}

/**
 * Dry-run the split engine against a contract draft. The wizard's
 * review step calls this with a sample premium so staff can see what
 * actually flows to whom before activating.
 */
export function computeContractPreview(
  contract: Awaited<ReturnType<typeof getContractDetail>>,
  event: SplitEvent,
  totalNaira: number,
): SplitResult {
  if (!contract) {
    return { ok: false, issues: ["Contract not found."] };
  }
  const totalKobo = BigInt(Math.round(totalNaira)) * KOBO_PER_NAIRA;
  if (totalKobo < ZERO) {
    return { ok: false, issues: ["Amount must be non-negative."] };
  }
  return computeSplits(contract, event, totalKobo);
}

/**
 * Wholesale-aware preview for the recurring premium event. Mirrors
 * the runtime quote engine: takes a sample wholesale price (typically
 * the plan's pricing.individual_monthly) and returns
 * `{ wholesale, markup, member_pays, hmoLine, lines }` in all modes.
 */
export function computePremiumPreview(
  contract: Awaited<ReturnType<typeof getContractDetail>>,
  wholesaleNaira: number,
): PremiumSplitResult {
  if (!contract) {
    return { ok: false, issues: ["Contract not found."] };
  }
  const wholesaleKobo = BigInt(Math.round(wholesaleNaira)) * KOBO_PER_NAIRA;
  if (wholesaleKobo < ZERO) {
    return { ok: false, issues: ["wholesaleNaira must be non-negative."] };
  }
  return computePremiumSplits(contract, wholesaleKobo);
}

/**
 * Enrollment-fee preview. Routes through the new engine which:
 *   • In markup modes: pays the fee entirely to enrollmentBeneficiaryRole.
 *   • In gross share: splits among enrollment-eligible parties with
 *     caps/floors skipped (one-time fees, not cycles).
 */
export function computeEnrollmentPreview(
  contract: Awaited<ReturnType<typeof getContractDetail>>,
): PremiumSplitResult {
  if (!contract) {
    return { ok: false, issues: ["Contract not found."] };
  }
  return computeEnrollmentSplits(contract);
}
