"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePartnerUser } from "@/lib/auth";
import { generateApiKey } from "@/lib/partnerAuth";

/* ── List ─────────────────────────────────────────────────────── */

export async function listMyApiKeys() {
  const { partner } = await requirePartnerUser();
  return db.partnerApiKey.findMany({
    where: { partnerId: partner.id },
    orderBy: [{ revokedAt: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      last4: true,
      label: true,
      scopes: true,
      createdAt: true,
      revokedAt: true,
      lastUsedAt: true,
      expiresAt: true,
    },
  });
}

/* ── Create ───────────────────────────────────────────────────── */

const CreateInput = z.object({
  label: z.string().trim().max(60).optional(),
});

export async function createApiKey(input: z.infer<typeof CreateInput>) {
  const { partner } = await requirePartnerUser();

  // Gate: only partners approved for sandbox (or production) can
  // self-issue keys. A PENDING_SANDBOX / SUSPENDED partner that
  // somehow reaches this server action by direct request is rejected.
  if (
    partner.accessStatus !== "SANDBOX" &&
    partner.accessStatus !== "PRODUCTION_REQUESTED" &&
    partner.accessStatus !== "PRODUCTION"
  ) {
    throw new Error("SANDBOX_NOT_APPROVED");
  }

  const parsed = CreateInput.parse(input);
  // Live keys are only available once we've explicitly approved
  // production access. Until then, even a partner with PRODUCTION
  // status issuing new keys here gets a test key.
  const env = partner.accessStatus === "PRODUCTION" ? "live" : "test";
  const { raw, hash, last4 } = generateApiKey(env);

  await db.partnerApiKey.create({
    data: {
      partnerId: partner.id,
      keyHash: hash,
      last4,
      label: parsed.label || "Issued from portal",
      scopes: ["records:read"],
    },
  });

  revalidatePath("/portal/keys");
  return { rawKey: raw, last4 };
}

/* ── Revoke ───────────────────────────────────────────────────── */

const RevokeInput = z.object({ keyId: z.string().min(1) });

export async function revokeApiKey(input: z.infer<typeof RevokeInput>) {
  const { partner } = await requirePartnerUser();
  const parsed = RevokeInput.parse(input);

  // Partner-scoped — never let one partner revoke another's key.
  const row = await db.partnerApiKey.findFirst({
    where: { id: parsed.keyId, partnerId: partner.id },
    select: { id: true, revokedAt: true },
  });
  if (!row) throw new Error("KEY_NOT_FOUND");
  if (row.revokedAt) return { ok: true };

  await db.partnerApiKey.update({
    where: { id: row.id },
    data: { revokedAt: new Date() },
  });
  revalidatePath("/portal/keys");
  return { ok: true };
}
