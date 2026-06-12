/**
 * Smoke tests for the personalisation engine.
 *
 * Pure function exercise — no DB, no engine state. Verifies that
 * each signal behaves as documented:
 *   1. Budget fit — exact match scores higher than 20% over.
 *   2. Age band — out-of-band plan scores lower than in-band.
 *   3. Dependents — FAMILY plan beats INDIVIDUAL when the user has dependents.
 *   4. Exclusion penalty — a user-declared condition the plan excludes
 *      lowers the composite score.
 *   5. Determinism — same inputs always produce the same score.
 *
 * Run: node --experimental-strip-types scripts/test-personalisation.ts
 */

import { scorePlan } from "../lib/insurance/personalisation.ts";

function fail(label: string, detail?: unknown): never {
  console.error(`FAIL ${label}`);
  if (detail !== undefined) console.error(detail);
  process.exit(1);
}

// ── A reference plan: Silver Plan ₦8,500/mo, individual, covers most ─

const silver = {
  id: "plan_silver",
  scope: "INDIVIDUAL",
  pricing: {
    individual_monthly: 850_000, // ₦8,500 in kobo
    age_bands: [
      { min_age: 18, max_age: 35, monthly: 850_000 },
      { min_age: 36, max_age: 50, monthly: 1_100_000 },
    ],
  },
  coverage: {
    outpatient: { covered: true, limit: 20_000_000 },
    inpatient: { covered: true, limit: 100_000_000 },
    maternity: { covered: true },
    dental: { covered: false },
    optical: { covered: true },
    emergency: { covered: true },
    telemedicine: { covered: true, unlimited: true },
  },
  exclusions: ["HIV/AIDS treatment", "Cosmetic surgery"],
};

const family = {
  ...silver,
  id: "plan_family",
  scope: "FAMILY",
  pricing: {
    ...silver.pricing,
    family_rate: 2_500_000, // ₦25,000
  },
};

// ── Test 1: Budget fit ─────────────────────────────────────────────

const inBudget = scorePlan(silver, {
  ageInYears: 28,
  monthlyBudgetNgn: BigInt(900_000), // ₦9,000 — covers ₦8,500
  state: "Lagos",
});
const overBudget = scorePlan(silver, {
  ageInYears: 28,
  monthlyBudgetNgn: BigInt(500_000), // ₦5,000 — well under ₦8,500
  state: "Lagos",
});

if (inBudget.score <= overBudget.score) {
  fail("Test 1: in-budget should score higher than over-budget", {
    inBudget,
    overBudget,
  });
}
console.log(
  `Test 1 — Budget fit: in-budget ${inBudget.score} > over-budget ${overBudget.score} OK`,
);

// Wholesale resolved from the right age band.
if (inBudget.wholesaleNgn !== BigInt(850_000)) {
  fail("Test 1: wholesale should be ₦8,500", inBudget.wholesaleNgn);
}

// ── Test 2: Age band ──────────────────────────────────────────────

const inBand = scorePlan(silver, {
  ageInYears: 28,
  monthlyBudgetNgn: BigInt(900_000),
});
const outOfBand = scorePlan(silver, {
  ageInYears: 70, // plan covers 18-50 only
  monthlyBudgetNgn: BigInt(900_000),
});
if (inBand.score <= outOfBand.score) {
  fail("Test 2: in-band age should score higher than out-of-band");
}
const hasAgeWarning = outOfBand.rationale.warnings.some((w) =>
  w.includes("age"),
);
if (!hasAgeWarning) {
  fail("Test 2: out-of-band should produce an age warning", outOfBand);
}
console.log(
  `Test 2 — Age band: in ${inBand.score} > out ${outOfBand.score} (with warning) OK`,
);

// ── Test 3: Dependents ────────────────────────────────────────────

const withDeps = scorePlan(family, {
  ageInYears: 28,
  dependents: 2,
  monthlyBudgetNgn: BigInt(3_000_000), // ₦30,000 — covers family rate
});
const withDepsButIndividual = scorePlan(silver, {
  ageInYears: 28,
  dependents: 2,
  monthlyBudgetNgn: BigInt(3_000_000),
});
if (withDeps.score <= withDepsButIndividual.score) {
  fail(
    "Test 3: FAMILY plan should beat INDIVIDUAL when user has dependents",
    { withDeps, withDepsButIndividual },
  );
}
console.log(
  `Test 3 — Dependents: FAMILY ${withDeps.score} > INDIVIDUAL ${withDepsButIndividual.score} OK`,
);

// ── Test 4: Exclusion penalty ─────────────────────────────────────

const withoutCondition = scorePlan(silver, {
  ageInYears: 28,
  monthlyBudgetNgn: BigInt(900_000),
});
const withExcludedCondition = scorePlan(silver, {
  ageInYears: 28,
  monthlyBudgetNgn: BigInt(900_000),
  conditions: ["HIV"], // plan excludes "HIV/AIDS treatment"
});
if (withExcludedCondition.score >= withoutCondition.score) {
  fail("Test 4: excluded condition should lower score", {
    withoutCondition,
    withExcludedCondition,
  });
}
const hasExclusionWarning = withExcludedCondition.rationale.warnings.some(
  (w) => w.toLowerCase().includes("excludes"),
);
if (!hasExclusionWarning) {
  fail("Test 4: should produce an exclusion warning");
}
console.log(
  `Test 4 — Exclusion penalty: without ${withoutCondition.score} > with ${withExcludedCondition.score} (with warning) OK`,
);

// ── Test 5: Determinism ───────────────────────────────────────────

const profile = {
  ageInYears: 28,
  dependents: 1,
  monthlyBudgetNgn: BigInt(900_000),
  state: "Lagos",
  conditions: ["asthma"],
};
const r1 = scorePlan(silver, profile);
const r2 = scorePlan(silver, profile);
if (r1.score !== r2.score) {
  fail("Test 5: scoring should be deterministic", { r1, r2 });
}
if (
  JSON.stringify(r1.rationale.signals) !==
  JSON.stringify(r2.rationale.signals)
) {
  fail("Test 5: signal breakdown should be deterministic", { r1, r2 });
}
console.log(`Test 5 — Determinism: identical inputs → identical score OK`);

// ── Sanity: print a full result ───────────────────────────────────

console.log("\n— Reference scoring (Silver plan, ideal user) —");
const ref = scorePlan(silver, {
  ageInYears: 28,
  dependents: 0,
  monthlyBudgetNgn: BigInt(1_000_000), // ₦10,000 budget
  state: "Lagos",
  lga: "Ikeja",
});
console.log(`  score:        ${ref.score}`);
console.log(`  wholesale:    ₦${(Number(ref.wholesaleNgn) / 100).toLocaleString()}`);
console.log(`  reasons:      ${ref.rationale.reasons.join(" | ")}`);
console.log(`  warnings:     ${ref.rationale.warnings.join(" | ") || "(none)"}`);
console.log(`  signal breakdown:`);
for (const [k, v] of Object.entries(ref.rationale.signals)) {
  console.log(`    ${k.padEnd(20)} ${v}`);
}

console.log("\nAll personalisation tests passed.");
