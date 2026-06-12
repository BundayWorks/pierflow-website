/**
 * HMO rate-card opt-in helpers.
 *
 * Fintechs browse HMOs through GET /v1/hmo-providers. Each HMO card
 * shows the FINTECH party row from that HMO's active contract — "you
 * earn 6% per enrollment." The fintech then calls POST opt-in to
 * formally accept those terms, which creates/updates a PartnerHmoAccess
 * row and freezes the rate card in rateCardSnapshot.
 *
 * After opt-in, GET /v1/plans only returns plans from opted-in (ACTIVE)
 * HMOs. Fintechs who haven't opted into any HMOs see an empty catalogue
 * with a clear "no HMOs enabled" message in the API response.
 */

import { db } from "@/lib/db";

const KOBO_PER_NAIRA = BigInt(100);

/** Kobo (as a numeric string or bigint) → whole-naira number for display. */
function nairaOf(kobo: string | bigint): number {
  return Number(BigInt(kobo) / KOBO_PER_NAIRA);
}

// ── Types ─────────────────────────────────────────────────────────────

export type RateCardLine = {
  kind: "FLAT" | "PERCENTAGE";
  timing: "ENROLLMENT_ONLY" | "RECURRING_ONLY" | "BOTH";
  /** Basis points (0–10000). Only set when kind = PERCENTAGE. */
  amount_bps?: number;
  /** Kobo. Only set when kind = FLAT. */
  amount_flat_ngn?: string;
  min_per_cycle_ngn?: string;
  max_per_cycle_ngn?: string;
};

export type HmoRateCard = {
  provider_slug: string;
  provider_name: string;
  plan_count: number;
  contract_id: string | null;
  /** Null when the HMO has no active contract yet (draft-only). */
  lines: RateCardLine[] | null;
  /** Human-readable summary, e.g. "6% per enrollment (min ₦100)". */
  summary: string | null;
  access_status: "NOT_OPTED_IN" | "PENDING_ACCEPTANCE" | "ACTIVE" | "SUSPENDED";
};

// ── Queries ───────────────────────────────────────────────────────────

/**
 * List all active HMOs with the published FINTECH rate and the
 * calling partner's current opt-in status.
 */
export async function listHmosForFintech(
  partnerId: string,
): Promise<HmoRateCard[]> {
  const [providers, accessRows] = await Promise.all([
    db.hmoProvider.findMany({
      where: { status: "ACTIVE" },
      orderBy: { displayName: "asc" },
      select: {
        id: true,
        slug: true,
        displayName: true,
        _count: { select: { plans: { where: { status: "ACTIVE" } } } },
        contracts: {
          where: { status: "ACTIVE" },
          orderBy: { version: "desc" },
          take: 1,
          select: {
            id: true,
            parties: {
              where: { role: "FINTECH" },
              select: {
                kind: true,
                timing: true,
                amountBps: true,
                amountFlatNgn: true,
                minPerCycleNgn: true,
                maxPerCycleNgn: true,
              },
            },
          },
        },
      },
    }),
    db.partnerHmoAccess.findMany({
      where: { partnerId },
      select: { hmoProviderId: true, status: true },
    }),
  ]);

  const accessMap = new Map(accessRows.map((r) => [r.hmoProviderId, r.status]));

  return providers.map((p) => {
    const contract = p.contracts[0] ?? null;
    const lines: RateCardLine[] | null = contract?.parties.length
      ? contract.parties.map((party) => ({
          kind: party.kind,
          timing: party.timing,
          amount_bps: party.amountBps ?? undefined,
          amount_flat_ngn: party.amountFlatNgn?.toString() ?? undefined,
          min_per_cycle_ngn: party.minPerCycleNgn?.toString() ?? undefined,
          max_per_cycle_ngn: party.maxPerCycleNgn?.toString() ?? undefined,
        }))
      : null;

    const rawStatus = accessMap.get(p.id) as
      | HmoRateCard["access_status"]
      | undefined;
    const access_status: HmoRateCard["access_status"] =
      rawStatus ?? "NOT_OPTED_IN";

    return {
      provider_slug: p.slug,
      provider_name: p.displayName,
      plan_count: p._count.plans,
      contract_id: contract?.id ?? null,
      lines,
      summary: buildSummary(lines),
      access_status,
    };
  });
}

/**
 * Accept the rate card for a single HMO. Creates or updates the
 * PartnerHmoAccess row to ACTIVE and freezes the current FINTECH
 * party lines as the rateCardSnapshot.
 *
 * Returns "already_active" if the fintech is already opted in to this
 * exact contract version, "ok" on success, or an error reason.
 */
export async function optInToHmo(
  partnerId: string,
  providerSlug: string,
): Promise<
  | { ok: true; status: "activated" | "already_active" }
  | { ok: false; reason: "HMO_NOT_FOUND" | "NO_ACTIVE_CONTRACT" }
> {
  const provider = await db.hmoProvider.findUnique({
    where: { slug: providerSlug, status: "ACTIVE" },
    select: {
      id: true,
      contracts: {
        where: { status: "ACTIVE" },
        orderBy: { version: "desc" },
        take: 1,
        select: {
          id: true,
          parties: {
            where: { role: "FINTECH" },
            select: {
              kind: true,
              timing: true,
              amountBps: true,
              amountFlatNgn: true,
              minPerCycleNgn: true,
              maxPerCycleNgn: true,
            },
          },
        },
      },
    },
  });

  if (!provider) return { ok: false, reason: "HMO_NOT_FOUND" };

  const contract = provider.contracts[0];
  if (!contract) return { ok: false, reason: "NO_ACTIVE_CONTRACT" };

  const existing = await db.partnerHmoAccess.findUnique({
    where: { partnerId_hmoProviderId: { partnerId, hmoProviderId: provider.id } },
  });

  if (existing?.status === "ACTIVE" && existing.contractId === contract.id) {
    return { ok: true, status: "already_active" };
  }

  const snapshot: RateCardLine[] = contract.parties.map((p) => ({
    kind: p.kind,
    timing: p.timing,
    amount_bps: p.amountBps ?? undefined,
    amount_flat_ngn: p.amountFlatNgn?.toString() ?? undefined,
    min_per_cycle_ngn: p.minPerCycleNgn?.toString() ?? undefined,
    max_per_cycle_ngn: p.maxPerCycleNgn?.toString() ?? undefined,
  }));

  await db.partnerHmoAccess.upsert({
    where: { partnerId_hmoProviderId: { partnerId, hmoProviderId: provider.id } },
    update: {
      status: "ACTIVE",
      acceptedAt: new Date(),
      contractId: contract.id,
      rateCardSnapshot: snapshot,
    },
    create: {
      partnerId,
      hmoProviderId: provider.id,
      status: "ACTIVE",
      acceptedAt: new Date(),
      contractId: contract.id,
      rateCardSnapshot: snapshot,
    },
  });

  return { ok: true, status: "activated" };
}

/**
 * Remove opt-in for an HMO. Sets status to PENDING_ACCEPTANCE so the
 * fintech can re-accept later. Does not delete the row (preserves the
 * audit trail of when they first accepted).
 */
export async function optOutOfHmo(
  partnerId: string,
  providerSlug: string,
): Promise<{ ok: true } | { ok: false; reason: "NOT_FOUND" }> {
  const provider = await db.hmoProvider.findUnique({
    where: { slug: providerSlug },
    select: { id: true },
  });
  if (!provider) return { ok: false, reason: "NOT_FOUND" };

  await db.partnerHmoAccess.upsert({
    where: { partnerId_hmoProviderId: { partnerId, hmoProviderId: provider.id } },
    update: { status: "PENDING_ACCEPTANCE" },
    create: { partnerId, hmoProviderId: provider.id, status: "PENDING_ACCEPTANCE" },
  });
  return { ok: true };
}

/**
 * Return the set of provider IDs the fintech has ACTIVE access to.
 * Used by listPlansPublic to gate the plan catalogue.
 * Returns null when the partner has no INSURANCE scope / no access
 * records yet — caller decides whether to show empty or all.
 */
export async function getActiveProviderIds(
  partnerId: string,
): Promise<Set<string> | null> {
  const rows = await db.partnerHmoAccess.findMany({
    where: { partnerId, status: "ACTIVE" },
    select: { hmoProviderId: true },
  });
  if (rows.length === 0) return null;
  return new Set(rows.map((r) => r.hmoProviderId));
}

// ── Internals ─────────────────────────────────────────────────────────

function buildSummary(lines: RateCardLine[] | null): string | null {
  if (!lines || lines.length === 0) return null;
  const recurring = lines.find(
    (l) => l.timing === "RECURRING_ONLY" || l.timing === "BOTH",
  );
  if (!recurring) return null;

  if (recurring.kind === "PERCENTAGE" && recurring.amount_bps !== undefined) {
    const pct = (recurring.amount_bps / 100).toFixed(1).replace(".0", "");
    let s = `${pct}% per enrollment`;
    if (recurring.min_per_cycle_ngn) {
      s += ` (min ₦${nairaOf(recurring.min_per_cycle_ngn).toLocaleString()})`;
    }
    if (recurring.max_per_cycle_ngn) {
      s += ` (max ₦${nairaOf(recurring.max_per_cycle_ngn).toLocaleString()})`;
    }
    return s;
  }

  if (recurring.kind === "FLAT" && recurring.amount_flat_ngn) {
    return `₦${nairaOf(recurring.amount_flat_ngn).toLocaleString()} flat per enrollment`;
  }

  return null;
}
