"use server";

import { resolveSession } from "@/lib/auth";
import { db } from "@/lib/db";
import type { HmoNetworkProviderType } from "@prisma/client";

async function resolveProviderId(): Promise<string | null> {
  const session = await resolveSession();
  if (session.kind !== "partner") return null;
  const link = await db.partnerOrganizationLink.findFirst({
    where: { partnerId: session.partner.id },
    include: {
      organization: {
        include: { hmoProvider: { select: { id: true } } },
      },
    },
  });
  return link?.organization?.hmoProvider?.id ?? null;
}

// ── List ───────────────────────────────────────────────────────────

export type NetworkProviderRow = {
  id: string;
  externalId: string;
  name: string;
  type: string;
  state: string | null;
  lga: string | null;
  specialties: string[];
  tier: number | null;
  isActive: boolean;
  contactPhone: string | null;
};

export async function getNetworkProviders(): Promise<NetworkProviderRow[]> {
  const providerId = await resolveProviderId();
  if (!providerId) return [];

  const rows = await db.hmoNetworkProvider.findMany({
    where: { hmoProviderId: providerId },
    orderBy: { name: "asc" },
    take: 500,
  });

  return rows.map((r) => ({
    id: r.id,
    externalId: r.externalId,
    name: r.name,
    type: r.type,
    state: r.state,
    lga: r.lga,
    specialties: r.specialties,
    tier: r.tier,
    isActive: r.isActive,
    contactPhone: r.contactPhone,
  }));
}

// ── Detail ─────────────────────────────────────────────────────────

export type NetworkProviderDetail = {
  id: string;
  externalId: string;
  name: string;
  type: string;
  state: string | null;
  lga: string | null;
  street: string | null;
  latitude: number | null;
  longitude: number | null;
  specialties: string[];
  tier: number | null;
  isActive: boolean;
  contactPhone: string | null;
  contactEmail: string | null;
  lastSyncedAt: string | null;
};

export async function getNetworkProviderDetail(
  id: string,
): Promise<NetworkProviderDetail | null> {
  const providerId = await resolveProviderId();
  if (!providerId) return null;

  const row = await db.hmoNetworkProvider.findUnique({ where: { id } });
  if (!row || row.hmoProviderId !== providerId) return null;

  return {
    id: row.id,
    externalId: row.externalId,
    name: row.name,
    type: row.type,
    state: row.state,
    lga: row.lga,
    street: row.street,
    latitude: row.latitude ? Number(row.latitude) : null,
    longitude: row.longitude ? Number(row.longitude) : null,
    specialties: row.specialties,
    tier: row.tier,
    isActive: row.isActive,
    contactPhone: row.contactPhone,
    contactEmail: row.contactEmail,
    lastSyncedAt: row.lastSyncedAt?.toISOString() ?? null,
  };
}

// ── Create ─────────────────────────────────────────────────────────

type MutationResult =
  | { ok: true; id: string }
  | { ok: false; reason: string };

const PROVIDER_TYPES: string[] = [
  "HOSPITAL",
  "CLINIC",
  "LAB",
  "PHARMACY",
  "OTHER",
];

export async function createNetworkProviderAction(raw: {
  name: string;
  externalId: string;
  type: string;
  state?: string;
  lga?: string;
  street?: string;
  latitude?: number;
  longitude?: number;
  specialties?: string[];
  contactPhone?: string;
  contactEmail?: string;
  tier?: number;
}): Promise<MutationResult> {
  const providerId = await resolveProviderId();
  if (!providerId) return { ok: false, reason: "Unauthorized" };

  if (!raw.name?.trim()) return { ok: false, reason: "Name is required" };
  if (!raw.externalId?.trim()) return { ok: false, reason: "External ID is required" };
  if (!PROVIDER_TYPES.includes(raw.type)) return { ok: false, reason: "Invalid provider type" };

  const row = await db.hmoNetworkProvider.upsert({
    where: {
      hmoProviderId_externalId: {
        hmoProviderId: providerId,
        externalId: raw.externalId.trim(),
      },
    },
    update: {
      name: raw.name.trim(),
      type: raw.type as HmoNetworkProviderType,
      state: raw.state?.trim() || null,
      lga: raw.lga?.trim() || null,
      street: raw.street?.trim() || null,
      latitude: raw.latitude ?? null,
      longitude: raw.longitude ?? null,
      specialties: raw.specialties ?? [],
      contactPhone: raw.contactPhone?.trim() || null,
      contactEmail: raw.contactEmail?.trim() || null,
      tier: raw.tier ?? null,
      lastSyncedAt: new Date(),
    },
    create: {
      hmoProviderId: providerId,
      externalId: raw.externalId.trim(),
      name: raw.name.trim(),
      type: raw.type as HmoNetworkProviderType,
      state: raw.state?.trim() || null,
      lga: raw.lga?.trim() || null,
      street: raw.street?.trim() || null,
      latitude: raw.latitude ?? null,
      longitude: raw.longitude ?? null,
      specialties: raw.specialties ?? [],
      contactPhone: raw.contactPhone?.trim() || null,
      contactEmail: raw.contactEmail?.trim() || null,
      tier: raw.tier ?? null,
      isActive: true,
    },
  });

  return { ok: true, id: row.id };
}

// ── Update ─────────────────────────────────────────────────────────

export async function updateNetworkProviderAction(
  id: string,
  raw: {
    name: string;
    type: string;
    state?: string;
    lga?: string;
    street?: string;
    latitude?: number;
    longitude?: number;
    specialties?: string[];
    contactPhone?: string;
    contactEmail?: string;
    tier?: number;
  },
): Promise<MutationResult> {
  const providerId = await resolveProviderId();
  if (!providerId) return { ok: false, reason: "Unauthorized" };

  const existing = await db.hmoNetworkProvider.findUnique({ where: { id } });
  if (!existing || existing.hmoProviderId !== providerId) {
    return { ok: false, reason: "Provider not found" };
  }

  await db.hmoNetworkProvider.update({
    where: { id },
    data: {
      name: raw.name.trim(),
      type: raw.type as HmoNetworkProviderType,
      state: raw.state?.trim() || null,
      lga: raw.lga?.trim() || null,
      street: raw.street?.trim() || null,
      latitude: raw.latitude ?? null,
      longitude: raw.longitude ?? null,
      specialties: raw.specialties ?? [],
      contactPhone: raw.contactPhone?.trim() || null,
      contactEmail: raw.contactEmail?.trim() || null,
      tier: raw.tier ?? null,
      lastSyncedAt: new Date(),
    },
  });

  return { ok: true, id };
}

// ── Toggle active ──────────────────────────────────────────────────

export async function toggleNetworkProviderActive(
  id: string,
): Promise<MutationResult> {
  const providerId = await resolveProviderId();
  if (!providerId) return { ok: false, reason: "Unauthorized" };

  const existing = await db.hmoNetworkProvider.findUnique({ where: { id } });
  if (!existing || existing.hmoProviderId !== providerId) {
    return { ok: false, reason: "Provider not found" };
  }

  await db.hmoNetworkProvider.update({
    where: { id },
    data: { isActive: !existing.isActive },
  });

  return { ok: true, id };
}
