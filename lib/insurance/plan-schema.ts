/**
 * Universal Plan Schema — Pierflow's canonical shape for any HMO plan.
 *
 * Every HMO connector translates its native plan format into this shape
 * before the catalogue is written to the database. The fintech-facing
 * API serves objects built from these types, so a fintech engineer
 * never needs to know how any specific HMO models its products.
 *
 * Storage: the `coverage`, `pricing`, `waitingPeriods`, and `exclusions`
 * fields on `HmoPlan` are JSONB columns. Zod validates the shape at
 * every write boundary (catalogue push, single-plan upsert, change
 * notification). Reads also re-validate before returning to clients —
 * paranoid, but the cost of a malformed plan reaching a fintech is far
 * higher than the parse overhead.
 *
 * Money: NGN minor units (kobo) as BigInt at the persistence boundary;
 * Zod accepts plain numbers/strings on the wire and we coerce. Avoid
 * float arithmetic anywhere downstream.
 */

import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────
// Coverage
// ─────────────────────────────────────────────────────────────────────
//
// A named map of benefit categories. The keys are stable; new benefit
// categories can be added by extending this list without a database
// migration. Each value carries `covered` + optional limits / co-pay /
// waiting periods specific to that benefit.

const benefitItemSchema = z
  .object({
    covered: z.boolean(),
    // Annual limit in NGN minor units. Null / omitted = "covered, no
    // explicit cap" (the HMO's annual plan limit still applies).
    limit: z.coerce.number().int().nonnegative().nullish(),
    // Co-pay as 0–100 percent. Stored as percent for readability;
    // the engine converts to basis points internally if needed.
    co_pay_percent: z.coerce.number().min(0).max(100).nullish(),
    // Optional per-event / per-visit cap.
    per_visit_limit: z.coerce.number().int().nonnegative().nullish(),
    // Optional waiting period specific to this benefit (days).
    waiting_period_days: z.coerce.number().int().nonnegative().nullish(),
    // Optional "unlimited" flag for benefits like telemedicine.
    unlimited: z.boolean().optional(),
    notes: z.string().max(1000).nullish(),
  })
  .strict();

export const coverageSchema = z
  .object({
    outpatient: benefitItemSchema.optional(),
    inpatient: benefitItemSchema.optional(),
    maternity: benefitItemSchema.optional(),
    dental: benefitItemSchema.optional(),
    optical: benefitItemSchema.optional(),
    emergency: benefitItemSchema.optional(),
    telemedicine: benefitItemSchema.optional(),
    diagnostics: benefitItemSchema.optional(),
    pharmacy: benefitItemSchema.optional(),
    mental_health: benefitItemSchema.optional(),
    wellness: benefitItemSchema.optional(),
  })
  // Allow forward-compat extension benefits keyed under `extras`.
  .extend({
    extras: z.record(z.string(), benefitItemSchema).optional(),
  })
  .strict();

// ─────────────────────────────────────────────────────────────────────
// Pricing
// ─────────────────────────────────────────────────────────────────────

const ageBandSchema = z
  .object({
    min_age: z.coerce.number().int().min(0).max(120),
    max_age: z.coerce.number().int().min(0).max(120),
    monthly: z.coerce.number().int().nonnegative(), // minor units
  })
  .strict()
  .refine((b) => b.min_age <= b.max_age, {
    message: "min_age must be <= max_age",
  });

export const pricingSchema = z
  .object({
    // Fallback monthly premium when no age-band matches. Required.
    individual_monthly: z.coerce.number().int().nonnegative(),
    // Ordered low → high age bands. Engine picks the band whose range
    // contains the user's age; falls back to individual_monthly.
    age_bands: z.array(ageBandSchema).default([]),
    // Flat family rate (minor units). Optional.
    family_rate: z.coerce.number().int().nonnegative().nullish(),
    // Employer-channel discount as 0–100 percent. Applied at quote time
    // when the partner declares an employer_id.
    employer_discount_percent: z.coerce.number().min(0).max(100).nullish(),
  })
  .strict();

// ─────────────────────────────────────────────────────────────────────
// Waiting periods + exclusions
// ─────────────────────────────────────────────────────────────────────

export const waitingPeriodsSchema = z
  .object({
    general: z.coerce.number().int().nonnegative().nullish(),
    maternity: z.coerce.number().int().nonnegative().nullish(),
    pre_existing: z.coerce.number().int().nonnegative().nullish(),
  })
  .strict();

export const exclusionsSchema = z.array(z.string().min(1).max(300));

// ─────────────────────────────────────────────────────────────────────
// Full plan (the shape used at the API boundary)
// ─────────────────────────────────────────────────────────────────────
//
// The on-the-wire plan a connector POSTs. The route handler validates
// with this, then writes `coverage` / `pricing` / `waitingPeriods` /
// `exclusions` as JSONB on HmoPlan and the scalar fields as columns.

export const universalPlanSchema = z
  .object({
    // The connector's native id for this plan. Upsert key.
    external_id: z.string().trim().min(1).max(200),
    name: z.string().trim().min(1).max(200),
    scope: z
      .enum(["INDIVIDUAL", "FAMILY", "EMPLOYEE_GROUP", "STUDENT", "OTHER"])
      .default("INDIVIDUAL"),
    status: z.enum(["DRAFT", "ACTIVE", "WITHDRAWN"]).default("ACTIVE"),
    billing_frequency: z
      .enum(["MONTHLY", "QUARTERLY", "ANNUAL"])
      .default("MONTHLY"),

    coverage: coverageSchema,
    pricing: pricingSchema,
    waiting_periods: waitingPeriodsSchema.optional(),
    exclusions: exclusionsSchema.optional(),

    effective_from: z.string().datetime().optional(),
    effective_to: z.string().datetime().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export type UniversalPlan = z.infer<typeof universalPlanSchema>;
export type PlanCoverage = z.infer<typeof coverageSchema>;
export type PlanPricing = z.infer<typeof pricingSchema>;
export type PlanWaitingPeriods = z.infer<typeof waitingPeriodsSchema>;
export type PlanExclusions = z.infer<typeof exclusionsSchema>;

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────

/**
 * Resolve the monthly premium that applies to a specific user under a
 * plan. Walks the age bands in order; falls back to individual_monthly
 * if no band matches. All math in integer minor units — no floats.
 */
export function resolveMonthlyPremiumNgn(
  pricing: PlanPricing,
  age: number,
): number {
  for (const band of pricing.age_bands) {
    if (age >= band.min_age && age <= band.max_age) {
      return band.monthly;
    }
  }
  return pricing.individual_monthly;
}

/**
 * Quick sanity check used by route handlers and the staff portal review
 * surface. Returns `{ ok: true }` or `{ ok: false, issues: string[] }`.
 *
 * Beyond Zod's shape validation we enforce a few cross-field rules:
 *   • At least one of `coverage` and `pricing` must declare something.
 *   • Age bands, if present, must not overlap.
 *   • Age bands, if present, must be ordered (min_age ascending).
 *
 * The route handler can show issues to the connector in the response
 * body; the review surface uses them to highlight rows for staff.
 */
export function validateUniversalPlan(
  raw: unknown,
):
  | { ok: true; plan: UniversalPlan }
  | { ok: false; issues: string[] } {
  const parsed = universalPlanSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map(
        (i) => `${i.path.join(".") || "(root)"}: ${i.message}`,
      ),
    };
  }
  const plan = parsed.data;
  const issues: string[] = [];

  const bands = plan.pricing.age_bands;
  for (let i = 1; i < bands.length; i++) {
    if (bands[i].min_age <= bands[i - 1].max_age) {
      issues.push(
        `pricing.age_bands: band ${i} overlaps band ${i - 1} (min_age ${bands[i].min_age} <= prev max_age ${bands[i - 1].max_age})`,
      );
    }
    if (bands[i].min_age < bands[i - 1].min_age) {
      issues.push(
        `pricing.age_bands: band ${i} is out of order (min_age ${bands[i].min_age} < prev min_age ${bands[i - 1].min_age})`,
      );
    }
  }

  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, plan };
}
