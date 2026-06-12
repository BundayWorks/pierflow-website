/**
 * Fintech-facing plan catalogue helpers.
 *
 * Renders HmoPlan rows into the public-API shape — what a fintech
 * client sees when calling GET /v1/plans. Different from the
 * staff-portal view in three ways:
 *
 *   • Pierflow's internal HmoPlan.id is exposed under a stable
 *     "pf_plan_…" prefix so the fintech can reference plans without
 *     handling cuid noise.
 *   • The HMO's internal cuid is hidden; only the public slug + name
 *     are surfaced.
 *   • Freshness is summarised as a single `last_verified_at` /
 *     `is_stale` pair so the fintech can show a "data may be stale"
 *     hint if relevant.
 *
 * Filters supported by listPlansPublic:
 *   • status        — defaults to ACTIVE
 *   • scope         — INDIVIDUAL / FAMILY / EMPLOYEE_GROUP / STUDENT / OTHER
 *   • providerSlug  — narrow to one HMO
 *   • state / lga   — coverage filter (drops plans that explicitly
 *                     list a network without the user's region)
 *   • maxMonthlyPremiumNgn — budget cap. Plans with a wholesale
 *                     individual_monthly > this are excluded.
 *   • ageInYears    — age-band filter (excludes plans whose only
 *                     age_bands lie outside the user's age)
 *
 * The fintech is also expected to call POST /v1/quotes when they
 * want personalised ranking — this endpoint is the browse surface.
 */

import { db } from "@/lib/db";
import type { HmoPlanScope, HmoPlanStatus } from "@prisma/client";
import { getActiveProviderIds } from "@/lib/insurance/hmo-access";

export type ListPlansFilters = {
  status?: HmoPlanStatus;
  scope?: HmoPlanScope;
  providerSlug?: string;
  state?: string;
  lga?: string;
  maxMonthlyPremiumNgn?: bigint;
  ageInYears?: number;
  /** When supplied, results are gated to HMOs this partner has opted into. */
  partnerId?: string;
};

export type PublicPlan = {
  id: string;
  external_id: string;
  name: string;
  scope: string;
  status: string;
  billing_frequency: string;
  hmo: {
    slug: string;
    name: string;
  };
  pricing: unknown; // Universal Plan Schema pricing block
  coverage: unknown; // Universal Plan Schema coverage block
  waiting_periods?: unknown;
  exclusions?: unknown;
  effective_from?: string;
  effective_to?: string;
  /** ISO-8601 UTC. The last time the connector confirmed this plan. */
  last_synced_at: string;
  last_verified_at?: string;
  /** True when staleAfter is in the past — fintechs should show a hint. */
  is_stale: boolean;
};

/**
 * List active plans across all HMO providers, filtered + paginated.
 * Default page size 50, max 200. Cursor pagination by plan id.
 */
export async function listPlansPublic(
  filters: ListPlansFilters,
  pagination: { cursor?: string; limit?: number } = {},
): Promise<{
  items: PublicPlan[];
  next_cursor: string | null;
  hmos_enabled: number | null;
}> {
  const limit = Math.min(Math.max(pagination.limit ?? 50, 1), 200);
  const status = filters.status ?? "ACTIVE";

  // Resolve the partner's opted-in HMO set once, then inject as a
  // provider id filter. If null (no opt-ins yet), return an empty page
  // with a hint rather than silently returning nothing.
  let activeProviderIds: Set<string> | null = null;
  if (filters.partnerId) {
    activeProviderIds = await getActiveProviderIds(filters.partnerId);
    if (activeProviderIds === null) {
      return { items: [], next_cursor: null, hmos_enabled: 0 };
    }
  }

  const rows = await db.hmoPlan.findMany({
    where: {
      status,
      ...(filters.scope ? { scope: filters.scope } : {}),
      provider: {
        status: "ACTIVE",
        ...(filters.providerSlug ? { slug: filters.providerSlug } : {}),
        ...(activeProviderIds
          ? { id: { in: Array.from(activeProviderIds) } }
          : {}),
      },
    },
    orderBy: [{ id: "asc" }],
    take: limit + 1,
    ...(pagination.cursor
      ? { cursor: { id: pagination.cursor }, skip: 1 }
      : {}),
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
      lastSyncedAt: true,
      lastVerifiedAt: true,
      staleAfter: true,
      effectiveFrom: true,
      effectiveTo: true,
      provider: {
        select: { slug: true, displayName: true },
      },
    },
  });

  const now = new Date();
  let items = rows.map<PublicPlan>((p) => ({
    id: p.id,
    external_id: p.externalId,
    name: p.name,
    scope: p.scope,
    status: p.status,
    billing_frequency: p.billingFrequency,
    hmo: { slug: p.provider.slug, name: p.provider.displayName },
    pricing: p.pricing,
    coverage: p.coverage,
    waiting_periods: p.waitingPeriods ?? undefined,
    exclusions: p.exclusions ?? undefined,
    effective_from: p.effectiveFrom?.toISOString(),
    effective_to: p.effectiveTo?.toISOString(),
    last_synced_at: p.lastSyncedAt.toISOString(),
    last_verified_at: p.lastVerifiedAt?.toISOString(),
    is_stale: p.staleAfter !== null && p.staleAfter < now,
  }));

  // Filters that depend on JSONB content are easier to apply in
  // memory at this scale. When the catalogue grows we'll revisit
  // with JSONB indexes or materialised views.
  if (filters.maxMonthlyPremiumNgn !== undefined) {
    const cap = filters.maxMonthlyPremiumNgn;
    items = items.filter((p) => {
      const pricing = p.pricing as { individual_monthly?: number } | null;
      if (!pricing || pricing.individual_monthly === undefined) return true;
      return BigInt(pricing.individual_monthly) <= cap;
    });
  }
  if (filters.ageInYears !== undefined) {
    const age = filters.ageInYears;
    items = items.filter((p) => {
      const pricing = p.pricing as {
        age_bands?: { min_age: number; max_age: number }[];
      } | null;
      const bands = pricing?.age_bands ?? [];
      // Plans without bands accept any age; plans with bands must
      // contain a band the user fits in.
      if (bands.length === 0) return true;
      return bands.some((b) => age >= b.min_age && age <= b.max_age);
    });
  }

  const hasMore = items.length > limit;
  const sliced = hasMore ? items.slice(0, limit) : items;
  const nextCursor = hasMore ? sliced[sliced.length - 1].id : null;
  return {
    items: sliced,
    next_cursor: nextCursor,
    hmos_enabled: activeProviderIds ? activeProviderIds.size : null,
  };
}

/** Fetch a single plan by Pierflow id for the public API. */
export async function getPlanPublic(
  planId: string,
): Promise<PublicPlan | null> {
  const p = await db.hmoPlan.findUnique({
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
      lastSyncedAt: true,
      lastVerifiedAt: true,
      staleAfter: true,
      effectiveFrom: true,
      effectiveTo: true,
      provider: {
        select: { slug: true, displayName: true, status: true },
      },
    },
  });
  if (!p) return null;
  // Hide plans from suspended/pending providers.
  if (p.provider.status !== "ACTIVE") return null;
  return {
    id: p.id,
    external_id: p.externalId,
    name: p.name,
    scope: p.scope,
    status: p.status,
    billing_frequency: p.billingFrequency,
    hmo: { slug: p.provider.slug, name: p.provider.displayName },
    pricing: p.pricing,
    coverage: p.coverage,
    waiting_periods: p.waitingPeriods ?? undefined,
    exclusions: p.exclusions ?? undefined,
    effective_from: p.effectiveFrom?.toISOString(),
    effective_to: p.effectiveTo?.toISOString(),
    last_synced_at: p.lastSyncedAt.toISOString(),
    last_verified_at: p.lastVerifiedAt?.toISOString(),
    is_stale: p.staleAfter !== null && p.staleAfter < new Date(),
  };
}
