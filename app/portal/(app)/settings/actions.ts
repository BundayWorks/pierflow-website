"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireSessionContext } from "@/lib/auth";
import { generateApiKey } from "@/lib/partnerAuth";

/* ── List partners + keys for this org ────────────────────────── */

export async function listPartnerLinks() {
  const ctx = await requireSessionContext();
  return db.partnerOrganizationLink.findMany({
    where: { organizationId: ctx.organization.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      createdAt: true,
      partner: {
        select: {
          id: true,
          name: true,
          slug: true,
          type: true,
          isActive: true,
          apiKeys: {
            where: { revokedAt: null },
            select: {
              id: true,
              label: true,
              last4: true,
              createdAt: true,
              lastUsedAt: true,
            },
            orderBy: { createdAt: "desc" },
          },
        },
      },
    },
  });
}

/* ── Create a new partner + link it to this org ───────────────── */

const CreatePartnerInput = z.object({
  name: z.string().trim().min(2).max(120),
  type: z.enum([
    "EMR_VENDOR",
    "HMS_VENDOR",
    "EHR_VENDOR",
    "INSURER",
    "GOVERNMENT",
    "ANALYTICS",
    "OTHER",
  ]),
});

export async function createPartner(input: z.infer<typeof CreatePartnerInput>) {
  const ctx = await requireSessionContext();
  const parsed = CreatePartnerInput.parse(input);

  const slug = slugify(parsed.name) + "-" + randomSuffix();

  const partner = await db.partner.create({
    data: {
      name: parsed.name,
      slug,
      type: parsed.type,
      organizationLinks: {
        create: [{ organizationId: ctx.organization.id }],
      },
    },
    select: { id: true, slug: true },
  });

  revalidatePath("/portal/settings");
  return partner;
}

/* ── Issue a new API key for a partner ────────────────────────── */

const IssueKeyInput = z.object({
  partnerId: z.string().min(1),
  label: z.string().trim().max(60).optional(),
});

/**
 * Returns the raw key ONCE. The caller must show this to the user and
 * never persist it client-side. We store only the hash.
 */
export async function issuePartnerApiKey(input: z.infer<typeof IssueKeyInput>) {
  const ctx = await requireSessionContext();
  const parsed = IssueKeyInput.parse(input);

  // Confirm the partner is linked to this org.
  const link = await db.partnerOrganizationLink.findFirst({
    where: {
      partnerId: parsed.partnerId,
      organizationId: ctx.organization.id,
    },
    select: { id: true },
  });
  if (!link) throw new Error("PARTNER_NOT_LINKED");

  const { raw, hash, last4 } = generateApiKey("test");

  await db.partnerApiKey.create({
    data: {
      partnerId: parsed.partnerId,
      keyHash: hash,
      last4,
      label: parsed.label ?? null,
      scopes: ["records:read"],
    },
  });

  revalidatePath("/portal/settings");
  return { rawKey: raw, last4 };
}

/* ── Revoke an API key ────────────────────────────────────────── */

export async function revokePartnerApiKey(apiKeyId: string) {
  const ctx = await requireSessionContext();

  // Confirm the key belongs to a partner linked to this org.
  const key = await db.partnerApiKey.findUnique({
    where: { id: apiKeyId },
    select: {
      id: true,
      partner: {
        select: {
          organizationLinks: {
            where: { organizationId: ctx.organization.id },
            select: { id: true },
          },
        },
      },
    },
  });
  if (!key || key.partner.organizationLinks.length === 0) {
    throw new Error("KEY_NOT_FOUND");
  }

  await db.partnerApiKey.update({
    where: { id: apiKeyId },
    data: { revokedAt: new Date() },
  });

  revalidatePath("/portal/settings");
  return { ok: true };
}

/* ── Helpers ──────────────────────────────────────────────────── */

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 32);
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 8);
}
