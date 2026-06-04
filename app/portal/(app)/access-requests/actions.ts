"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireSessionContext } from "@/lib/auth";
import { generateApiKey } from "@/lib/partnerAuth";
import { getOrCreatePlatformOrg } from "@/lib/platformOrg";
import {
  sendMail,
  accessRequestApprovedTemplate,
  accessRequestRejectedTemplate,
} from "@/lib/email";

const PUBLIC_DOCS_URL = "https://www.pierflow.com/docs/quickstart/introduction";

/* ── List & detail ────────────────────────────────────────────── */

export async function listAccessRequests(filter?: { status?: "PENDING" | "ALL" }) {
  await requireSessionContext();
  const where =
    !filter?.status || filter.status === "PENDING"
      ? { status: "PENDING" as const }
      : {};
  return db.accessRequest.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      status: true,
      createdAt: true,
      name: true,
      email: true,
      company: true,
      partnerType: true,
      useCase: true,
      websiteUrl: true,
      expectedVolume: true,
      reviewedAt: true,
      approvedApiKeyLast4: true,
    },
  });
}

export async function getAccessRequest(id: string) {
  await requireSessionContext();
  return db.accessRequest.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      name: true,
      email: true,
      company: true,
      websiteUrl: true,
      useCase: true,
      expectedVolume: true,
      partnerType: true,
      ipAddress: true,
      userAgent: true,
      reviewedAt: true,
      reviewerNotes: true,
      reviewerExternalId: true,
      approvedApiKeyLast4: true,
      approvedPartner: {
        select: { id: true, name: true, slug: true },
      },
    },
  });
}

export async function countPendingAccessRequests(): Promise<number> {
  // Called from the staff layout after the layout has already verified
  // staff, so we don't re-check here.
  return db.accessRequest.count({ where: { status: "PENDING" } });
}

/* ── Approve ──────────────────────────────────────────────────── */

const ApproveInput = z.object({
  requestId: z.string().min(1),
  reviewerNotes: z.string().max(2000).optional(),
});

export async function approveAccessRequest(input: z.infer<typeof ApproveInput>) {
  const ctx = await requireSessionContext();
  const parsed = ApproveInput.parse(input);

  const request = await db.accessRequest.findUnique({
    where: { id: parsed.requestId },
    select: {
      id: true,
      status: true,
      name: true,
      email: true,
      company: true,
      websiteUrl: true,
      partnerType: true,
    },
  });
  if (!request) throw new Error("REQUEST_NOT_FOUND");
  if (request.status !== "PENDING") throw new Error("REQUEST_ALREADY_HANDLED");

  const platformOrg = await getOrCreatePlatformOrg();
  const { raw: rawKey, hash, last4 } = generateApiKey("test");

  const normalizedEmail = request.email.trim().toLowerCase();
  const partner = await db.$transaction(async (tx) => {
    const created = await tx.partner.create({
      data: {
        name: request.company,
        slug:
          slugify(request.company) + "-" + Math.random().toString(36).slice(2, 8),
        type: request.partnerType,
        websiteUrl: request.websiteUrl ?? undefined,
        organizationLinks: {
          create: [{ organizationId: platformOrg.id }],
        },
        apiKeys: {
          create: [
            {
              keyHash: hash,
              last4,
              label: "Issued on approval",
              scopes: ["records:read"],
            },
          ],
        },
        // Pre-authorise the requester as ADMIN of their partner. The
        // externalId fills in when they sign up at /portal/sign-up with
        // this email — handled by resolveSession() in lib/auth.ts.
        users: {
          create: [
            {
              email: normalizedEmail,
              role: "ADMIN",
              isActive: true,
            },
          ],
        },
      },
      select: { id: true, slug: true },
    });

    await tx.accessRequest.update({
      where: { id: request.id },
      data: {
        status: "APPROVED",
        approvedPartnerId: created.id,
        approvedApiKeyLast4: last4,
        reviewerExternalId: ctx.externalId,
        reviewedAt: new Date(),
        reviewerNotes: parsed.reviewerNotes ?? null,
      },
    });

    return created;
  });

  // Send the approval email with the key. Best-effort — log if SMTP
  // fails so the reviewer can resend manually.
  let emailSent = true;
  let emailError: string | undefined;
  try {
    const tmpl = accessRequestApprovedTemplate({
      name: request.name,
      company: request.company,
      rawApiKey: rawKey,
      docsUrl: PUBLIC_DOCS_URL,
      approvedEmail: request.email,
    });
    await sendMail({
      to: request.email,
      subject: tmpl.subject,
      text: tmpl.text,
    });
  } catch (err) {
    emailSent = false;
    emailError = err instanceof Error ? err.message : String(err);
    if (process.env.NODE_ENV !== "production") {
      console.warn("[access-requests] approval email failed:", err);
    }
  }

  revalidatePath("/portal/access-requests");
  revalidatePath(`/portal/access-requests/${request.id}`);

  return {
    ok: true,
    partnerId: partner.id,
    rawKey, // shown ONCE in the modal so the reviewer can copy if email failed
    last4,
    emailSent,
    emailError,
  };
}

/* ── Reject ───────────────────────────────────────────────────── */

const RejectInput = z.object({
  requestId: z.string().min(1),
  reviewerNotes: z.string().min(1).max(2000),
});

export async function rejectAccessRequest(input: z.infer<typeof RejectInput>) {
  const ctx = await requireSessionContext();
  const parsed = RejectInput.parse(input);

  const request = await db.accessRequest.findUnique({
    where: { id: parsed.requestId },
    select: {
      id: true,
      status: true,
      name: true,
      email: true,
      company: true,
    },
  });
  if (!request) throw new Error("REQUEST_NOT_FOUND");
  if (request.status !== "PENDING") throw new Error("REQUEST_ALREADY_HANDLED");

  await db.accessRequest.update({
    where: { id: request.id },
    data: {
      status: "REJECTED",
      reviewerExternalId: ctx.externalId,
      reviewedAt: new Date(),
      reviewerNotes: parsed.reviewerNotes,
    },
  });

  let emailSent = true;
  let emailError: string | undefined;
  try {
    const tmpl = accessRequestRejectedTemplate({
      name: request.name,
      company: request.company,
      reason: parsed.reviewerNotes,
    });
    await sendMail({
      to: request.email,
      subject: tmpl.subject,
      text: tmpl.text,
    });
  } catch (err) {
    emailSent = false;
    emailError = err instanceof Error ? err.message : String(err);
    if (process.env.NODE_ENV !== "production") {
      console.warn("[access-requests] rejection email failed:", err);
    }
  }

  revalidatePath("/portal/access-requests");
  revalidatePath(`/portal/access-requests/${request.id}`);
  return { ok: true, emailSent, emailError };
}

/* ── Save reviewer notes only ─────────────────────────────────── */

const SaveNotesInput = z.object({
  requestId: z.string().min(1),
  reviewerNotes: z.string().max(2000),
});

export async function saveAccessRequestNotes(input: z.infer<typeof SaveNotesInput>) {
  const ctx = await requireSessionContext();
  const parsed = SaveNotesInput.parse(input);
  await db.accessRequest.update({
    where: { id: parsed.requestId },
    data: {
      reviewerNotes: parsed.reviewerNotes || null,
      reviewerExternalId: ctx.externalId,
    },
  });
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
