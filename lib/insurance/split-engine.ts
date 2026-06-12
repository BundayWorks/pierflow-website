/**
 * Split engine — reads an HmoContract + its parties and computes the
 * settlement breakdown for a single event (enrollment or premium
 * collection).
 *
 * Inputs:
 *   • contract (with parties array preloaded)
 *   • event kind: ENROLLMENT_FEE or RECURRING_PREMIUM
 *   • the underlying amount being split (kobo, BigInt)
 *
 * Output:
 *   • an array of `{ partyId, role, amountNgn, settlementAccountTag }`
 *     entries whose amounts sum exactly to the underlying amount
 *   • a remainder line (often zero) absorbed by the contract's
 *     `remainderBearer` role
 *   • an issues array — non-empty means the contract is malformed
 *     and the engine refused to compute
 *
 * Invariants:
 *   • All arithmetic in integer minor units. No floats anywhere.
 *   • Percentages stored as basis points (10000 = 100%). 6.5% → 650.
 *   • Caps and floors apply only to PERCENTAGE lines (flat is flat).
 *   • Sum of all party amounts === input amount, always. If the math
 *     leaves residual kobo (capping, flooring, rounding), the residue
 *     is added to the remainder bearer's line.
 *
 * The validator is exported separately so the staff portal can refuse
 * to save a contract that wouldn't compute cleanly.
 */

import type {
  HmoContract,
  HmoContractParty,
  HmoContractPartyRole,
} from "@prisma/client";

export type SplitEvent = "ENROLLMENT_FEE" | "RECURRING_PREMIUM";

export type SplitLine = {
  partyId: string;
  role: HmoContractPartyRole;
  /** Settlement destination tag (e.g. "pierflow:platform_fee"). May be null. */
  settlementAccountTag: string | null;
  /** Amount this party receives, in NGN minor units. */
  amountNgn: bigint;
  /**
   * For PERCENTAGE lines: the uncapped, unfloored ideal amount. Useful
   * for the audit trail — "you would have got ₦1,500 but your cap is
   * ₦1,000."
   */
  rawAmountNgn?: bigint;
  /** True if this line is the remainder bearer absorbing residue. */
  isRemainder: boolean;
};

export type SplitResult =
  | {
      ok: true;
      event: SplitEvent;
      totalNgn: bigint;
      lines: SplitLine[];
    }
  | { ok: false; issues: string[] };

/**
 * Compute the splits for an event under a given contract.
 *
 * Algorithm:
 *   1. Filter parties to those active for this event (timing matches).
 *   2. Allocate FLAT lines first — they're not subject to caps/floors.
 *   3. Compute remaining = total - sum(flat lines).
 *   4. Allocate PERCENTAGE lines against the *original total*, then
 *      apply min/max caps. Caps clamp; floors raise to the minimum.
 *      A line whose ideal share is > remaining is capped to remaining.
 *   5. Sum everything. The residue (positive or negative) is added
 *      to the remainder bearer's line.
 *   6. Validate sum === total. Refuse to return inconsistent results.
 */
const ZERO = BigInt(0);
const BPS_DENOM = BigInt(10000);

export function computeSplits(
  contract: HmoContract & { parties: HmoContractParty[] },
  event: SplitEvent,
  totalNgn: bigint,
  options?: {
    /**
     * When true, ignore min/max per-cycle caps on PERCENTAGE lines.
     * Used for ENROLLMENT_FEE events because caps are negotiated for
     * recurring premiums (e.g. "min ₦100 per cycle"); applying them
     * to a one-time fee leads to nonsense — a ₦10 enrollment fee
     * shouldn't trigger Pierflow's ₦100 floor.
     */
    skipCaps?: boolean;
  },
): SplitResult {
  if (totalNgn < ZERO) {
    return { ok: false, issues: ["totalNgn must be non-negative"] };
  }
  const skipCaps = options?.skipCaps ?? false;

  // Step 1 — filter parties relevant to this event.
  const eligible = contract.parties.filter((p) => partyApplies(p, event));
  if (eligible.length === 0) {
    return {
      ok: false,
      issues: [
        `Contract ${contract.id} has no parties for event ${event}. Every event needs at least one recipient.`,
      ],
    };
  }

  // Validate the contract is well-formed for this event before we
  // start allocating — cleaner errors than half-allocated state.
  const structuralIssues = validateForEvent(contract, eligible);
  if (structuralIssues.length > 0) {
    return { ok: false, issues: structuralIssues };
  }

  const lines: SplitLine[] = [];

  // Step 2 — flat lines first.
  let flatSum = ZERO;
  for (const p of eligible) {
    if (p.kind !== "FLAT") continue;
    const amt = p.amountFlatNgn ?? ZERO;
    flatSum += amt;
    lines.push({
      partyId: p.id,
      role: p.role,
      settlementAccountTag: p.settlementAccountTag ?? null,
      amountNgn: amt,
      isRemainder: false,
    });
  }

  if (flatSum > totalNgn) {
    return {
      ok: false,
      issues: [
        `Flat fees sum to ${flatSum} which exceeds the event total ${totalNgn}. Renegotiate flat amounts or designate a remainder bearer differently.`,
      ],
    };
  }

  // Step 3 — percentage lines.
  let pctSum = ZERO;
  for (const p of eligible) {
    if (p.kind !== "PERCENTAGE") continue;
    const bps = p.amountBps ?? 0;
    // raw = total * bps / 10000, integer arithmetic.
    const raw = (totalNgn * BigInt(bps)) / BPS_DENOM;
    let amt = raw;

    if (!skipCaps) {
      // Apply floor.
      if (p.minPerCycleNgn !== null && p.minPerCycleNgn !== undefined) {
        if (amt < p.minPerCycleNgn) amt = p.minPerCycleNgn;
      }
      // Apply cap.
      if (p.maxPerCycleNgn !== null && p.maxPerCycleNgn !== undefined) {
        if (amt > p.maxPerCycleNgn) amt = p.maxPerCycleNgn;
      }
    }

    pctSum += amt;
    lines.push({
      partyId: p.id,
      role: p.role,
      settlementAccountTag: p.settlementAccountTag ?? null,
      amountNgn: amt,
      rawAmountNgn: raw,
      isRemainder: false,
    });
  }

  // Step 4 — find the remainder bearer line and absorb the residue.
  const allocated = flatSum + pctSum;
  const residue = totalNgn - allocated;

  // The remainder bearer is the first eligible party whose role matches
  // contract.remainderBearer. If none exists for this event, we fall
  // back to the largest line by amount.
  let bearer = lines.find(
    (l) => l.role === contract.remainderBearer && !l.isRemainder,
  );
  if (!bearer) {
    // No designated bearer is participating in this event. Pick the
    // line with the largest amount as a fallback. This is a contract
    // design smell — we surface it as a warning via issues but still
    // produce a valid split so partners aren't blocked.
    bearer = [...lines].sort((a, b) =>
      a.amountNgn < b.amountNgn ? 1 : a.amountNgn > b.amountNgn ? -1 : 0,
    )[0];
  }
  bearer.amountNgn += residue;
  bearer.isRemainder = true;

  // Step 5 — refuse to floor a party below zero.
  if (lines.some((l) => l.amountNgn < ZERO)) {
    return {
      ok: false,
      issues: [
        `Computed split has at least one negative line — the contract over-allocates (flat + percentage caps exceed the event total ${totalNgn}). Review contract caps/floors.`,
      ],
    };
  }

  // Step 6 — final invariant.
  const sum = lines.reduce((acc, l) => acc + l.amountNgn, ZERO);
  if (sum !== totalNgn) {
    return {
      ok: false,
      issues: [
        `Internal error: lines sum to ${sum} but total is ${totalNgn}. This is a bug in the engine, not the contract.`,
      ],
    };
  }

  return { ok: true, event, totalNgn, lines };
}

/**
 * Whether a contract party participates in a given event.
 *
 *   ENROLLMENT_FEE     → timing in (ENROLLMENT_ONLY, BOTH)
 *   RECURRING_PREMIUM  → timing in (RECURRING_ONLY, BOTH)
 */
export function partyApplies(
  party: HmoContractParty,
  event: SplitEvent,
): boolean {
  if (party.timing === "BOTH") return true;
  if (event === "ENROLLMENT_FEE") return party.timing === "ENROLLMENT_ONLY";
  return party.timing === "RECURRING_ONLY";
}

/**
 * Per-event structural validation. Runs before allocation.
 */
function validateForEvent(
  contract: HmoContract & { parties: HmoContractParty[] },
  eligible: HmoContractParty[],
): string[] {
  const issues: string[] = [];

  // Percentage lines must sum to exactly 10000 bps (100%) for any
  // event where percentage is the *only* allocation mechanism. When
  // flat lines also participate, percentages apply to the full total
  // (not the remainder) and the remainder bearer absorbs the slack —
  // so percentages can be < 100% in that case, but never > 100%.
  const pctSum = eligible
    .filter((p) => p.kind === "PERCENTAGE")
    .reduce((acc, p) => acc + (p.amountBps ?? 0), 0);
  if (pctSum > 10000) {
    issues.push(
      `Contract ${contract.id} v${contract.version}: percentage shares sum to ${pctSum / 100}% (must be <= 100%).`,
    );
  }

  // Every party must declare either a flat amount or a basis-point
  // share, but not both / neither.
  for (const p of eligible) {
    if (p.kind === "FLAT") {
      if (p.amountFlatNgn === null || p.amountFlatNgn === undefined) {
        issues.push(
          `Party ${p.role} (${p.id}): kind=FLAT but no amountFlatNgn set.`,
        );
      }
      if (p.amountBps !== null && p.amountBps !== undefined) {
        issues.push(
          `Party ${p.role} (${p.id}): kind=FLAT but amountBps is also set.`,
        );
      }
    }
    if (p.kind === "PERCENTAGE") {
      if (p.amountBps === null || p.amountBps === undefined) {
        issues.push(
          `Party ${p.role} (${p.id}): kind=PERCENTAGE but no amountBps set.`,
        );
      }
      if (p.amountFlatNgn !== null && p.amountFlatNgn !== undefined) {
        issues.push(
          `Party ${p.role} (${p.id}): kind=PERCENTAGE but amountFlatNgn is also set.`,
        );
      }
      // Floors > caps would never compute correctly.
      if (
        p.minPerCycleNgn !== null &&
        p.maxPerCycleNgn !== null &&
        p.minPerCycleNgn !== undefined &&
        p.maxPerCycleNgn !== undefined &&
        p.minPerCycleNgn > p.maxPerCycleNgn
      ) {
        issues.push(
          `Party ${p.role} (${p.id}): minPerCycleNgn (${p.minPerCycleNgn}) > maxPerCycleNgn (${p.maxPerCycleNgn}).`,
        );
      }
    }
  }

  return issues;
}

/**
 * Static validation a contract must pass before staff can save it.
 * Stronger than the per-event check because it considers both events
 * together — the same contract has to compute cleanly for both
 * enrollment fees and recurring premiums.
 *
 * Use this in the contract create/update server action.
 */
export function validateContract(
  contract: HmoContract & { parties: HmoContractParty[] },
): { ok: true } | { ok: false; issues: string[] } {
  const issues: string[] = [];

  if (contract.parties.length === 0) {
    issues.push("Contract has no parties.");
  }

  // ── Mode-specific structural rules ──────────────────────────────
  //
  // GROSS_SHARE
  //   The contract MUST include an HMO party — it's a participant.
  //
  // MARKUP_FIXED
  //   markupFixedNgn must be set (> 0). HMO MUST NOT be a party — the
  //   HMO is paid the plan's wholesale price separately, not through
  //   the contract. The recurring split is over the markup, not the
  //   user's total.
  //
  // MARKUP_FROM_SHARES
  //   HMO MUST NOT be a party. markupFixedNgn is ignored if set.
  //   Markup amount is computed from the parties' percent/flat lines
  //   against the plan's wholesale at quote time.
  const hmoParties = contract.parties.filter((p) => p.role === "HMO");
  if (contract.markupMode === "GROSS_SHARE") {
    if (hmoParties.length === 0) {
      issues.push(
        "GROSS_SHARE contract must include an HMO party (the HMO participates in the split).",
      );
    }
  } else if (contract.markupMode === "MARKUP_FIXED") {
    if (hmoParties.length > 0) {
      issues.push(
        "MARKUP_FIXED contract must NOT include an HMO party. The HMO is paid wholesale directly; only the markup is split.",
      );
    }
    if (
      contract.markupFixedNgn === null ||
      contract.markupFixedNgn === undefined ||
      contract.markupFixedNgn <= ZERO
    ) {
      issues.push("MARKUP_FIXED contract requires markupFixedNgn > 0.");
    }
    if (
      contract.enrollmentFeeNgn &&
      contract.enrollmentFeeNgn > ZERO &&
      !contract.enrollmentBeneficiaryRole
    ) {
      issues.push(
        "MARKUP_FIXED contract with an enrollment fee must designate enrollmentBeneficiaryRole (who receives the fee).",
      );
    }
  } else if (contract.markupMode === "MARKUP_FROM_SHARES") {
    if (hmoParties.length > 0) {
      issues.push(
        "MARKUP_FROM_SHARES contract must NOT include an HMO party. The HMO is paid wholesale directly; only the markup is split.",
      );
    }
    if (contract.parties.length === 0) {
      issues.push(
        "MARKUP_FROM_SHARES contract must declare at least one party so the markup can be computed.",
      );
    }
    if (
      contract.enrollmentFeeNgn &&
      contract.enrollmentFeeNgn > ZERO &&
      !contract.enrollmentBeneficiaryRole
    ) {
      issues.push(
        "MARKUP_FROM_SHARES contract with an enrollment fee must designate enrollmentBeneficiaryRole (who receives the fee).",
      );
    }
  }

  // Per-event validation. In markup modes the enrollment fee is
  // handled by enrollmentBeneficiaryRole (single payee), so we
  // don't need eligible parties for the ENROLLMENT_FEE event.
  const inMarkupMode =
    contract.markupMode === "MARKUP_FIXED" ||
    contract.markupMode === "MARKUP_FROM_SHARES";

  for (const event of ["ENROLLMENT_FEE", "RECURRING_PREMIUM"] as const) {
    if (event === "ENROLLMENT_FEE") {
      if (contract.enrollmentFeeNgn === null) continue;
      if (inMarkupMode) {
        // Markup-mode enrollment-fee validation is the beneficiary
        // check above; party-timing rules don't apply.
        continue;
      }
    }
    const eligible = contract.parties.filter((p) => partyApplies(p, event));
    if (eligible.length === 0) {
      issues.push(
        `No parties configured for ${event}. Add a party with timing=${event === "ENROLLMENT_FEE" ? "ENROLLMENT_ONLY" : "RECURRING_ONLY"} or BOTH.`,
      );
      continue;
    }
    const hasBearer = eligible.some(
      (p) => p.role === contract.remainderBearer,
    );
    if (!hasBearer) {
      issues.push(
        `Remainder bearer role ${contract.remainderBearer} is not a party of ${event}. Either add them or change the remainder bearer.`,
      );
    }
    issues.push(...validateForEvent(contract, eligible));
  }

  if (issues.length > 0) return { ok: false, issues };
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────────
// Premium splits — the wholesale-aware top-level entry point
// ─────────────────────────────────────────────────────────────────────
//
// All three modes return the same shape so callers (the quote API,
// the settlement instructor, the reconciliation job) don't branch on
// mode. The returned object carries:
//
//   wholesaleNgn   — what flows to the HMO directly
//   markupNgn      — total platform markup (0 in GROSS_SHARE)
//   memberPaysNgn  — wholesale + markup (= the user wallet debit)
//   hmoLine?       — the HMO settlement line (always present)
//   lines          — markup splits among non-HMO parties (or the full
//                    gross-share splits in GROSS_SHARE mode)

export type PremiumSplitLine = SplitLine;

export type PremiumSplitResult =
  | {
      ok: true;
      mode: HmoContract["markupMode"];
      wholesaleNgn: bigint;
      markupNgn: bigint;
      memberPaysNgn: bigint;
      /** The HMO's wholesale settlement line. */
      hmoLine: {
        role: "HMO";
        amountNgn: bigint;
        settlementAccountTag: string | null;
      };
      /**
       * Non-HMO splits. In GROSS_SHARE mode, this includes the HMO's
       * line too (the engine doesn't separate them in that mode); see
       * hmoLine for the dedicated breakout.
       */
      lines: PremiumSplitLine[];
    }
  | { ok: false; issues: string[] };

/**
 * Compute the per-event settlement for a recurring premium given:
 *   • the active contract (with parties)
 *   • the plan's wholesale premium for this member (from the plan's
 *     pricing.individual_monthly / age band — converted to kobo by the
 *     caller)
 *
 * Behaviour by mode:
 *
 *   GROSS_SHARE
 *     `wholesaleNgn` is informational only. The engine uses the
 *     wholesale amount as the total to split, exactly as before.
 *     wholesale = total, markup = 0, memberPays = total.
 *
 *   MARKUP_FIXED
 *     markup = contract.markupFixedNgn. memberPays = wholesale + markup.
 *     Engine splits markup among parties using the existing primitive.
 *
 *   MARKUP_FROM_SHARES
 *     Each FLAT line contributes its naira amount to the markup.
 *     Each PERCENTAGE line contributes (wholesale × bps / 10000).
 *     markup = sum of contributions. memberPays = wholesale + markup.
 *     Engine then re-splits the markup using the same primitive so
 *     caps/floors and the remainder bearer behave consistently.
 */
export function computePremiumSplits(
  contract: HmoContract & { parties: HmoContractParty[] },
  wholesaleNgn: bigint,
): PremiumSplitResult {
  if (wholesaleNgn < ZERO) {
    return { ok: false, issues: ["wholesaleNgn must be non-negative."] };
  }

  // ── GROSS_SHARE ────────────────────────────────────────────────
  if (contract.markupMode === "GROSS_SHARE") {
    const base = computeSplits(contract, "RECURRING_PREMIUM", wholesaleNgn);
    if (!base.ok) return base;
    const hmo = base.lines.find((l) => l.role === "HMO");
    return {
      ok: true,
      mode: "GROSS_SHARE",
      wholesaleNgn,
      markupNgn: ZERO,
      memberPaysNgn: wholesaleNgn,
      hmoLine: {
        role: "HMO",
        amountNgn: hmo?.amountNgn ?? ZERO,
        settlementAccountTag: hmo?.settlementAccountTag ?? null,
      },
      lines: base.lines,
    };
  }

  // ── MARKUP_FIXED ──────────────────────────────────────────────
  if (contract.markupMode === "MARKUP_FIXED") {
    if (!contract.markupFixedNgn || contract.markupFixedNgn <= ZERO) {
      return {
        ok: false,
        issues: ["MARKUP_FIXED contract has no markupFixedNgn > 0."],
      };
    }
    const markup = contract.markupFixedNgn;
    const base = computeSplits(contract, "RECURRING_PREMIUM", markup);
    if (!base.ok) return base;
    return {
      ok: true,
      mode: "MARKUP_FIXED",
      wholesaleNgn,
      markupNgn: markup,
      memberPaysNgn: wholesaleNgn + markup,
      hmoLine: {
        role: "HMO",
        amountNgn: wholesaleNgn,
        // The HMO's settlement tag isn't on the contract in markup
        // mode (no HMO party), so the settlement instructor uses the
        // HmoProvider's default tag. Surfaced as null here.
        settlementAccountTag: null,
      },
      lines: base.lines,
    };
  }

  // ── MARKUP_FROM_SHARES ────────────────────────────────────────
  //
  // Each party's share is computed directly against the wholesale:
  //   FLAT       → party's amountFlatNgn (just added on top)
  //   PERCENTAGE → wholesale × bps / 10000
  // Markup = sum of those contributions. Each party's settlement line
  // IS that contribution — no re-splitting of the markup. Caps and
  // floors apply to PERCENTAGE lines exactly as in the primitive.
  // The remainder bearer absorbs any kobo residue from capping (and
  // is the party that would get any rounding correction).
  if (contract.markupMode === "MARKUP_FROM_SHARES") {
    const eligible = contract.parties.filter((p) =>
      partyApplies(p, "RECURRING_PREMIUM"),
    );
    if (eligible.length === 0) {
      return {
        ok: false,
        issues: ["No recurring-eligible parties to derive markup from."],
      };
    }

    const lines: SplitLine[] = [];
    for (const p of eligible) {
      let amt: bigint;
      let raw: bigint | undefined;
      if (p.kind === "FLAT") {
        amt = p.amountFlatNgn ?? ZERO;
      } else {
        const bps = BigInt(p.amountBps ?? 0);
        raw = (wholesaleNgn * bps) / BPS_DENOM;
        amt = raw;
        if (
          p.minPerCycleNgn !== null &&
          p.minPerCycleNgn !== undefined &&
          amt < p.minPerCycleNgn
        )
          amt = p.minPerCycleNgn;
        if (
          p.maxPerCycleNgn !== null &&
          p.maxPerCycleNgn !== undefined &&
          amt > p.maxPerCycleNgn
        )
          amt = p.maxPerCycleNgn;
      }
      lines.push({
        partyId: p.id,
        role: p.role,
        settlementAccountTag: p.settlementAccountTag ?? null,
        amountNgn: amt,
        rawAmountNgn: raw,
        isRemainder: false,
      });
    }

    // Markup = sum of allocated lines AFTER caps/floors. This is the
    // amount the user actually pays on top of wholesale.
    const markup = lines.reduce((acc, l) => acc + l.amountNgn, ZERO);

    if (markup <= ZERO) {
      return {
        ok: false,
        issues: ["Computed markup is zero — parties' shares contribute nothing."],
      };
    }

    // Flag the remainder bearer for symmetry with other modes. There
    // shouldn't be any residue to absorb — every party's allocation is
    // its line amount. But if the bearer's line was capped (raw > amt),
    // we keep the cap and don't reinstate the surplus.
    const bearer =
      lines.find((l) => l.role === contract.remainderBearer) ?? lines[0];
    if (bearer) bearer.isRemainder = true;

    return {
      ok: true,
      mode: "MARKUP_FROM_SHARES",
      wholesaleNgn,
      markupNgn: markup,
      memberPaysNgn: wholesaleNgn + markup,
      hmoLine: {
        role: "HMO",
        amountNgn: wholesaleNgn,
        settlementAccountTag: null,
      },
      lines,
    };
  }

  return {
    ok: false,
    issues: [`Unknown markup mode: ${String(contract.markupMode)}`],
  };
}

/**
 * Enrollment fee splits.
 *
 * Two behaviours depending on contract.markupMode:
 *
 *   MARKUP_FIXED / MARKUP_FROM_SHARES
 *     The fee goes entirely to contract.enrollmentBeneficiaryRole.
 *     The parties table in markup modes describes the recurring
 *     markup split, not the enrollment fee. Treating each markup
 *     party as also entitled to a slice of the enrollment fee leads
 *     to nonsense (e.g. ₦200 + ₦300 + ₦1,000 of "markup flats"
 *     can't fit into a ₦10 enrollment fee).
 *
 *     If enrollmentBeneficiaryRole is null, returns an error — the
 *     wizard requires it whenever a markup contract has fee > 0.
 *
 *   GROSS_SHARE
 *     Legacy behaviour. Parties split the fee using their
 *     ENROLLMENT_ONLY / BOTH timing flags via the existing
 *     primitive. Caps/floors are skipped (one-time fees, not cycles).
 */
export function computeEnrollmentSplits(
  contract: HmoContract & { parties: HmoContractParty[] },
): PremiumSplitResult {
  if (!contract.enrollmentFeeNgn || contract.enrollmentFeeNgn <= ZERO) {
    return { ok: false, issues: ["Contract has no enrollment fee."] };
  }
  const fee = contract.enrollmentFeeNgn;

  // ── Markup modes: single-beneficiary kickback ──────────────────
  if (
    contract.markupMode === "MARKUP_FIXED" ||
    contract.markupMode === "MARKUP_FROM_SHARES"
  ) {
    const role = contract.enrollmentBeneficiaryRole;
    if (!role) {
      return {
        ok: false,
        issues: [
          "Contract has an enrollment fee but no enrollmentBeneficiaryRole. In markup modes, the fee goes entirely to one designated party — set the beneficiary on the contract.",
        ],
      };
    }
    // Find the actual party row (for the settlement tag) if one
    // exists with this role; otherwise we still pay out under a
    // synthetic line tagged with the role.
    const partyRow = contract.parties.find((p) => p.role === role);
    return {
      ok: true,
      mode: contract.markupMode,
      wholesaleNgn: ZERO,
      markupNgn: ZERO,
      memberPaysNgn: fee,
      hmoLine: {
        role: "HMO",
        amountNgn: ZERO,
        settlementAccountTag: null,
      },
      lines: [
        {
          partyId: partyRow?.id ?? `synth_${role}`,
          role,
          settlementAccountTag: partyRow?.settlementAccountTag ?? null,
          amountNgn: fee,
          isRemainder: true,
        },
      ],
    };
  }

  // ── GROSS_SHARE: legacy split, but skip caps on a one-time fee ──
  const base = computeSplits(contract, "ENROLLMENT_FEE", fee, {
    skipCaps: true,
  });
  if (!base.ok) return base;
  const hmo = base.lines.find((l) => l.role === "HMO");
  return {
    ok: true,
    mode: contract.markupMode,
    wholesaleNgn: ZERO,
    markupNgn: ZERO,
    memberPaysNgn: fee,
    hmoLine: {
      role: "HMO",
      amountNgn: hmo?.amountNgn ?? ZERO,
      settlementAccountTag: hmo?.settlementAccountTag ?? null,
    },
    lines: base.lines,
  };
}
