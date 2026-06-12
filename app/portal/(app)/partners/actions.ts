"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { generateApiKey, defaultScopesFor } from "@/lib/partnerAuth";
import { getOrCreatePlatformOrg } from "@/lib/platformOrg";
import {
  sendMail,
  sandboxApprovedTemplate,
  sandboxRejectedTemplate,
  productionApprovedTemplate,
  productionRejectedTemplate,
} from "@/lib/email";

const PUBLIC_DOCS_URL = "https://www.pierflow.com/docs/quickstart/introduction";
const PORTAL_URL = "https://www.pierflow.com/portal";

/* ── Inbox queries ────────────────────────────────────────────── */

export async function countPartnersAwaitingReview(): Promise<number> {
  // Both sandbox approvals and production approvals are reviewer
  // actions — count both so the side-nav badge tells the whole story.
  return db.partner.count({
    where: {
      accessStatus: { in: ["PENDING_SANDBOX", "PRODUCTION_REQUESTED"] },
    },
  });
}

export type PartnerListFilter =
  | "PENDING_SANDBOX"
  | "SANDBOX"
  | "PRODUCTION_REQUESTED"
  | "PRODUCTION"
  | "ALL";

export async function listPartners(filter?: { status?: PartnerListFilter }) {
  await requireStaff();
  const status = filter?.status ?? "PENDING_SANDBOX";
  const where =
    status === "ALL"
      ? {}
      : { accessStatus: status };
  return db.partner.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      name: true,
      slug: true,
      type: true,
      accessStatus: true,
      createdAt: true,
      primaryUseCase: true,
      expectedVolume: true,
      timeline: true,
      country: true,
      websiteUrl: true,
      users: {
        select: { email: true, joinedAt: true },
        orderBy: { invitedAt: "asc" },
        take: 1,
      },
    },
  });
}

export async function getPartner(id: string) {
  await requireStaff();
  return db.partner.findUnique({
    where: { id },
    include: {
      users: { orderBy: { invitedAt: "asc" } },
      apiKeys: { orderBy: { createdAt: "desc" } },
      profile: true,
      securityAssessment: true,
      agreements: { orderBy: { signedAt: "desc" } },
    },
  });
}

/* ── Products / scope override ────────────────────────────────── */

const SetProductsInput = z.object({
  partnerId: z.string().min(1),
  consumesProducts: z.array(z.enum(["RECORDS", "INSURANCE"])).max(2),
});

/**
 * Staff override of which Pierflow products a partner consumes.
 * Drives the default scope set on any keys issued from this point
 * forward; existing keys keep the scopes they were issued with.
 *
 * Use cases:
 *   - A FINTECH that also wants the Records API (e.g. they're embedding
 *     both health insurance and digitised records flows).
 *   - An EMR vendor that signed up before FINTECH existed but now
 *     distributes HMO plans too.
 *   - Correcting a mis-categorised partner.
 */
export async function setPartnerProducts(
  input: z.infer<typeof SetProductsInput>,
) {
  await requireStaff();
  const parsed = SetProductsInput.parse(input);
  await db.partner.update({
    where: { id: parsed.partnerId },
    data: { consumesProducts: parsed.consumesProducts },
  });
  revalidatePath(`/portal/partners/${parsed.partnerId}`);
  return { ok: true };
}

/* ── Approve sandbox ──────────────────────────────────────────── */

const SandboxDecisionInput = z.object({
  partnerId: z.string().min(1),
  reviewerNotes: z.string().max(2000).optional(),
});

export async function approveSandbox(input: z.infer<typeof SandboxDecisionInput>) {
  const ctx = await requireStaff();
  const parsed = SandboxDecisionInput.parse(input);

  const partner = await db.partner.findUnique({
    where: { id: parsed.partnerId },
    include: { users: { take: 1, orderBy: { invitedAt: "asc" } } },
  });
  if (!partner) throw new Error("PARTNER_NOT_FOUND");
  if (partner.accessStatus !== "PENDING_SANDBOX") {
    throw new Error("PARTNER_NOT_PENDING_SANDBOX");
  }

  // Link them to the platform org so the partner API can see them.
  const platformOrg = await getOrCreatePlatformOrg();
  const { raw: rawKey, hash, last4 } = generateApiKey("test");

  await db.$transaction(async (tx) => {
    await tx.partner.update({
      where: { id: partner.id },
      data: {
        accessStatus: "SANDBOX",
        sandboxApprovedAt: new Date(),
        sandboxApprovedBy: ctx.externalId,
        reviewerNotes: parsed.reviewerNotes ?? partner.reviewerNotes,
      },
    });
    // Link to platform org if not already linked (idempotent).
    await tx.partnerOrganizationLink.upsert({
      where: {
        partnerId_organizationId: {
          partnerId: partner.id,
          organizationId: platformOrg.id,
        },
      },
      update: {},
      create: { partnerId: partner.id, organizationId: platformOrg.id },
    });
    await tx.partnerApiKey.create({
      data: {
        partnerId: partner.id,
        keyHash: hash,
        last4,
        label: "Initial sandbox key",
        scopes: defaultScopesFor(partner.consumesProducts),
        env: "test",
      },
    });
  });

  const recipient = partner.users[0];
  let emailSent = true;
  let emailError: string | undefined;
  if (recipient) {
    try {
      const tmpl = sandboxApprovedTemplate({
        company: partner.name,
        rawApiKey: rawKey,
        docsUrl: PUBLIC_DOCS_URL,
        portalUrl: PORTAL_URL,
      });
      await sendMail({
        to: recipient.email,
        subject: tmpl.subject,
        text: tmpl.text,
      });
    } catch (err) {
      emailSent = false;
      emailError = err instanceof Error ? err.message : String(err);
    }
  }

  revalidatePath("/portal/partners");
  revalidatePath(`/portal/partners/${partner.id}`);

  return { ok: true, rawKey, last4, emailSent, emailError };
}

export async function rejectSandbox(input: {
  partnerId: string;
  reviewerNotes: string;
}) {
  const ctx = await requireStaff();
  const parsed = z
    .object({
      partnerId: z.string().min(1),
      reviewerNotes: z.string().min(1).max(2000),
    })
    .parse(input);

  const partner = await db.partner.findUnique({
    where: { id: parsed.partnerId },
    include: { users: { take: 1, orderBy: { invitedAt: "asc" } } },
  });
  if (!partner) throw new Error("PARTNER_NOT_FOUND");
  if (partner.accessStatus !== "PENDING_SANDBOX") {
    throw new Error("PARTNER_NOT_PENDING_SANDBOX");
  }

  await db.partner.update({
    where: { id: partner.id },
    data: {
      accessStatus: "SUSPENDED",
      reviewerNotes: parsed.reviewerNotes,
      sandboxApprovedBy: ctx.externalId,
    },
  });

  const recipient = partner.users[0];
  let emailSent = true;
  let emailError: string | undefined;
  if (recipient) {
    try {
      const tmpl = sandboxRejectedTemplate({
        company: partner.name,
        reason: parsed.reviewerNotes,
      });
      await sendMail({
        to: recipient.email,
        subject: tmpl.subject,
        text: tmpl.text,
      });
    } catch (err) {
      emailSent = false;
      emailError = err instanceof Error ? err.message : String(err);
    }
  }

  revalidatePath("/portal/partners");
  revalidatePath(`/portal/partners/${partner.id}`);
  return { ok: true, emailSent, emailError };
}

/* ── Approve production ───────────────────────────────────────── */

export async function approveProduction(input: {
  partnerId: string;
  reviewerNotes?: string;
}) {
  const ctx = await requireStaff();
  const parsed = z
    .object({
      partnerId: z.string().min(1),
      reviewerNotes: z.string().max(2000).optional(),
    })
    .parse(input);

  const partner = await db.partner.findUnique({
    where: { id: parsed.partnerId },
    include: { users: { take: 1, orderBy: { invitedAt: "asc" } } },
  });
  if (!partner) throw new Error("PARTNER_NOT_FOUND");
  if (partner.accessStatus !== "PRODUCTION_REQUESTED") {
    throw new Error("PARTNER_NOT_AWAITING_PRODUCTION");
  }

  await db.partner.update({
    where: { id: partner.id },
    data: {
      accessStatus: "PRODUCTION",
      productionApprovedAt: new Date(),
      productionApprovedBy: ctx.externalId,
      reviewerNotes: parsed.reviewerNotes ?? partner.reviewerNotes,
    },
  });

  const recipient = partner.users[0];
  let emailSent = true;
  let emailError: string | undefined;
  if (recipient) {
    try {
      const tmpl = productionApprovedTemplate({
        company: partner.name,
        portalUrl: PORTAL_URL,
      });
      await sendMail({
        to: recipient.email,
        subject: tmpl.subject,
        text: tmpl.text,
      });
    } catch (err) {
      emailSent = false;
      emailError = err instanceof Error ? err.message : String(err);
    }
  }

  revalidatePath("/portal/partners");
  revalidatePath(`/portal/partners/${partner.id}`);
  return { ok: true, emailSent, emailError };
}

export async function rejectProduction(input: {
  partnerId: string;
  reviewerNotes: string;
}) {
  const ctx = await requireStaff();
  const parsed = z
    .object({
      partnerId: z.string().min(1),
      reviewerNotes: z.string().min(1).max(2000),
    })
    .parse(input);

  const partner = await db.partner.findUnique({
    where: { id: parsed.partnerId },
    include: { users: { take: 1, orderBy: { invitedAt: "asc" } } },
  });
  if (!partner) throw new Error("PARTNER_NOT_FOUND");
  if (partner.accessStatus !== "PRODUCTION_REQUESTED") {
    throw new Error("PARTNER_NOT_AWAITING_PRODUCTION");
  }

  // Drop them back to SANDBOX so they can address the gaps and re-request.
  await db.partner.update({
    where: { id: partner.id },
    data: {
      accessStatus: "SANDBOX",
      productionRequestedAt: null,
      reviewerNotes: parsed.reviewerNotes,
      productionApprovedBy: ctx.externalId,
    },
  });

  const recipient = partner.users[0];
  let emailSent = true;
  let emailError: string | undefined;
  if (recipient) {
    try {
      const tmpl = productionRejectedTemplate({
        company: partner.name,
        reason: parsed.reviewerNotes,
        portalUrl: PORTAL_URL,
      });
      await sendMail({
        to: recipient.email,
        subject: tmpl.subject,
        text: tmpl.text,
      });
    } catch (err) {
      emailSent = false;
      emailError = err instanceof Error ? err.message : String(err);
    }
  }

  revalidatePath("/portal/partners");
  revalidatePath(`/portal/partners/${partner.id}`);
  return { ok: true, emailSent, emailError };
}
