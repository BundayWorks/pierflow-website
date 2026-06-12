/**
 * Quote orchestrator.
 *
 * Given a fintech-submitted user profile, walks the active plan
 * catalogue, scores each plan against the profile, computes the
 * wholesale + markup + member-pays math against each plan's active
 * contract, persists the request + ranked quotes, and returns the
 * top N.
 *
 * Key correctness rules:
 *   • A plan with no ACTIVE contract is skipped — there's no agreed
 *     commercial structure, so we can't price it.
 *   • For markup modes the contract's split is computed via the
 *     engine; we freeze splits + memberPays on the quote row so the
 *     fintech sees the same numbers on retrieval and at enrollment.
 *   • Quotes expire 24h after creation (configurable via TTL_MS).
 *   • The function is a single DB transaction: request + N quote
 *     rows land atomically.
 */

import { db } from "@/lib/db";
import type {
  HmoContract,
  HmoContractParty,
  Prisma,
} from "@prisma/client";
import {
  computePremiumSplits,
  type PremiumSplitResult,
} from "@/lib/insurance/split-engine.ts";
import {
  scorePlan,
  assembleQuotePricing,
  type ProfileInput,
  type PlanForScoring,
} from "@/lib/insurance/personalisation.ts";
import { getActiveProviderIds } from "@/lib/insurance/hmo-access.ts";

const TTL_MS = 24 * 60 * 60 * 1000; // 24h

export type CreateQuoteInput = {
  partnerId: string;
  profile: {
    ageInYears: number;
    sex?: "M" | "F" | "U";
    dependents?: number;
    monthlyBudgetNgn?: bigint;
    state?: string;
    lga?: string;
    conditions?: string[];
    fintechRef?: string;
  };
  /** Maximum quotes to return. Defaults to 5, max 20. */
  limit?: number;
  /** Optional: restrict to a single HMO. */
  providerSlug?: string;
};

export type QuoteSummary = {
  id: string;
  plan_id: string;
  rank: number;
  score: number;
  wholesale_ngn: bigint;
  markup_ngn: bigint;
  member_pays_ngn: bigint;
  rationale: unknown;
  contract_version: number;
  splits_snapshot: unknown;
  expires_at: string;
};

export type CreateQuoteResult = {
  request_id: string;
  expires_at: string;
  quotes: QuoteSummary[];
};

export async function createQuotes(
  input: CreateQuoteInput,
): Promise<CreateQuoteResult> {
  const limit = Math.min(Math.max(input.limit ?? 5, 1), 20);

  // ── 1. Load active plans + their providers' active contracts ────
  //
  // We pull plans and contracts in two cheap queries to avoid N+1.
  // Active plans only, from ACTIVE providers, with the JSONB fields
  // we need to score against.
  //
  // Access gate: a fintech can only be quoted plans from HMOs they've
  // opted into. If they've opted into none, there's nothing to quote —
  // return an empty result rather than pricing plans they can't sell.
  const activeProviderIds = await getActiveProviderIds(input.partnerId);
  if (activeProviderIds === null) {
    return await persistEmpty(input);
  }

  const plans = await db.hmoPlan.findMany({
    where: {
      status: "ACTIVE",
      provider: {
        status: "ACTIVE",
        id: { in: Array.from(activeProviderIds) },
        ...(input.providerSlug ? { slug: input.providerSlug } : {}),
      },
    },
    select: {
      id: true,
      providerId: true,
      externalId: true,
      name: true,
      scope: true,
      pricing: true,
      coverage: true,
      exclusions: true,
    },
  });
  if (plans.length === 0) {
    return await persistEmpty(input);
  }

  const providerIds = Array.from(new Set(plans.map((p) => p.providerId)));
  const contracts = await db.hmoContract.findMany({
    where: { providerId: { in: providerIds }, status: "ACTIVE" },
    include: { parties: true },
  });
  const contractByProvider = new Map<string, (typeof contracts)[number]>();
  for (const c of contracts) contractByProvider.set(c.providerId, c);

  // ── 2. Score + price each plan that has a contract ─────────────
  type Candidate = {
    plan: (typeof plans)[number];
    contract: HmoContract & { parties: HmoContractParty[] };
    score: number;
    wholesaleNgn: bigint;
    markupNgn: bigint;
    memberPaysNgn: bigint;
    splits: PremiumSplitResult;
    rationale: unknown;
  };

  const profile: ProfileInput = {
    ageInYears: input.profile.ageInYears,
    sex: input.profile.sex,
    dependents: input.profile.dependents,
    monthlyBudgetNgn: input.profile.monthlyBudgetNgn ?? null,
    state: input.profile.state,
    lga: input.profile.lga,
    conditions: input.profile.conditions,
  };

  const candidates: Candidate[] = [];
  for (const plan of plans) {
    const contract = contractByProvider.get(plan.providerId);
    if (!contract) continue;

    // Personalisation score (and wholesale resolved from pricing).
    const scoringPlan: PlanForScoring = {
      id: plan.id,
      pricing: plan.pricing,
      coverage: plan.coverage,
      scope: plan.scope,
      exclusions: plan.exclusions,
    };
    const scored = scorePlan(scoringPlan, profile);

    // Wholesale → splits via the engine.
    const splits = computePremiumSplits(contract, scored.wholesaleNgn);
    if (!splits.ok) {
      // Skip plans whose contract refuses to compute. They'll come
      // back when the contract is fixed.
      continue;
    }

    const pricing = assembleQuotePricing(
      contract.markupMode,
      scored.wholesaleNgn,
      splits.markupNgn,
    );

    candidates.push({
      plan,
      contract,
      score: scored.score,
      wholesaleNgn: pricing.wholesaleNgn,
      markupNgn: pricing.markupNgn,
      memberPaysNgn: pricing.memberPaysNgn,
      splits,
      rationale: scored.rationale,
    });
  }

  // ── 3. Rank ────────────────────────────────────────────────────
  // Primary by score desc; tiebreak by member_pays asc (cheaper wins).
  candidates.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    if (a.memberPaysNgn !== b.memberPaysNgn) {
      return a.memberPaysNgn < b.memberPaysNgn ? -1 : 1;
    }
    return 0;
  });
  const top = candidates.slice(0, limit);

  // ── 4. Persist atomically ───────────────────────────────────────
  const now = new Date();
  const expiresAt = new Date(now.getTime() + TTL_MS);
  const ageBucket = bucketLabel(input.profile.ageInYears);

  const created = await db.$transaction(async (tx) => {
    const request = await tx.hmoQuoteRequest.create({
      data: {
        partnerId: input.partnerId,
        ageBucket,
        ageInYears: input.profile.ageInYears,
        sex: input.profile.sex ?? "U",
        dependents: input.profile.dependents ?? 0,
        monthlyBudgetNgn: input.profile.monthlyBudgetNgn ?? null,
        state: input.profile.state ?? null,
        lga: input.profile.lga ?? null,
        conditions: input.profile.conditions?.join(",") ?? null,
        fintechRef: input.profile.fintechRef ?? null,
        expiresAt,
      },
      select: { id: true },
    });

    const quoteRows = await Promise.all(
      top.map((c, i) =>
        tx.hmoQuote.create({
          data: {
            quoteRequestId: request.id,
            planId: c.plan.id,
            partnerId: input.partnerId,
            rank: i + 1,
            score: c.score,
            rationale: c.rationale as Prisma.InputJsonValue,
            wholesaleNgn: c.wholesaleNgn,
            markupNgn: c.markupNgn,
            memberPaysNgn: c.memberPaysNgn,
            splitsSnapshot: summariseSplits(c.splits) as Prisma.InputJsonValue,
            contractVersion: c.contract.version,
            status: "CREATED",
            expiresAt,
          },
          select: {
            id: true,
            planId: true,
            rank: true,
            score: true,
            wholesaleNgn: true,
            markupNgn: true,
            memberPaysNgn: true,
            rationale: true,
            contractVersion: true,
            splitsSnapshot: true,
            expiresAt: true,
          },
        }),
      ),
    );

    return { requestId: request.id, quoteRows };
  });

  return {
    request_id: created.requestId,
    expires_at: expiresAt.toISOString(),
    quotes: created.quoteRows.map((q) => ({
      id: q.id,
      plan_id: q.planId,
      rank: q.rank,
      score: q.score,
      wholesale_ngn: q.wholesaleNgn,
      markup_ngn: q.markupNgn,
      member_pays_ngn: q.memberPaysNgn,
      rationale: q.rationale,
      contract_version: q.contractVersion,
      splits_snapshot: q.splitsSnapshot,
      expires_at: q.expiresAt.toISOString(),
    })),
  };
}

async function persistEmpty(
  input: CreateQuoteInput,
): Promise<CreateQuoteResult> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + TTL_MS);
  const ageBucket = bucketLabel(input.profile.ageInYears);
  const request = await db.hmoQuoteRequest.create({
    data: {
      partnerId: input.partnerId,
      ageBucket,
      ageInYears: input.profile.ageInYears,
      sex: input.profile.sex ?? "U",
      dependents: input.profile.dependents ?? 0,
      monthlyBudgetNgn: input.profile.monthlyBudgetNgn ?? null,
      state: input.profile.state ?? null,
      lga: input.profile.lga ?? null,
      conditions: input.profile.conditions?.join(",") ?? null,
      fintechRef: input.profile.fintechRef ?? null,
      expiresAt,
    },
    select: { id: true },
  });
  return {
    request_id: request.id,
    expires_at: expiresAt.toISOString(),
    quotes: [],
  };
}

function summariseSplits(splits: PremiumSplitResult) {
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

function bucketLabel(age: number): string {
  if (age < 18) return "<18";
  if (age <= 25) return "18-25";
  if (age <= 35) return "26-35";
  if (age <= 50) return "36-50";
  if (age <= 65) return "51-65";
  return "66+";
}

// ─────────────────────────────────────────────────────────────────────
// Retrieval
// ─────────────────────────────────────────────────────────────────────

export async function getQuote(
  quoteId: string,
  partnerId: string,
): Promise<QuoteSummary | null> {
  const q = await db.hmoQuote.findUnique({
    where: { id: quoteId },
    select: {
      id: true,
      planId: true,
      partnerId: true,
      rank: true,
      score: true,
      wholesaleNgn: true,
      markupNgn: true,
      memberPaysNgn: true,
      rationale: true,
      contractVersion: true,
      splitsSnapshot: true,
      expiresAt: true,
    },
  });
  if (!q || q.partnerId !== partnerId) return null;
  return {
    id: q.id,
    plan_id: q.planId,
    rank: q.rank,
    score: q.score,
    wholesale_ngn: q.wholesaleNgn,
    markup_ngn: q.markupNgn,
    member_pays_ngn: q.memberPaysNgn,
    rationale: q.rationale,
    contract_version: q.contractVersion,
    splits_snapshot: q.splitsSnapshot,
    expires_at: q.expiresAt.toISOString(),
  };
}

export async function getQuoteRequest(
  requestId: string,
  partnerId: string,
): Promise<CreateQuoteResult | null> {
  const r = await db.hmoQuoteRequest.findUnique({
    where: { id: requestId },
    include: {
      quotes: { orderBy: { rank: "asc" } },
    },
  });
  if (!r || r.partnerId !== partnerId) return null;
  return {
    request_id: r.id,
    expires_at: r.expiresAt.toISOString(),
    quotes: r.quotes.map((q) => ({
      id: q.id,
      plan_id: q.planId,
      rank: q.rank,
      score: q.score,
      wholesale_ngn: q.wholesaleNgn,
      markup_ngn: q.markupNgn,
      member_pays_ngn: q.memberPaysNgn,
      rationale: q.rationale,
      contract_version: q.contractVersion,
      splits_snapshot: q.splitsSnapshot,
      expires_at: q.expiresAt.toISOString(),
    })),
  };
}
