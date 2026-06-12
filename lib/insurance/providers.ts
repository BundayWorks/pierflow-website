/**
 * HMO provider persistence helpers.
 *
 * One HmoProvider is always backed by one Organization (the tenant).
 * Staff create both together when onboarding an HMO. Partners (the
 * EMR vendor) can also nominate an HMO during their onboarding flow,
 * but the row stays PENDING until staff approves.
 *
 * Slug is the public identifier — used in URLs (/v1/hmo-providers/:slug)
 * so the EMR vendor never sees a Pierflow internal cuid.
 */

import { Prisma, type HmoProviderStatus } from "@prisma/client";
import { db } from "@/lib/db";

export type CreateHmoProviderInput = {
  /** Display name shown in dashboards and to partners. */
  displayName: string;
  /** Public slug (lowercase, kebab). Must be unique platform-wide. */
  slug: string;
  /** Optional regulatory id — NAICOM / NHIA / etc. */
  registrationNo?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  websiteUrl?: string | null;
  /** Default state for the underlying Organization row. */
  state?: string | null;
  /** Default LGA for the underlying Organization row. */
  lga?: string | null;
  /** Optional Cloudinary public_id for an uploaded logo. */
  logoAssetId?: string | null;
  /** Free-form metadata. */
  metadata?: Prisma.InputJsonValue | null;
};

export type CreateHmoProviderResult =
  | {
      ok: true;
      providerId: string;
      organizationId: string;
      slug: string;
    }
  | {
      ok: false;
      reason: "SLUG_TAKEN" | "INVALID_SLUG" | "DISPLAY_NAME_REQUIRED";
      detail?: string;
    };

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;

/**
 * Create an HMO provider and its backing Organization in one
 * transaction. The Organization is type=INSURER and starts ACTIVE;
 * staff control HmoProvider.status separately so an HMO can be
 * present in the tenancy graph but not yet distributable.
 */
export async function createHmoProvider(
  input: CreateHmoProviderInput,
): Promise<CreateHmoProviderResult> {
  const displayName = input.displayName?.trim();
  const slug = input.slug?.trim().toLowerCase();

  if (!displayName) return { ok: false, reason: "DISPLAY_NAME_REQUIRED" };
  if (!slug || !SLUG_RE.test(slug)) {
    return {
      ok: false,
      reason: "INVALID_SLUG",
      detail:
        "Slug must be lowercase alphanumeric with optional dashes (3-40 chars), no leading/trailing dash.",
    };
  }

  const existing = await db.hmoProvider.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (existing) return { ok: false, reason: "SLUG_TAKEN" };

  // Also reserve the slug on Organization so reverse-lookup by slug
  // works from either side. Organization.slug is sparsely unique.
  const orgWithSlug = await db.organization.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (orgWithSlug) return { ok: false, reason: "SLUG_TAKEN" };

  const result = await db.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: {
        name: displayName,
        type: "INSURER",
        slug,
        state: input.state ?? null,
        lga: input.lga ?? null,
        accessStatus: "ACTIVE",
        isActive: true,
      },
      select: { id: true },
    });

    const provider = await tx.hmoProvider.create({
      data: {
        organizationId: org.id,
        slug,
        displayName,
        registrationNo: input.registrationNo ?? null,
        contactEmail: input.contactEmail ?? null,
        contactPhone: input.contactPhone ?? null,
        websiteUrl: input.websiteUrl ?? null,
        logoAssetId: input.logoAssetId ?? null,
        metadata: input.metadata ?? Prisma.JsonNull,
        status: "PENDING",
      },
      select: { id: true },
    });

    // ── Portal access: Partner + link + admin user ──────────────
    // Creates the records resolvePartnerUser() needs so the HMO
    // admin can sign into the partner portal immediately.
    const partner = await tx.partner.create({
      data: {
        name: displayName,
        slug: `${slug}-portal`,
        type: "INSURER",
        accessStatus: "PRODUCTION",
        consumesProducts: ["INSURANCE"],
      },
      select: { id: true },
    });

    await tx.partnerOrganizationLink.create({
      data: {
        partnerId: partner.id,
        organizationId: org.id,
      },
    });

    // Seed a PartnerUser from the contact email so the HMO admin
    // can sign in on first attempt (email-match path in auth.ts).
    const contactEmail = input.contactEmail?.trim().toLowerCase();
    if (contactEmail) {
      await tx.partnerUser.create({
        data: {
          partnerId: partner.id,
          email: contactEmail,
          role: "ADMIN",
        },
      });
    }

    return { providerId: provider.id, organizationId: org.id };
  });

  return { ok: true, providerId: result.providerId, organizationId: result.organizationId, slug };
}

/**
 * Resolve a provider by its public slug. Includes the linked
 * Organization so callers can do tenant-level checks without a
 * second query.
 */
export async function findProviderBySlug(slug: string) {
  return db.hmoProvider.findUnique({
    where: { slug: slug.toLowerCase() },
    include: { organization: true },
  });
}

/**
 * Flip provider.status — used by the staff portal to ACTIVE-ate a
 * provider once their first contract is signed and their first plans
 * are in the catalogue.
 */
export async function setProviderStatus(
  providerId: string,
  status: HmoProviderStatus,
) {
  return db.hmoProvider.update({
    where: { id: providerId },
    data: { status },
    select: { id: true, status: true },
  });
}

export type UpdateSettlementInput = {
  defaultSettlementMode?: "IN_FINTECH_ACCOUNT" | "EXTERNAL_BANK_SWEEP";
  settlementBankName?: string | null;
  settlementBankAccount?: string | null;
  settlementBankCode?: string | null;
};

/**
 * Update the HMO-level default settlement preference. Per-fintech
 * overrides live on HmoProviderChannelSettlement.
 */
export async function updateProviderSettlement(
  providerId: string,
  input: UpdateSettlementInput,
) {
  return db.hmoProvider.update({
    where: { id: providerId },
    data: {
      ...(input.defaultSettlementMode !== undefined
        ? { defaultSettlementMode: input.defaultSettlementMode }
        : {}),
      ...(input.settlementBankName !== undefined
        ? { settlementBankName: input.settlementBankName || null }
        : {}),
      ...(input.settlementBankAccount !== undefined
        ? { settlementBankAccount: input.settlementBankAccount || null }
        : {}),
      ...(input.settlementBankCode !== undefined
        ? { settlementBankCode: input.settlementBankCode || null }
        : {}),
    },
    select: {
      id: true,
      defaultSettlementMode: true,
      settlementBankName: true,
      settlementBankAccount: true,
      settlementBankCode: true,
    },
  });
}

/**
 * List per-fintech settlement overrides for a provider. Used in the
 * staff portal sidebar to show "channels with custom terms."
 */
export async function listChannelSettlements(providerId: string) {
  return db.hmoProviderChannelSettlement.findMany({
    where: { providerId },
    orderBy: { createdAt: "desc" },
    include: {
      partner: { select: { id: true, name: true, slug: true } },
    },
  });
}
