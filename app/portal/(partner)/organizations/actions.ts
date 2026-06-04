"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePartnerUser } from "@/lib/auth";

/* ── List ─────────────────────────────────────────────────────── */

/**
 * Returns every Organization this partner has registered, regardless
 * of status. Pending and rejected orgs show up here so partners can
 * see what they've submitted; only ACTIVE orgs are usable for ingest.
 */
export async function listMyOrganizations() {
  const { partner } = await requirePartnerUser();

  // Two-stage join: orgs the partner explicitly requested, plus any
  // orgs they're already linked to that they didn't request (e.g.
  // platform-managed orgs staff attached them to).
  const requested = await db.organization.findMany({
    where: { requestedByPartnerId: partner.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      type: true,
      country: true,
      lga: true,
      state: true,
      mrnSystem: true,
      accessStatus: true,
      rejectionReason: true,
      createdAt: true,
      approvedAt: true,
    },
  });

  const linksOnly = await db.partnerOrganizationLink.findMany({
    where: {
      partnerId: partner.id,
      organization: { requestedByPartnerId: { not: partner.id } },
    },
    select: {
      organization: {
        select: {
          id: true,
          name: true,
          type: true,
          country: true,
          lga: true,
          state: true,
          mrnSystem: true,
          accessStatus: true,
          rejectionReason: true,
          createdAt: true,
          approvedAt: true,
        },
      },
    },
  });

  return [...requested, ...linksOnly.map((l) => l.organization)];
}

/* ── Register a new org ──────────────────────────────────────── */

const RegisterInput = z.object({
  name: z.string().trim().min(2).max(160),
  type: z.enum([
    "HOSPITAL",
    "CLINIC",
    "LAB",
    "PHARMACY",
    "INSURER",
    "EMR_VENDOR",
    "HMS_VENDOR",
    "GOVERNMENT",
    "COOPERATIVE",
    "OTHER",
  ]),
  country: z.string().trim().length(2).default("NG"),
  state: z.string().trim().max(120).optional(),
  lga: z.string().trim().max(120).optional(),
  mrnSystem: z
    .string()
    .trim()
    .url("MRN system must be a valid https URL")
    .max(300)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v && v.length > 0 ? v : undefined)),
});

export async function registerOrganization(
  input: z.infer<typeof RegisterInput>,
) {
  const { partner, partnerUser } = await requirePartnerUser();
  const parsed = RegisterInput.parse(input);

  if (partner.accessStatus !== "SANDBOX" && partner.accessStatus !== "PRODUCTION") {
    throw new Error("PARTNER_NOT_APPROVED");
  }

  const org = await db.organization.create({
    data: {
      name: parsed.name,
      type: parsed.type,
      country: parsed.country.toUpperCase(),
      state: parsed.state ?? null,
      lga: parsed.lga ?? null,
      mrnSystem: parsed.mrnSystem ?? null,
      accessStatus: "PENDING",
      requestedByPartnerId: partner.id,
      requestedByExternalId: partnerUser.externalId,
      isActive: true,
      approvalEvents: {
        create: {
          action: "REQUESTED",
          actorExternalId: partnerUser.externalId,
          detail: { source: "partner_portal" },
        },
      },
    },
    select: { id: true },
  });

  revalidatePath("/portal/organizations");
  return { ok: true, organizationId: org.id };
}
