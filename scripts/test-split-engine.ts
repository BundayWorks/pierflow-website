/**
 * Smoke test for the split engine.
 *
 * Exercises:
 *   1. The Reliance example from the plan doc — ₦9,000 monthly, 4 parties,
 *      one with a min/max cap.
 *   2. The cap-binding case — ₦25,000 monthly, Pierflow's ₦1,000 cap hits.
 *      Residue must flow to the remainder bearer (HMO).
 *   3. Enrollment fee with flat-only parties.
 *   4. A malformed contract — sum > 100% — must be rejected, not silently
 *      mis-allocated.
 *
 * Run: node scripts/test-split-engine.mjs
 *
 * Uses a tiny stand-in for the Prisma types since this is a plain .mjs
 * runner and we don't want to drag the whole TypeScript build in.
 */

import {
  computeSplits,
  computePremiumSplits,
  computeEnrollmentSplits,
  validateContract,
} from "../lib/insurance/split-engine.ts";

function makeContract({
  remainderBearer = "HMO",
  enrollmentFeeNgn = null,
  enrollmentBeneficiaryRole = null,
  markupMode = "GROSS_SHARE",
  markupFixedNgn = null,
  parties,
}) {
  return {
    id: "ctr_test",
    providerId: "prov_test",
    version: 1,
    status: "ACTIVE",
    effectiveFrom: new Date(),
    effectiveTo: null,
    markupMode,
    markupFixedNgn,
    enrollmentFeeNgn,
    enrollmentBeneficiaryRole,
    remainderBearer,
    notes: null,
    metadata: null,
    createdAt: new Date(),
    createdByExternalId: null,
    updatedAt: new Date(),
    parties: parties.map((p, i) => ({
      id: `pty_${i}`,
      contractId: "ctr_test",
      displayName: null,
      partnerId: null,
      amountFlatNgn: null,
      amountBps: null,
      minPerCycleNgn: null,
      maxPerCycleNgn: null,
      settlementAccountTag: null,
      notes: null,
      createdAt: new Date(),
      ...p,
    })),
  };
}

const N = (n) => BigInt(n);

function assertOk(label, result) {
  if (!result.ok) {
    console.error(`FAIL ${label}:`, result.issues);
    process.exit(1);
  }
  return result;
}
function assertFail(label, result, mustContain) {
  if (result.ok) {
    console.error(`FAIL ${label}: expected failure but got success`);
    process.exit(1);
  }
  if (mustContain && !result.issues.some((i) => i.includes(mustContain))) {
    console.error(
      `FAIL ${label}: failure didn't mention "${mustContain}". Got:`,
      result.issues,
    );
    process.exit(1);
  }
  return result;
}
function eqBigInt(label, actual, expected) {
  if (actual !== BigInt(expected)) {
    console.error(`FAIL ${label}: expected ${expected}, got ${actual}`);
    process.exit(1);
  }
}

// ── Test 1: Reliance recurring premium, normal case ─────────────────
const reliance = makeContract({
  remainderBearer: "HMO",
  enrollmentFeeNgn: N(1000_00),
  parties: [
    {
      role: "HMO",
      kind: "PERCENTAGE",
      timing: "RECURRING_ONLY",
      amountBps: 8200, // 82%
    },
    {
      role: "PIERFLOW",
      kind: "PERCENTAGE",
      timing: "RECURRING_ONLY",
      amountBps: 600, // 6%
      minPerCycleNgn: N(100_00),
      maxPerCycleNgn: N(1000_00),
    },
    {
      role: "EMR_VENDOR",
      kind: "PERCENTAGE",
      timing: "RECURRING_ONLY",
      amountBps: 300, // 3%
    },
    {
      role: "FINTECH",
      kind: "PERCENTAGE",
      timing: "RECURRING_ONLY",
      amountBps: 900, // 9%
    },
  ],
});

const r1 = assertOk(
  "Reliance ₦9,000 normal",
  computeSplits(reliance, "RECURRING_PREMIUM", N(9000_00)),
);
console.log("Test 1 — Reliance ₦9,000 monthly premium:");
for (const l of r1.lines) {
  console.log(
    `  ${l.role.padEnd(12)} ${(Number(l.amountNgn) / 100).toFixed(2)}${l.isRemainder ? "  (remainder)" : ""}`,
  );
}
const t1Sum = r1.lines.reduce((a, l) => a + l.amountNgn, BigInt(0));
eqBigInt("Test 1 sum", t1Sum, 9000_00);
// HMO is remainder bearer; 82% of 9000_00 = 7380_00; no residue because
// 82+6+3+9 = 100% and Pierflow's 6% = 540_00 fits within [100, 1000].
eqBigInt(
  "Test 1 HMO",
  r1.lines.find((l) => l.role === "HMO").amountNgn,
  7380_00,
);
eqBigInt(
  "Test 1 Pierflow",
  r1.lines.find((l) => l.role === "PIERFLOW").amountNgn,
  540_00,
);

// ── Test 2: Reliance recurring, Pierflow cap binds ──────────────────
const r2 = assertOk(
  "Reliance ₦25,000 with cap",
  computeSplits(reliance, "RECURRING_PREMIUM", N(25000_00)),
);
console.log("\nTest 2 — Reliance ₦25,000 monthly premium (Pierflow cap hits):");
for (const l of r2.lines) {
  console.log(
    `  ${l.role.padEnd(12)} ${(Number(l.amountNgn) / 100).toFixed(2)}${l.isRemainder ? "  (remainder)" : ""}${l.rawAmountNgn && l.rawAmountNgn !== l.amountNgn ? `  [raw ${(Number(l.rawAmountNgn) / 100).toFixed(2)}]` : ""}`,
  );
}
const t2Sum = r2.lines.reduce((a, l) => a + l.amountNgn, BigInt(0));
eqBigInt("Test 2 sum", t2Sum, 25000_00);
// Pierflow ideal 6% of 25000_00 = 1500_00 but cap is 1000_00 → 1000_00.
// Surplus 500_00 goes to HMO (remainder bearer).
// HMO ideal = 82% = 20500_00, +500_00 surplus = 21000_00.
eqBigInt(
  "Test 2 Pierflow (capped)",
  r2.lines.find((l) => l.role === "PIERFLOW").amountNgn,
  1000_00,
);
eqBigInt(
  "Test 2 HMO (remainder absorbs surplus)",
  r2.lines.find((l) => l.role === "HMO").amountNgn,
  21000_00,
);

// ── Test 3: Enrollment fee — flat lines only ────────────────────────
const enrollmentOnly = makeContract({
  remainderBearer: "HMO",
  enrollmentFeeNgn: N(1000_00),
  parties: [
    {
      role: "PIERFLOW",
      kind: "FLAT",
      timing: "ENROLLMENT_ONLY",
      amountFlatNgn: N(200_00),
    },
    {
      role: "EMR_VENDOR",
      kind: "FLAT",
      timing: "ENROLLMENT_ONLY",
      amountFlatNgn: N(300_00),
    },
    {
      role: "FINTECH",
      kind: "FLAT",
      timing: "ENROLLMENT_ONLY",
      amountFlatNgn: N(500_00),
    },
    {
      role: "HMO",
      kind: "FLAT",
      timing: "ENROLLMENT_ONLY",
      amountFlatNgn: N(0),
    },
  ],
});
const r3 = assertOk(
  "Enrollment fee split",
  computeSplits(enrollmentOnly, "ENROLLMENT_FEE", N(1000_00)),
);
console.log("\nTest 3 — Enrollment fee ₦1,000 split:");
for (const l of r3.lines) {
  console.log(
    `  ${l.role.padEnd(12)} ${(Number(l.amountNgn) / 100).toFixed(2)}${l.isRemainder ? "  (remainder)" : ""}`,
  );
}
const t3Sum = r3.lines.reduce((a, l) => a + l.amountNgn, BigInt(0));
eqBigInt("Test 3 sum", t3Sum, 1000_00);

// ── Test 4: Malformed contract — percentages sum > 100% ─────────────
const broken = makeContract({
  remainderBearer: "HMO",
  parties: [
    {
      role: "HMO",
      kind: "PERCENTAGE",
      timing: "RECURRING_ONLY",
      amountBps: 9000,
    },
    {
      role: "PIERFLOW",
      kind: "PERCENTAGE",
      timing: "RECURRING_ONLY",
      amountBps: 2000,
    },
  ],
});
assertFail(
  "Over-100% contract rejected",
  computeSplits(broken, "RECURRING_PREMIUM", N(9000_00)),
  "must be <= 100%",
);
console.log("\nTest 4 — Over-100% contract correctly rejected");

// ── Test 5: validateContract surfaces same issues statically ────────
const v = validateContract(broken);
if (v.ok) {
  console.error("FAIL validateContract: should have flagged over-100% contract");
  process.exit(1);
}
console.log("Test 5 — validateContract caught it:", v.issues[0]);

// ── Test 6: MARKUP_FIXED — wholesale flows direct to HMO ───────────
const markupFixed = makeContract({
  markupMode: "MARKUP_FIXED",
  markupFixedNgn: N(1500_00), // ₦1,500 markup
  remainderBearer: "FINTECH",
  parties: [
    {
      role: "PIERFLOW",
      kind: "FLAT",
      timing: "RECURRING_ONLY",
      amountFlatNgn: N(200_00),
    },
    {
      role: "EMR_VENDOR",
      kind: "FLAT",
      timing: "RECURRING_ONLY",
      amountFlatNgn: N(300_00),
    },
    {
      role: "FINTECH",
      kind: "FLAT",
      timing: "RECURRING_ONLY",
      amountFlatNgn: N(1000_00),
    },
  ],
});

// Plan wholesale: ₦8,500. Markup: ₦1,500. Member pays: ₦10,000.
const r6 = computePremiumSplits(markupFixed, N(8500_00));
if (!r6.ok) {
  console.error("FAIL MARKUP_FIXED:", r6.issues);
  process.exit(1);
}
console.log("\nTest 6 — MARKUP_FIXED: HMO wholesale ₦8,500 + ₦1,500 markup = member pays ₦10,000");
console.log(`  wholesale_ngn:    ${(Number(r6.wholesaleNgn) / 100).toFixed(2)}`);
console.log(`  markup_ngn:       ${(Number(r6.markupNgn) / 100).toFixed(2)}`);
console.log(`  member_pays_ngn:  ${(Number(r6.memberPaysNgn) / 100).toFixed(2)}`);
console.log(`  HMO line:         ${(Number(r6.hmoLine.amountNgn) / 100).toFixed(2)}`);
for (const l of r6.lines) {
  console.log(
    `  ${l.role.padEnd(12)} ${(Number(l.amountNgn) / 100).toFixed(2)}${l.isRemainder ? "  (remainder)" : ""}`,
  );
}
if (r6.wholesaleNgn !== N(8500_00)) {
  console.error("FAIL wholesale", r6.wholesaleNgn);
  process.exit(1);
}
if (r6.markupNgn !== N(1500_00)) {
  console.error("FAIL markup", r6.markupNgn);
  process.exit(1);
}
if (r6.memberPaysNgn !== N(10000_00)) {
  console.error("FAIL member pays", r6.memberPaysNgn);
  process.exit(1);
}
if (r6.hmoLine.amountNgn !== N(8500_00)) {
  console.error("FAIL HMO line", r6.hmoLine.amountNgn);
  process.exit(1);
}
// Sum of non-HMO lines should equal markup
const sum6 = r6.lines.reduce((a, l) => a + l.amountNgn, BigInt(0));
if (sum6 !== r6.markupNgn) {
  console.error("FAIL markup splits don't sum to markup", sum6);
  process.exit(1);
}

// ── Test 7: MARKUP_FIXED rejects an HMO party ──────────────────────
const markupWithHmo = makeContract({
  markupMode: "MARKUP_FIXED",
  markupFixedNgn: N(1500_00),
  remainderBearer: "FINTECH",
  parties: [
    {
      role: "HMO",
      kind: "PERCENTAGE",
      timing: "RECURRING_ONLY",
      amountBps: 8200,
    },
    {
      role: "FINTECH",
      kind: "PERCENTAGE",
      timing: "RECURRING_ONLY",
      amountBps: 1800,
    },
  ],
});
const v7 = validateContract(markupWithHmo);
if (v7.ok) {
  console.error("FAIL: MARKUP_FIXED with HMO party should be rejected");
  process.exit(1);
}
console.log("\nTest 7 — MARKUP_FIXED rejects HMO party:");
console.log(`         ${v7.issues.find((i) => i.includes("MARKUP_FIXED"))}`);

// ── Test 8: MARKUP_FROM_SHARES — markup derived from wholesale ────
const markupFromShares = makeContract({
  markupMode: "MARKUP_FROM_SHARES",
  remainderBearer: "FINTECH",
  parties: [
    {
      role: "PIERFLOW",
      kind: "PERCENTAGE",
      timing: "RECURRING_ONLY",
      amountBps: 300, // 3% of wholesale
    },
    {
      role: "EMR_VENDOR",
      kind: "PERCENTAGE",
      timing: "RECURRING_ONLY",
      amountBps: 200, // 2% of wholesale
    },
    {
      role: "FINTECH",
      kind: "PERCENTAGE",
      timing: "RECURRING_ONLY",
      amountBps: 1200, // 12% of wholesale
    },
  ],
});

// Wholesale ₦8,500. Each party's % of wholesale:
//   Pierflow   3% = ₦255
//   EMR vendor 2% = ₦170
//   Fintech   12% = ₦1,020
// Markup = ₦255 + ₦170 + ₦1,020 = ₦1,445.
// Member pays ₦8,500 + ₦1,445 = ₦9,945.
const r8 = computePremiumSplits(markupFromShares, N(8500_00));
if (!r8.ok) {
  console.error("FAIL MARKUP_FROM_SHARES:", r8.issues);
  process.exit(1);
}
console.log("\nTest 8 — MARKUP_FROM_SHARES: parties' shares OF wholesale");
console.log(`  wholesale_ngn:    ${(Number(r8.wholesaleNgn) / 100).toFixed(2)}`);
console.log(`  markup_ngn:       ${(Number(r8.markupNgn) / 100).toFixed(2)}`);
console.log(`  member_pays_ngn:  ${(Number(r8.memberPaysNgn) / 100).toFixed(2)}`);
console.log(`  HMO line:         ${(Number(r8.hmoLine.amountNgn) / 100).toFixed(2)}`);
for (const l of r8.lines) {
  console.log(
    `  ${l.role.padEnd(12)} ${(Number(l.amountNgn) / 100).toFixed(2)}${l.isRemainder ? "  (remainder)" : ""}`,
  );
}
if (r8.markupNgn !== N(1445_00)) {
  console.error("FAIL markup", r8.markupNgn);
  process.exit(1);
}
if (r8.memberPaysNgn !== N(9945_00)) {
  console.error("FAIL member pays", r8.memberPaysNgn);
  process.exit(1);
}
const pierflowLine = r8.lines.find((l) => l.role === "PIERFLOW");
if (pierflowLine?.amountNgn !== N(255_00)) {
  console.error("FAIL Pierflow line — expected ₦255", pierflowLine?.amountNgn);
  process.exit(1);
}
const fintechLine = r8.lines.find((l) => l.role === "FINTECH");
if (fintechLine?.amountNgn !== N(1020_00)) {
  console.error("FAIL Fintech line — expected ₦1,020", fintechLine?.amountNgn);
  process.exit(1);
}
const sum8 = r8.lines.reduce((a, l) => a + l.amountNgn, BigInt(0));
if (sum8 !== r8.markupNgn) {
  console.error("FAIL markup splits don't sum to markup", sum8);
  process.exit(1);
}

// ── Test 9: GROSS_SHARE unchanged via new entry point ──────────────
const r9 = computePremiumSplits(reliance, N(9000_00));
if (!r9.ok) {
  console.error("FAIL GROSS_SHARE via new path:", r9.issues);
  process.exit(1);
}
if (r9.wholesaleNgn !== N(9000_00) || r9.markupNgn !== BigInt(0)) {
  console.error("FAIL GROSS_SHARE shape", r9);
  process.exit(1);
}
if (r9.hmoLine.amountNgn !== N(7380_00)) {
  console.error("FAIL GROSS_SHARE HMO line", r9.hmoLine.amountNgn);
  process.exit(1);
}
console.log("\nTest 9 — GROSS_SHARE via computePremiumSplits still produces v1 output:");
console.log(`  HMO settled: ${(Number(r9.hmoLine.amountNgn) / 100).toFixed(2)} (₦7,380)`);

// ── Test 10: Markup mode enrollment fee → single beneficiary ────────
// Reproduces the bug from the screenshot. ₦10 fee, markup parties have
// flat ₦200 + ₦300 + ₦1,000 lines — the OLD engine would error with
// "flat fees exceed total". The NEW engine routes the fee entirely to
// the designated beneficiary; markup parties are not consulted.
const markupWithFee = makeContract({
  markupMode: "MARKUP_FIXED",
  markupFixedNgn: N(1500_00),
  enrollmentFeeNgn: N(10_00),
  enrollmentBeneficiaryRole: "FINTECH",
  remainderBearer: "FINTECH",
  parties: [
    {
      role: "PIERFLOW",
      kind: "FLAT",
      timing: "RECURRING_ONLY",
      amountFlatNgn: N(200_00),
    },
    {
      role: "EMR_VENDOR",
      kind: "FLAT",
      timing: "RECURRING_ONLY",
      amountFlatNgn: N(300_00),
    },
    {
      role: "FINTECH",
      kind: "FLAT",
      timing: "RECURRING_ONLY",
      amountFlatNgn: N(1000_00),
    },
  ],
});
const r10 = computeEnrollmentSplits(markupWithFee);
if (!r10.ok) {
  console.error("FAIL markup enrollment fee:", r10.issues);
  process.exit(1);
}
if (r10.memberPaysNgn !== N(10_00)) {
  console.error("FAIL markup enrollment total", r10.memberPaysNgn);
  process.exit(1);
}
if (r10.lines.length !== 1 || r10.lines[0].role !== "FINTECH") {
  console.error("FAIL expected single FINTECH line", r10.lines);
  process.exit(1);
}
if (r10.lines[0].amountNgn !== N(10_00)) {
  console.error("FAIL FINTECH amount", r10.lines[0].amountNgn);
  process.exit(1);
}
console.log(
  "\nTest 10 — Markup mode ₦10 enrollment fee → FINTECH ₦10 (no flat-fee conflict)",
);

// ── Test 11: Markup mode enrollment fee with no beneficiary fails ──
const markupNoBeneficiary = makeContract({
  markupMode: "MARKUP_FIXED",
  markupFixedNgn: N(1500_00),
  enrollmentFeeNgn: N(500_00),
  // No enrollmentBeneficiaryRole
  remainderBearer: "FINTECH",
  parties: [
    {
      role: "FINTECH",
      kind: "FLAT",
      timing: "RECURRING_ONLY",
      amountFlatNgn: N(1500_00),
    },
  ],
});
const r11 = computeEnrollmentSplits(markupNoBeneficiary);
if (r11.ok) {
  console.error("FAIL: should have rejected missing beneficiary");
  process.exit(1);
}
console.log("Test 11 — Missing beneficiary in markup mode correctly fails:");
console.log(`         ${r11.issues[0]}`);

// ── Test 12: Caps skipped on enrollment-fee event ──────────────────
// Reproduces the second screenshot bug: gross-share contract with a
// Pierflow min ₦100 cap, enrollment fee ₦10 → without skipCaps the
// cap fires and the math goes nonsensical. With skipCaps, all three
// recurring-only-percent parties get their honest share of ₦10.
const grossWithCaps = makeContract({
  remainderBearer: "HMO",
  enrollmentFeeNgn: N(10_00),
  parties: [
    {
      role: "HMO",
      kind: "PERCENTAGE",
      timing: "BOTH",
      amountBps: 8200,
    },
    {
      role: "PIERFLOW",
      kind: "PERCENTAGE",
      timing: "BOTH",
      amountBps: 600,
      minPerCycleNgn: N(100_00), // ₦100 floor — should be ignored
      maxPerCycleNgn: N(1000_00),
    },
    {
      role: "EMR_VENDOR",
      kind: "PERCENTAGE",
      timing: "BOTH",
      amountBps: 300,
    },
    {
      role: "FINTECH",
      kind: "PERCENTAGE",
      timing: "BOTH",
      amountBps: 900,
    },
  ],
});
const r12 = computeEnrollmentSplits(grossWithCaps);
if (!r12.ok) {
  console.error("FAIL gross-share enrollment with caps skipped:", r12.issues);
  process.exit(1);
}
if (r12.memberPaysNgn !== N(10_00)) {
  console.error("FAIL gross enrollment total", r12.memberPaysNgn);
  process.exit(1);
}
const pflowLine = r12.lines.find((l) => l.role === "PIERFLOW");
// 6% of ₦10 = ₦0.60 (60 kobo). With caps disabled, Pierflow gets 60 kobo,
// NOT the ₦100 floor.
if (!pflowLine || pflowLine.amountNgn !== N(60)) {
  console.error(
    `FAIL Pierflow should get 60 kobo (6% of 1000), got ${pflowLine?.amountNgn}`,
  );
  process.exit(1);
}
console.log(
  "\nTest 12 — Gross-share enrollment fee bypasses caps (Pierflow 60 kobo, not floored to ₦100)",
);

console.log("\nAll tests passed.");
