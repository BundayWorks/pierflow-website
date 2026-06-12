/**
 * Rule-based personalisation engine for HMO plan quotes.
 *
 * Takes a user profile and a candidate plan, returns a composite
 * score in [0, 1] plus a structured rationale ({ reasons, warnings,
 * signals }). The fintech can render the rationale honestly — "This
 * plan fits your budget, covers Lagos, includes your dependents" —
 * with the per-signal score breakdown available for audit.
 *
 * Signal weights (sum = 1.0):
 *
 *   Budget fit            0.35   — premium ≤ budget? linear ramp 0-20% over
 *   Age bracket           0.20   — does the user fit a declared age band?
 *   Dependents covered    0.15   — plan covers ≥ user's declared dependents?
 *   Geographic coverage   0.15   — plan active in user's state/LGA?
 *   Coverage richness     0.10   — count of covered benefit categories
 *   Condition exclusions  0.05   — penalty when plan excludes a user condition
 *                                   (subtracts up to 0.3 from final score)
 *
 * The engine is deterministic. Same inputs always produce the same
 * score. It does not depend on past behaviour or population data —
 * that's the model-based engine, a future replacement behind this
 * same interface.
 *
 * Scoring is pure: no IO. The caller provides the plan, the contract
 * (for markup math), and the profile; we return the verdict.
 */

import type { HmoContractMarkupMode } from "@prisma/client";

const KOBO_PER_NAIRA = BigInt(100);

// ─────────────────────────────────────────────────────────────────────
// Inputs
// ─────────────────────────────────────────────────────────────────────

export type ProfileInput = {
  /** Age in years; bucketed before persistence but used directly by the engine. */
  ageInYears: number;
  sex?: "M" | "F" | "U";
  /** Number of dependents the user wants covered (excluding self). */
  dependents?: number;
  /** Monthly budget in kobo. Null = no budget constraint. */
  monthlyBudgetNgn?: bigint | null;
  state?: string;
  lga?: string;
  /** Self-declared condition tokens (lowercase: "asthma", "diabetes"). */
  conditions?: string[];
};

export type PlanForScoring = {
  /** Plan's HmoPlan.id — included in the output for ordering ties. */
  id: string;
  /** Universal Plan Schema pricing block. */
  pricing: unknown;
  /** Universal Plan Schema coverage block. */
  coverage: unknown;
  /** Universal Plan Schema scope. */
  scope: string;
  /** Universal Plan Schema exclusions array. */
  exclusions: unknown;
};

// ─────────────────────────────────────────────────────────────────────
// Outputs
// ─────────────────────────────────────────────────────────────────────

export type ScoreSignal = {
  /** 0..1 — this signal's contribution before weighting. */
  raw: number;
  /** Weighted raw × weight — what flows into the composite. */
  weighted: number;
  /** Optional rationale line surfaced to the fintech. */
  reason?: string;
  /** Optional warning surfaced to the fintech. */
  warning?: string;
};

export type Rationale = {
  reasons: string[];
  warnings: string[];
  /** Per-signal scores for audit. */
  signals: Record<string, number>;
};

export type ScoreResult = {
  /** Composite 0..1. Negative penalties are clamped to >= 0. */
  score: number;
  /** Wholesale (HMO catalogue) premium for the user. Kobo BigInt. */
  wholesaleNgn: bigint;
  rationale: Rationale;
};

// ─────────────────────────────────────────────────────────────────────
// Weights
// ─────────────────────────────────────────────────────────────────────

const WEIGHTS = {
  budget: 0.35,
  age: 0.2,
  dependents: 0.15,
  geography: 0.15,
  coverage: 0.1,
  // Exclusion is subtracted from the composite, not added; weight here
  // is the maximum penalty (raw ∈ [0, 1] mapped to subtract up to 0.3).
  exclusionPenalty: 0.3,
} as const;

// ─────────────────────────────────────────────────────────────────────
// Public — score one plan
// ─────────────────────────────────────────────────────────────────────

export function scorePlan(
  plan: PlanForScoring,
  profile: ProfileInput,
): ScoreResult {
  const wholesale = wholesaleForUser(plan, profile);
  const signals: Record<string, ScoreSignal> = {
    budget: scoreBudget(wholesale, profile),
    age: scoreAge(plan, profile),
    dependents: scoreDependents(plan, profile),
    geography: scoreGeography(plan, profile),
    coverage: scoreCoverage(plan),
  };
  const penalty = scoreExclusionPenalty(plan, profile);

  const composite =
    signals.budget.weighted +
    signals.age.weighted +
    signals.dependents.weighted +
    signals.geography.weighted +
    signals.coverage.weighted -
    penalty.weighted;

  const score = Math.max(0, Math.min(1, composite));

  const reasons: string[] = [];
  const warnings: string[] = [];
  const signalScores: Record<string, number> = {};

  for (const [k, s] of Object.entries(signals)) {
    signalScores[k] = round3(s.raw);
    if (s.reason) reasons.push(s.reason);
    if (s.warning) warnings.push(s.warning);
  }
  signalScores.exclusionPenalty = round3(penalty.raw);
  if (penalty.warning) warnings.push(penalty.warning);

  return {
    score: round3(score),
    wholesaleNgn: wholesale,
    rationale: { reasons, warnings, signals: signalScores },
  };
}

// ─────────────────────────────────────────────────────────────────────
// Signal implementations
// ─────────────────────────────────────────────────────────────────────

function scoreBudget(
  wholesale: bigint,
  profile: ProfileInput,
): ScoreSignal {
  if (!profile.monthlyBudgetNgn || profile.monthlyBudgetNgn <= BigInt(0)) {
    return {
      raw: 0.5,
      weighted: 0.5 * WEIGHTS.budget,
      reason: undefined,
    };
  }
  const budget = profile.monthlyBudgetNgn;
  // Note: wholesale alone underestimates what the user actually pays in
  // markup modes (markup is added on top). We score budget against
  // wholesale here because the markup applies uniformly across the
  // catalogue at quote time and is invisible to the scoring rule. The
  // caller can choose to score against memberPays instead by passing
  // the post-markup amount as wholesale, if desired.
  if (wholesale <= budget) {
    return {
      raw: 1,
      weighted: WEIGHTS.budget,
      reason: `Fits your ₦${nairaOf(budget).toLocaleString()} monthly budget`,
    };
  }
  // Up to 20% over budget — linear ramp from 0.5 down to 0.
  const over = Number(wholesale - budget);
  const tolerance = Number(budget) * 0.2;
  if (tolerance <= 0) {
    return { raw: 0, weighted: 0 };
  }
  if (over > tolerance) {
    return {
      raw: 0,
      weighted: 0,
      warning: `Premium ₦${nairaOf(wholesale).toLocaleString()} exceeds your budget by more than 20%`,
    };
  }
  const raw = 0.5 * (1 - over / tolerance);
  return {
    raw,
    weighted: raw * WEIGHTS.budget,
    warning: `Slightly over budget (₦${nairaOf(wholesale).toLocaleString()} vs ₦${nairaOf(budget).toLocaleString()})`,
  };
}

function scoreAge(plan: PlanForScoring, profile: ProfileInput): ScoreSignal {
  const pricing = plan.pricing as
    | { age_bands?: { min_age: number; max_age: number }[] }
    | null;
  const bands = pricing?.age_bands ?? [];
  if (bands.length === 0) {
    return {
      raw: 1,
      weighted: WEIGHTS.age,
    };
  }
  const inBand = bands.some(
    (b) => profile.ageInYears >= b.min_age && profile.ageInYears <= b.max_age,
  );
  if (inBand) {
    return {
      raw: 1,
      weighted: WEIGHTS.age,
      reason: `Available for age ${profile.ageInYears}`,
    };
  }
  return {
    raw: 0,
    weighted: 0,
    warning: `Plan's age bands don't cover age ${profile.ageInYears}`,
  };
}

function scoreDependents(
  plan: PlanForScoring,
  profile: ProfileInput,
): ScoreSignal {
  const want = profile.dependents ?? 0;
  if (want === 0) {
    return { raw: 1, weighted: WEIGHTS.dependents };
  }
  // We don't yet capture "dependents_included" on the Universal Plan
  // Schema. Approximate: FAMILY-scoped plans cover dependents; others
  // don't. Refine when we expose dependents_included on the schema.
  if (plan.scope === "FAMILY" || plan.scope === "EMPLOYEE_GROUP") {
    return {
      raw: 1,
      weighted: WEIGHTS.dependents,
      reason: `Covers ${want} dependent${want === 1 ? "" : "s"}`,
    };
  }
  return {
    raw: 0,
    weighted: 0,
    warning: `${plan.scope.toLowerCase()} plan — doesn't cover dependents`,
  };
}

function scoreGeography(
  plan: PlanForScoring,
  profile: ProfileInput,
): ScoreSignal {
  // We don't yet store plan.network_providers as a queryable structure
  // here (those rows live on a future HmoPlanNetworkProvider table).
  // For MVP: if the user supplied a state, give a soft 0.6 (we can't
  // confirm coverage); if no state, neutral 0.5. Replace with a real
  // join when network rows arrive.
  if (!profile.state) {
    return { raw: 0.5, weighted: 0.5 * WEIGHTS.geography };
  }
  return {
    raw: 0.6,
    weighted: 0.6 * WEIGHTS.geography,
    reason: `Coverage in ${profile.lga ? `${profile.lga}, ` : ""}${profile.state} not yet verified — confirm at enrollment`,
  };
}

function scoreCoverage(plan: PlanForScoring): ScoreSignal {
  const coverage = plan.coverage as Record<string, unknown> | null;
  if (!coverage) return { raw: 0, weighted: 0 };
  const covered = Object.values(coverage).filter((b) => {
    if (!b || typeof b !== "object") return false;
    return (b as { covered?: unknown }).covered === true;
  }).length;
  // 0 → 0, 11 (all benefit categories) → 1.
  const raw = Math.min(1, covered / 11);
  return {
    raw,
    weighted: raw * WEIGHTS.coverage,
    reason: covered >= 6 ? "Broad benefit coverage" : undefined,
  };
}

function scoreExclusionPenalty(
  plan: PlanForScoring,
  profile: ProfileInput,
): ScoreSignal {
  if (!profile.conditions || profile.conditions.length === 0) {
    return { raw: 0, weighted: 0 };
  }
  const excl = (Array.isArray(plan.exclusions) ? plan.exclusions : []) as string[];
  if (excl.length === 0) {
    return { raw: 0, weighted: 0 };
  }
  const hits: string[] = [];
  for (const c of profile.conditions) {
    const needle = c.toLowerCase();
    if (excl.some((e) => e.toLowerCase().includes(needle))) {
      hits.push(c);
    }
  }
  if (hits.length === 0) {
    return { raw: 0, weighted: 0 };
  }
  // Each matching exclusion adds 1/conditions of the max penalty.
  const raw = Math.min(1, hits.length / profile.conditions.length);
  return {
    raw,
    weighted: raw * WEIGHTS.exclusionPenalty,
    warning: `Plan excludes: ${hits.join(", ")}`,
  };
}

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────

/**
 * Resolve the wholesale monthly premium that applies to a specific
 * user under a plan. Walks the age bands in order; falls back to the
 * `individual_monthly` fallback when no band matches.
 *
 * Returned in kobo BigInt.
 */
function wholesaleForUser(
  plan: PlanForScoring,
  profile: ProfileInput,
): bigint {
  const pricing = plan.pricing as
    | {
        individual_monthly?: number;
        age_bands?: { min_age: number; max_age: number; monthly: number }[];
        family_rate?: number;
      }
    | null;
  if (!pricing) return BigInt(0);

  // Family plans use family_rate when set.
  if (
    (plan.scope === "FAMILY" || plan.scope === "EMPLOYEE_GROUP") &&
    pricing.family_rate
  ) {
    return BigInt(pricing.family_rate);
  }

  if (Array.isArray(pricing.age_bands)) {
    for (const band of pricing.age_bands) {
      if (
        profile.ageInYears >= band.min_age &&
        profile.ageInYears <= band.max_age
      ) {
        return BigInt(band.monthly);
      }
    }
  }
  return BigInt(pricing.individual_monthly ?? 0);
}

function nairaOf(kobo: bigint): number {
  return Number(kobo / KOBO_PER_NAIRA);
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

// ─────────────────────────────────────────────────────────────────────
// Quote price assembly — wholesale + markup → member pays
// ─────────────────────────────────────────────────────────────────────
//
// For MARKUP_FIXED contracts the markup is the contract's fixed
// amount. For MARKUP_FROM_SHARES the engine layer's
// computePremiumSplits resolves it from the parties; this helper is
// thin and lets the route layer call into the split engine.
//
// In GROSS_SHARE the contract operates on the user's full premium —
// member_pays = wholesale, and the contract dictates how it's split.
// In markup modes, member_pays = wholesale + markup.

export type QuotePricing = {
  wholesaleNgn: bigint;
  markupNgn: bigint;
  memberPaysNgn: bigint;
};

export function assembleQuotePricing(
  mode: HmoContractMarkupMode,
  wholesaleNgn: bigint,
  markupNgnFromEngine: bigint,
): QuotePricing {
  if (mode === "GROSS_SHARE") {
    return {
      wholesaleNgn,
      markupNgn: BigInt(0),
      memberPaysNgn: wholesaleNgn,
    };
  }
  return {
    wholesaleNgn,
    markupNgn: markupNgnFromEngine,
    memberPaysNgn: wholesaleNgn + markupNgnFromEngine,
  };
}

/** Bucket an age into the canonical strings we persist. */
export function bucketAge(age: number): string {
  if (age < 18) return "<18";
  if (age <= 25) return "18-25";
  if (age <= 35) return "26-35";
  if (age <= 50) return "36-50";
  if (age <= 65) return "51-65";
  return "66+";
}
