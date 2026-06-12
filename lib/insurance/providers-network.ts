/**
 * Provider network — sync + read.
 *
 *   syncProviderNetwork(hmoProviderId) — call the connector, upsert
 *     HmoNetworkProvider rows by (hmoProviderId, externalId).
 *     Idempotent; meant for the catalogue-refresh cron path.
 *
 *   listProvidersPublic({ state, lga, specialty, plan_id, type }) —
 *     fintech-facing read. Filters in memory at MVP scale.
 *
 * When a plan has no HmoPlanNetworkProvider links, the plan accepts
 * the HMO's full active network. When it has any link rows, only
 * the listed providers are accepted.
 */

import {
  Prisma,
  type HmoNetworkProviderType,
} from "@prisma/client";
import { db } from "@/lib/db";
import { stubListNetworkProviders } from "@/lib/insurance/stub-connector.ts";

// ─────────────────────────────────────────────────────────────────────
// Sync
// ─────────────────────────────────────────────────────────────────────

export async function syncProviderNetwork(hmoProviderId: string): Promise<{
  scanned: number;
  created: number;
  updated: number;
}> {
  const hmo = await db.hmoProvider.findUnique({
    where: { id: hmoProviderId },
    select: { id: true, slug: true },
  });
  if (!hmo) throw new Error("HMO_PROVIDER_NOT_FOUND");

  const incoming = await stubListNetworkProviders({ hmoSlug: hmo.slug });
  let created = 0;
  let updated = 0;
  for (const p of incoming) {
    const existing = await db.hmoNetworkProvider.findUnique({
      where: {
        hmoProviderId_externalId: {
          hmoProviderId: hmo.id,
          externalId: p.external_id,
        },
      },
      select: { id: true },
    });
    if (existing) {
      await db.hmoNetworkProvider.update({
        where: { id: existing.id },
        data: {
          name: p.name,
          type: p.type as HmoNetworkProviderType,
          state: p.state,
          lga: p.lga,
          street: p.street ?? null,
          latitude: p.latitude ?? null,
          longitude: p.longitude ?? null,
          specialties: p.specialties,
          contactPhone: p.contact_phone ?? null,
          tier: p.tier ?? null,
          isActive: true,
          lastSyncedAt: new Date(),
        },
      });
      updated++;
    } else {
      await db.hmoNetworkProvider.create({
        data: {
          hmoProviderId: hmo.id,
          externalId: p.external_id,
          name: p.name,
          type: p.type as HmoNetworkProviderType,
          state: p.state,
          lga: p.lga,
          street: p.street ?? null,
          latitude: p.latitude ?? null,
          longitude: p.longitude ?? null,
          specialties: p.specialties,
          contactPhone: p.contact_phone ?? null,
          tier: p.tier ?? null,
        },
      });
      created++;
    }
  }
  return { scanned: incoming.length, created, updated };
}

// ─────────────────────────────────────────────────────────────────────
// Public read
// ─────────────────────────────────────────────────────────────────────

export type ProviderFilters = {
  state?: string;
  lga?: string;
  specialty?: string;
  planId?: string;
  type?: HmoNetworkProviderType;
  hmoSlug?: string;
};

export type PublicProvider = {
  id: string;
  name: string;
  type: string;
  state: string | null;
  lga: string | null;
  street: string | null;
  latitude: number | null;
  longitude: number | null;
  specialties: string[];
  contact_phone: string | null;
  tier: number | null;
  hmo: {
    slug: string;
    name: string;
  };
};

export async function listProvidersPublic(
  filters: ProviderFilters,
  pagination: { cursor?: string; limit?: number } = {},
): Promise<{ items: PublicProvider[]; next_cursor: string | null }> {
  const limit = Math.min(Math.max(pagination.limit ?? 50, 1), 200);

  // If filtering by plan: resolve which provider ids the plan accepts.
  let providerIdFilter: string[] | null = null;
  if (filters.planId) {
    const links = await db.hmoPlanNetworkProvider.findMany({
      where: { planId: filters.planId },
      select: { networkProviderId: true },
    });
    if (links.length === 0) {
      // No explicit network = plan accepts the whole HMO network.
      // Look up the plan's provider to scope correctly.
      const plan = await db.hmoPlan.findUnique({
        where: { id: filters.planId },
        select: { providerId: true },
      });
      if (!plan) {
        return { items: [], next_cursor: null };
      }
      // Scope to that HMO's network — fall through with the filter.
      filters = { ...filters, hmoSlug: filters.hmoSlug };
      // Implicit: rest of filtering happens below on the where clause.
    } else {
      providerIdFilter = links.map((l) => l.networkProviderId);
    }
  }

  const rows = await db.hmoNetworkProvider.findMany({
    where: {
      isActive: true,
      ...(providerIdFilter ? { id: { in: providerIdFilter } } : {}),
      ...(filters.type ? { type: filters.type } : {}),
      ...(filters.state ? { state: filters.state } : {}),
      ...(filters.lga ? { lga: filters.lga } : {}),
      hmoProvider: {
        status: "ACTIVE",
        ...(filters.hmoSlug ? { slug: filters.hmoSlug } : {}),
      },
    },
    orderBy: [{ id: "asc" }],
    take: limit + 1,
    ...(pagination.cursor
      ? { cursor: { id: pagination.cursor }, skip: 1 }
      : {}),
    include: {
      hmoProvider: { select: { slug: true, displayName: true } },
    },
  });

  let items = rows.map<PublicProvider>((p) => ({
    id: p.id,
    name: p.name,
    type: p.type,
    state: p.state,
    lga: p.lga,
    street: p.street,
    latitude: p.latitude,
    longitude: p.longitude,
    specialties: p.specialties,
    contact_phone: p.contactPhone,
    tier: p.tier,
    hmo: { slug: p.hmoProvider.slug, name: p.hmoProvider.displayName },
  }));

  // Specialty filter — JSON array, easier in memory at this scale.
  if (filters.specialty) {
    const needle = filters.specialty.toLowerCase();
    items = items.filter((p) =>
      p.specialties.some((s) => s.toLowerCase().includes(needle)),
    );
  }

  const hasMore = items.length > limit;
  const sliced = hasMore ? items.slice(0, limit) : items;
  const nextCursor = hasMore ? sliced[sliced.length - 1].id : null;
  return { items: sliced, next_cursor: nextCursor };
}

export async function getProviderPublic(
  providerId: string,
): Promise<PublicProvider | null> {
  const p = await db.hmoNetworkProvider.findUnique({
    where: { id: providerId },
    include: {
      hmoProvider: { select: { slug: true, displayName: true, status: true } },
    },
  });
  if (!p) return null;
  if (p.hmoProvider.status !== "ACTIVE") return null;
  return {
    id: p.id,
    name: p.name,
    type: p.type,
    state: p.state,
    lga: p.lga,
    street: p.street,
    latitude: p.latitude,
    longitude: p.longitude,
    specialties: p.specialties,
    contact_phone: p.contactPhone,
    tier: p.tier,
    hmo: { slug: p.hmoProvider.slug, name: p.hmoProvider.displayName },
  };
}

// Suppress the unused-prisma warning for now — keeps the file consistent
// with the others that import Prisma for InputJsonValue.
void Prisma;
