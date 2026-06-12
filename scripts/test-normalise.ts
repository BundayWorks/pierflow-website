/**
 * Smoke tests for the AI-assisted normaliser.
 *
 * Run: node --experimental-strip-types --env-file=.env.local scripts/test-normalise.ts
 *
 * Uses Node 24's --experimental-strip-types so we can import the
 * production TypeScript directly. The test references files via
 * explicit .ts paths because Node's strict ESM resolver wants
 * extensions; Next's bundler uses the same source files via the
 * extensionless imports written there.
 */

// Dynamic-import-by-URL so we can reach into the .ts files Node would
// otherwise refuse to resolve when the production source uses
// extensionless imports.
const lib = new URL("../lib/insurance/", import.meta.url);

const { applyMapping, getPath, proposeMapping } = (await import(
  new URL("normalise.ts", lib).href
)) as typeof import("../lib/insurance/normalise.ts");

type Template = Parameters<typeof applyMapping>[0];

function fail(label: string, detail?: unknown): never {
  console.error(`FAIL ${label}`);
  if (detail !== undefined) console.error(detail);
  process.exit(1);
}

// ── Part 1: getPath ──────────────────────────────────────────────────

const obj = {
  plan_id: "REL-SILVER-IND",
  pricing: { monthly_naira: 8500 },
  tiers: [
    { min_age: 0, max_age: 17, monthly_naira: 6000 },
    { min_age: 18, max_age: 35, monthly_naira: 8500 },
  ],
};

if (getPath(obj, "plan_id") !== "REL-SILVER-IND") fail("getPath: top-level string");
if (getPath(obj, "pricing.monthly_naira") !== 8500) fail("getPath: dotted path");
if (getPath(obj, "tiers[1].monthly_naira") !== 8500)
  fail("getPath: indexed array");
if (getPath(obj, "tiers[5]") !== undefined) fail("getPath: out-of-range index");
if (getPath(obj, "nonexistent.deep.path") !== undefined)
  fail("getPath: missing path");
console.log("Test 1 — getPath OK");

// ── Part 2: applyMapping over a native Reliance plan ─────────────────

const sample = {
  plan_id: "REL-SILVER-IND",
  name: "Silver Plan",
  scope_raw: "individual",
  monthly_premium_naira: 8500,
  annual_limit_naira: 1_500_000,
  outpatient_limit_naira: 200_000,
  outpatient_copay_pct: 0,
  inpatient_limit_naira: 1_000_000,
  inpatient_copay_pct: 10,
  age_bands: [
    { lo: 0, hi: 17, monthly: 6000 },
    { lo: 18, hi: 35, monthly: 8500 },
    { lo: 36, hi: 50, monthly: 11000 },
    { lo: 51, hi: 65, monthly: 16000 },
  ],
  exclusions: ["HIV/AIDS treatment", "Cosmetic surgery", "Pre-existing conditions"],
};

const template: Template = {
  external_id: { jsonPath: "plan_id" },
  name: { jsonPath: "name" },
  scope: { jsonPath: "scope_raw", transform: "lowercase_enum" },
  status: { jsonPath: "missing", fallback: "ACTIVE" },
  billing_frequency: { jsonPath: "missing", fallback: "MONTHLY" },
  "coverage.outpatient.covered": { jsonPath: "missing", fallback: true },
  "coverage.outpatient.limit": {
    jsonPath: "outpatient_limit_naira",
    transform: "kobo_from_naira",
  },
  "coverage.outpatient.co_pay_percent": { jsonPath: "outpatient_copay_pct" },
  "coverage.inpatient.covered": { jsonPath: "missing", fallback: true },
  "coverage.inpatient.limit": {
    jsonPath: "inpatient_limit_naira",
    transform: "kobo_from_naira",
  },
  "coverage.inpatient.co_pay_percent": { jsonPath: "inpatient_copay_pct" },
  "pricing.individual_monthly": {
    jsonPath: "monthly_premium_naira",
    transform: "kobo_from_naira",
  },
  "pricing.age_bands": {
    each: {
      jsonPath: "age_bands",
      template: {
        min_age: { jsonPath: "lo" },
        max_age: { jsonPath: "hi" },
        monthly: { jsonPath: "monthly", transform: "kobo_from_naira" },
      },
    },
  },
  exclusions: { jsonPath: "exclusions" },
};

const result = applyMapping(template, sample);
if (!result.ok) fail("applyMapping happy path", result.issues);
const plan = result.plan;

if (plan.external_id !== "REL-SILVER-IND") fail("external_id mismatch", plan);
if (plan.name !== "Silver Plan") fail("name mismatch", plan);
if (plan.scope !== "INDIVIDUAL") fail("scope didn't normalise", plan.scope);
if (plan.pricing.individual_monthly !== 850_000)
  fail("kobo conversion wrong", plan.pricing.individual_monthly);
if (plan.pricing.age_bands.length !== 4)
  fail("age_bands length wrong", plan.pricing.age_bands);
if (plan.pricing.age_bands[1].monthly !== 850_000)
  fail("age band kobo wrong", plan.pricing.age_bands[1]);
if (plan.coverage.outpatient?.limit !== 20_000_000)
  fail("outpatient limit kobo wrong", plan.coverage.outpatient);
if (plan.exclusions?.length !== 3)
  fail("exclusions length wrong", plan.exclusions);
console.log("Test 2 — applyMapping Reliance plan OK");
console.log(
  `       pricing.individual_monthly = ${plan.pricing.individual_monthly} kobo`,
);
console.log(
  `       coverage.outpatient.limit  = ${plan.coverage.outpatient?.limit} kobo`,
);

// ── Part 3: kobo_from_string ─────────────────────────────────────────

const stringSample = {
  plan_id: "TEST-FAMILY",
  name: "Family Plan",
  scope: "FAMILY",
  premium_display: "₦ 25,000",
};
const stringTemplate: Template = {
  external_id: { jsonPath: "plan_id" },
  name: { jsonPath: "name" },
  scope: { jsonPath: "scope" },
  status: { jsonPath: "missing", fallback: "ACTIVE" },
  billing_frequency: { jsonPath: "missing", fallback: "MONTHLY" },
  "coverage.outpatient.covered": { jsonPath: "missing", fallback: true },
  "pricing.individual_monthly": {
    jsonPath: "premium_display",
    transform: "kobo_from_string",
  },
};
const stringResult = applyMapping(stringTemplate, stringSample);
if (!stringResult.ok)
  fail("kobo_from_string applyMapping", stringResult.issues);
if (stringResult.plan.pricing.individual_monthly !== 2_500_000)
  fail("₦ 25,000 → 2,500,000 kobo", stringResult.plan.pricing.individual_monthly);
console.log("Test 3 — kobo_from_string: ₦ 25,000 → 2,500,000 kobo OK");

// ── Part 4: malformed result rejected ────────────────────────────────

const broken: Template = {
  status: { jsonPath: "missing", fallback: "ACTIVE" },
};
const brokenResult = applyMapping(broken, {});
if (brokenResult.ok) fail("empty template should fail validation", brokenResult);
console.log("Test 4 — invalid mapping correctly returns issues:");
for (const i of brokenResult.issues.slice(0, 3)) console.log(`         ${i}`);

// ── Part 5: optional live Haiku ──────────────────────────────────────

if (!process.env.ANTHROPIC_API_KEY) {
  console.log("\nTest 5 — proposeMapping skipped (no ANTHROPIC_API_KEY)");
  console.log("\nAll non-network tests passed.");
  process.exit(0);
}

console.log("\nTest 5 — proposeMapping live call…");
try {
  const proposal = await proposeMapping({
    sample,
    providerName: "Reliance HMO (test)",
  });
  console.log(`  model:                ${proposal.diagnostics.model}`);
  console.log(`  input tokens:         ${proposal.diagnostics.inputTokens}`);
  console.log(`  output tokens:        ${proposal.diagnostics.outputTokens}`);
  console.log(
    `  avg confidence:       ${(proposal.averageConfidence * 100).toFixed(0)}%`,
  );
  console.log(`  low-confidence:       ${proposal.lowConfidencePaths.length} fields`);
  console.log(`  proposed name:        ${proposal.proposedPlan.name}`);
  console.log(`  proposed external_id: ${proposal.proposedPlan.external_id}`);
  console.log(
    `  proposed monthly:     ${proposal.proposedPlan.pricing.individual_monthly} kobo`,
  );
  if (proposal.notes) {
    console.log(
      `  notes: ${proposal.notes.slice(0, 240)}${proposal.notes.length > 240 ? "…" : ""}`,
    );
  }
} catch (e) {
  console.error("Live proposeMapping failed:", (e as Error).message);
  process.exit(1);
}
console.log("\nAll tests passed (including live Haiku).");
