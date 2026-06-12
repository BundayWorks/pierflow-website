"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import {
  createHmoProvider,
  setProviderStatus,
  updateProviderSettlement,
} from "@/lib/insurance/providers";
import { ingestPlans } from "@/lib/insurance/catalogue";

/* ── Inbox counters ───────────────────────────────────────────── */

export async function countHmoProvidersPending(): Promise<number> {
  return db.hmoProvider.count({ where: { status: "PENDING" } });
}

/* ── List + detail queries ────────────────────────────────────── */

export type HmoProviderListFilter = "PENDING" | "ACTIVE" | "SUSPENDED" | "ALL";

export async function listHmoProviders(filter?: { status?: HmoProviderListFilter }) {
  await requireStaff();
  const status = filter?.status ?? "ALL";
  const where = status === "ALL" ? {} : { status };
  return db.hmoProvider.findMany({
    where,
    orderBy: [{ status: "asc" }, { displayName: "asc" }],
    take: 200,
    select: {
      id: true,
      slug: true,
      displayName: true,
      status: true,
      registrationNo: true,
      contactEmail: true,
      websiteUrl: true,
      createdAt: true,
      organization: {
        select: { id: true, state: true, lga: true },
      },
      _count: { select: { plans: true, contracts: true } },
    },
  });
}

export async function getHmoProviderBySlug(slug: string) {
  await requireStaff();
  return db.hmoProvider.findUnique({
    where: { slug },
    include: {
      organization: true,
      _count: { select: { plans: true, contracts: true } },
    },
  });
}

export async function listPlansForProvider(providerId: string) {
  await requireStaff();
  return db.hmoPlan.findMany({
    where: { providerId },
    orderBy: [{ status: "asc" }, { name: "asc" }],
    take: 500,
    select: {
      id: true,
      externalId: true,
      name: true,
      scope: true,
      status: true,
      billingFrequency: true,
      lastSyncedAt: true,
      lastVerifiedAt: true,
      staleAfter: true,
      pricing: true,
    },
  });
}

/**
 * Full plan record for the staff detail page. Includes the JSONB
 * blobs (coverage, pricing, waiting periods, exclusions) so the page
 * can render the actual translated Universal Plan Schema.
 *
 * Joins the parent provider so the page can show "Reliance HMO →
 * Silver Plan" breadcrumbs without a second query, and pulls the most
 * recent freshness events so staff can audit the sync history.
 */
export async function getPlanDetail(providerSlug: string, planId: string) {
  await requireStaff();
  const plan = await db.hmoPlan.findUnique({
    where: { id: planId },
    select: {
      id: true,
      externalId: true,
      name: true,
      scope: true,
      status: true,
      billingFrequency: true,
      coverage: true,
      pricing: true,
      waitingPeriods: true,
      exclusions: true,
      effectiveFrom: true,
      effectiveTo: true,
      lastSyncedAt: true,
      lastVerifiedAt: true,
      staleAfter: true,
      createdAt: true,
      updatedAt: true,
      provider: {
        select: {
          id: true,
          slug: true,
          displayName: true,
          status: true,
        },
      },
      freshnessEvents: {
        orderBy: { occurredAt: "desc" },
        take: 10,
        select: {
          id: true,
          kind: true,
          changed: true,
          occurredAt: true,
        },
      },
    },
  });
  // Guard: the URL might point at a planId that's real but belongs to
  // a different provider. Treat that as not found rather than leaking
  // cross-provider data.
  if (!plan || plan.provider.slug !== providerSlug) return null;
  return plan;
}

/* ── Mutations ────────────────────────────────────────────────── */

const CreateInput = z.object({
  displayName: z.string().trim().min(1).max(120),
  slug: z
    .string()
    .trim()
    .min(3)
    .max(40)
    .regex(/^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/, {
      message:
        "Slug must be lowercase alphanumeric with optional dashes (3-40 chars).",
    }),
  registrationNo: z.string().trim().max(60).optional().or(z.literal("")),
  contactEmail: z
    .string()
    .trim()
    .email()
    .max(200)
    .optional()
    .or(z.literal("")),
  contactPhone: z.string().trim().max(40).optional().or(z.literal("")),
  websiteUrl: z.string().trim().url().max(300).optional().or(z.literal("")),
  state: z.string().trim().max(60).optional().or(z.literal("")),
  lga: z.string().trim().max(60).optional().or(z.literal("")),
});

export type CreateHmoProviderOutcome =
  | { ok: true; providerId: string; slug: string }
  | {
      ok: false;
      reason:
        | "VALIDATION_FAILED"
        | "SLUG_TAKEN"
        | "INVALID_SLUG"
        | "DISPLAY_NAME_REQUIRED";
      issues?: string[];
      detail?: string;
    };

export async function createHmoProviderAction(
  raw: unknown,
): Promise<CreateHmoProviderOutcome> {
  await requireStaff();
  const parsed = CreateInput.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      reason: "VALIDATION_FAILED",
      issues: parsed.error.issues.map(
        (i) => `${i.path.join(".") || "(root)"}: ${i.message}`,
      ),
    };
  }
  const v = parsed.data;

  const outcome = await createHmoProvider({
    displayName: v.displayName,
    slug: v.slug,
    registrationNo: v.registrationNo || null,
    contactEmail: v.contactEmail || null,
    contactPhone: v.contactPhone || null,
    websiteUrl: v.websiteUrl || null,
    state: v.state || null,
    lga: v.lga || null,
  });

  if (!outcome.ok) return outcome;

  revalidatePath("/portal/hmo-providers");
  return { ok: true, providerId: outcome.providerId, slug: outcome.slug };
}

export async function activateHmoProvider(providerId: string) {
  await requireStaff();
  const updated = await setProviderStatus(providerId, "ACTIVE");
  revalidatePath("/portal/hmo-providers");
  return updated;
}

export async function suspendHmoProvider(providerId: string) {
  await requireStaff();
  const updated = await setProviderStatus(providerId, "SUSPENDED");
  revalidatePath("/portal/hmo-providers");
  return updated;
}

const SettlementInput = z.object({
  providerId: z.string().min(1),
  slug: z.string().min(1),
  defaultSettlementMode: z
    .enum(["IN_FINTECH_ACCOUNT", "EXTERNAL_BANK_SWEEP"])
    .optional(),
  settlementBankName: z.string().trim().max(120).optional().or(z.literal("")),
  settlementBankAccount: z
    .string()
    .trim()
    .max(40)
    .optional()
    .or(z.literal("")),
  settlementBankCode: z.string().trim().max(10).optional().or(z.literal("")),
});

export async function updateSettlementAction(raw: unknown) {
  await requireStaff();
  const parsed = SettlementInput.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false as const,
      issues: parsed.error.issues.map(
        (i) => `${i.path.join(".") || "(root)"}: ${i.message}`,
      ),
    };
  }
  const v = parsed.data;
  await updateProviderSettlement(v.providerId, {
    defaultSettlementMode: v.defaultSettlementMode,
    settlementBankName: v.settlementBankName ?? undefined,
    settlementBankAccount: v.settlementBankAccount ?? undefined,
    settlementBankCode: v.settlementBankCode ?? undefined,
  });
  revalidatePath(`/portal/hmo-providers/${v.slug}`);
  return { ok: true as const };
}

/* ── Publish a sample plan ───────────────────────────────────────
 *
 * Staff-only convenience for testing + demos. Inserts one synthetic
 * Silver Plan via the same ingest path the EMR-vendor connector
 * uses (native format → active ConnectorMapping → HmoPlan rows). If
 * the provider has no active mapping yet, the call errors with a
 * clear message so staff can run the mapping wizard first.
 *
 * The provider's slug is used both to route the request and to make
 * each sample plan's external_id unique-per-provider, so re-running
 * is idempotent (the unique index on (providerId, externalId) makes
 * subsequent calls update in place rather than create duplicates).
 */
const PublishSampleInput = z.object({
  providerId: z.string().min(1),
  slug: z.string().min(1),
});

/**
 * Keys here mirror the wizard's EXAMPLE_SAMPLE in
 * app/portal/(app)/hmo-providers/[slug]/mapping/MappingWizardClient.tsx
 * — the one prefilled in the textarea when staff opens the mapping
 * wizard. That sample is what the AI proposes the mapping against,
 * so the saved template's JSONPaths look for these exact keys
 * (`plan_id`, `name`, `monthly_premium_naira`, `annual_limit_naira`,
 * etc.). Re-publishing the same shape exercises that translation.
 *
 * If you change the wizard's EXAMPLE_SAMPLE, change this constant
 * in lockstep. They are intentionally coupled.
 */
const SAMPLE_PLAN_NATIVE = {
  plan_id: "SAMPLE-SILVER-IND",
  name: "Silver Plan (sample)",
  scope: "individual",
  billing: "monthly",
  monthly_premium_naira: 8500,
  age_bands: [
    { min_age: 0, max_age: 17, monthly_naira: 6000 },
    { min_age: 18, max_age: 35, monthly_naira: 8500 },
    { min_age: 36, max_age: 50, monthly_naira: 11000 },
    { min_age: 51, max_age: 65, monthly_naira: 16000 },
  ],
  annual_limit_naira: 1500000,
  coverage: {
    outpatient: { covered: true, annual_limit_naira: 200000, co_pay_percent: 0 },
    inpatient: { covered: true, annual_limit_naira: 1000000, co_pay_percent: 10 },
    maternity: { covered: true, annual_limit_naira: 300000, waiting_period_days: 270 },
    dental: { covered: false },
    optical: { covered: true, annual_limit_naira: 30000 },
    emergency: { covered: true, annual_limit_naira: 500000 },
    telemedicine: { covered: true, unlimited: true },
  },
  exclusions: [
    "HIV/AIDS treatment",
    "Cosmetic surgery",
    "Pre-existing conditions",
  ],
  waiting_periods: { general_days: 30, maternity_days: 270, pre_existing_days: 365 },
};

export async function publishSamplePlanAction(raw: unknown) {
  await requireStaff();
  const parsed = PublishSampleInput.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false as const,
      reason: "VALIDATION_FAILED" as const,
      issues: parsed.error.issues.map(
        (i) => `${i.path.join(".") || "(root)"}: ${i.message}`,
      ),
    };
  }
  const result = await ingestPlans({
    providerId: parsed.data.providerId,
    plans: [SAMPLE_PLAN_NATIVE],
    format: "native",
    kind: "PARTIAL_UPDATE",
    staleAfterMs: 26 * 60 * 60 * 1000,
  });
  revalidatePath(`/portal/hmo-providers/${parsed.data.slug}`);
  const first = result.results[0];
  if (!first || !first.ok) {
    return {
      ok: false as const,
      reason: "INGEST_FAILED" as const,
      issues: first && !first.ok ? first.issues : ["No result returned."],
    };
  }
  return {
    ok: true as const,
    planId: first.planId,
    action: first.action,
  };
}
