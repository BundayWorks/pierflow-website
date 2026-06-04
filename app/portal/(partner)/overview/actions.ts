"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { headers } from "next/headers";
import { currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { requirePartnerUser } from "@/lib/auth";

const DPA_DOCUMENT_VERSION = "dpa-2026-06-04";

/* ── Email verification ───────────────────────────────────────── */

/**
 * Marks the current PartnerUser row as email-verified.
 *
 * Called by the dashboard verification widget after Clerk's
 * attemptVerification confirms the 6-digit code matches. We
 * deliberately re-check on the server: Clerk's user object is fetched
 * fresh, and the email must be currently `verified` in Clerk before we
 * set our column. This stops a malicious client from skipping the
 * code step and just calling the action.
 */
export async function markEmailVerified() {
  const { partnerUser } = await requirePartnerUser();
  const user = await currentUser();
  const verified =
    user?.primaryEmailAddress?.verification?.status === "verified";
  if (!verified) {
    throw new Error("EMAIL_NOT_VERIFIED_WITH_CLERK");
  }
  await db.partnerUser.update({
    where: { id: partnerUser.id },
    data: { emailVerifiedAt: new Date() },
  });
  revalidatePath("/portal/overview");
  return { ok: true };
}

/* ── Profile ──────────────────────────────────────────────────── */

const ProfileInput = z.object({
  legalName: z.string().trim().max(160).optional().nullable(),
  registeredAddress: z.string().trim().max(300).optional().nullable(),
  contactPhone: z.string().trim().max(40).optional().nullable(),
});

export async function saveProfile(input: z.infer<typeof ProfileInput>) {
  const { partner } = await requirePartnerUser();
  const parsed = ProfileInput.parse(input);

  const isComplete = Boolean(
    parsed.legalName?.trim() &&
      parsed.registeredAddress?.trim() &&
      parsed.contactPhone?.trim(),
  );

  await db.partnerProfile.upsert({
    where: { partnerId: partner.id },
    update: {
      legalName: parsed.legalName ?? null,
      registeredAddress: parsed.registeredAddress ?? null,
      contactPhone: parsed.contactPhone ?? null,
      completedAt: isComplete ? new Date() : null,
    },
    create: {
      partnerId: partner.id,
      legalName: parsed.legalName ?? null,
      registeredAddress: parsed.registeredAddress ?? null,
      contactPhone: parsed.contactPhone ?? null,
      completedAt: isComplete ? new Date() : null,
    },
  });

  revalidatePath("/portal/overview");
  return { ok: true };
}

/* ── Sign the DPA ─────────────────────────────────────────────── */

export async function signDpa() {
  const { partner, partnerUser } = await requirePartnerUser();
  const user = await currentUser();
  const hdrs = await headers();
  const ip =
    hdrs.get("x-forwarded-for")?.split(",")[0].trim() ??
    hdrs.get("x-real-ip") ??
    null;
  const ua = hdrs.get("user-agent");

  await db.partnerAgreement.create({
    data: {
      partnerId: partner.id,
      kind: "DPA",
      signedByExternalId: partnerUser.externalId ?? "",
      signedByEmail: partnerUser.email,
      signedByName:
        [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
        partnerUser.email,
      documentVersion: DPA_DOCUMENT_VERSION,
      ipAddress: ip,
      userAgent: ua,
    },
  });

  revalidatePath("/portal/overview");
  return { ok: true };
}

/* ── Security questionnaire ───────────────────────────────────── */

const SecurityInput = z.object({
  dataResidency: z.enum(["ng", "eu", "us", "other"]).optional(),
  retentionDays: z
    .number()
    .int()
    .min(1)
    .max(365 * 10)
    .optional(),
  accessControlNotes: z.string().trim().max(2000).optional().nullable(),
  encryptsAtRest: z.boolean().optional(),
  encryptsInTransit: z.boolean().optional(),
  hasIncidentResponse: z.boolean().optional(),
  hasNda: z.boolean().optional(),
});

export async function saveSecurityAssessment(
  input: z.infer<typeof SecurityInput>,
) {
  const { partner } = await requirePartnerUser();
  const parsed = SecurityInput.parse(input);

  // We treat the questionnaire as "complete" if they've said yes to the
  // four boolean controls, picked a residency, and given a retention
  // period. Notes are optional.
  const isComplete = Boolean(
    parsed.dataResidency &&
      parsed.retentionDays &&
      parsed.encryptsAtRest &&
      parsed.encryptsInTransit &&
      parsed.hasIncidentResponse,
  );

  await db.partnerSecurityAssessment.upsert({
    where: { partnerId: partner.id },
    update: {
      dataResidency: parsed.dataResidency ?? null,
      retentionDays: parsed.retentionDays ?? null,
      accessControlNotes: parsed.accessControlNotes ?? null,
      encryptsAtRest: parsed.encryptsAtRest ?? false,
      encryptsInTransit: parsed.encryptsInTransit ?? false,
      hasIncidentResponse: parsed.hasIncidentResponse ?? false,
      hasNda: parsed.hasNda ?? false,
      completedAt: isComplete ? new Date() : null,
    },
    create: {
      partnerId: partner.id,
      dataResidency: parsed.dataResidency ?? null,
      retentionDays: parsed.retentionDays ?? null,
      accessControlNotes: parsed.accessControlNotes ?? null,
      encryptsAtRest: parsed.encryptsAtRest ?? false,
      encryptsInTransit: parsed.encryptsInTransit ?? false,
      hasIncidentResponse: parsed.hasIncidentResponse ?? false,
      hasNda: parsed.hasNda ?? false,
      completedAt: isComplete ? new Date() : null,
    },
  });

  revalidatePath("/portal/overview");
  return { ok: true };
}

/* ── Request production access ────────────────────────────────── */

export async function requestProductionAccess() {
  const { partner } = await requirePartnerUser();

  if (partner.accessStatus !== "SANDBOX") {
    throw new Error("PARTNER_NOT_IN_SANDBOX");
  }

  await db.partner.update({
    where: { id: partner.id },
    data: {
      accessStatus: "PRODUCTION_REQUESTED",
      productionRequestedAt: new Date(),
    },
  });

  revalidatePath("/portal/overview");
  return { ok: true };
}
