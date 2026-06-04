"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";

/* ── Inbox queries ──────────────────────────────────────────── */

export async function countOrganizationsAwaitingReview(): Promise<number> {
  return db.organization.count({ where: { accessStatus: "PENDING" } });
}

export type OrgListFilter =
  | "PENDING"
  | "ACTIVE"
  | "REJECTED"
  | "SUSPENDED"
  | "ALL";

export async function listOrganizations(filter?: { status?: OrgListFilter }) {
  await requireStaff();
  const status = filter?.status ?? "PENDING";
  const where = status === "ALL" ? {} : { accessStatus: status };
  return db.organization.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      name: true,
      type: true,
      country: true,
      state: true,
      lga: true,
      mrnSystem: true,
      accessStatus: true,
      createdAt: true,
      approvedAt: true,
      requestedByPartner: {
        select: { id: true, name: true, accessStatus: true },
      },
    },
  });
}

export async function getOrganization(id: string) {
  await requireStaff();
  return db.organization.findUnique({
    where: { id },
    include: {
      requestedByPartner: {
        select: { id: true, name: true, slug: true, accessStatus: true },
      },
      partnerLinks: {
        select: {
          partner: { select: { id: true, name: true, accessStatus: true } },
        },
      },
      approvalEvents: {
        orderBy: { occurredAt: "desc" },
      },
    },
  });
}

/* ── Approve / Reject / Suspend ─────────────────────────────── */

const ApproveInput = z.object({
  organizationId: z.string().min(1),
  reviewerNotes: z.string().max(2000).optional(),
});

export async function approveOrganization(
  input: z.infer<typeof ApproveInput>,
) {
  const ctx = await requireStaff();
  const parsed = ApproveInput.parse(input);

  const org = await db.organization.findUnique({
    where: { id: parsed.organizationId },
    select: {
      id: true,
      accessStatus: true,
      requestedByPartnerId: true,
    },
  });
  if (!org) throw new Error("ORG_NOT_FOUND");
  if (org.accessStatus !== "PENDING") {
    throw new Error("ORG_NOT_PENDING");
  }

  await db.$transaction(async (tx) => {
    await tx.organization.update({
      where: { id: org.id },
      data: {
        accessStatus: "ACTIVE",
        approvedByExternalId: ctx.externalId,
        approvedAt: new Date(),
        reviewerNotes: parsed.reviewerNotes ?? null,
      },
    });
    await tx.organizationApprovalEvent.create({
      data: {
        organizationId: org.id,
        action: "APPROVED",
        actorExternalId: ctx.externalId,
        notes: parsed.reviewerNotes,
      },
    });
    // Grant the requesting partner an organization link so their API
    // key can act on this org. Idempotent: if the link already exists
    // (e.g. staff pre-created one), we leave it.
    if (org.requestedByPartnerId) {
      await tx.partnerOrganizationLink.upsert({
        where: {
          partnerId_organizationId: {
            partnerId: org.requestedByPartnerId,
            organizationId: org.id,
          },
        },
        update: {},
        create: {
          partnerId: org.requestedByPartnerId,
          organizationId: org.id,
        },
      });
    }
  });

  revalidatePath("/portal/customer-orgs");
  revalidatePath(`/portal/customer-orgs/${org.id}`);
  return { ok: true };
}

const RejectInput = z.object({
  organizationId: z.string().min(1),
  rejectionReason: z.string().min(1).max(2000),
});

export async function rejectOrganization(input: z.infer<typeof RejectInput>) {
  const ctx = await requireStaff();
  const parsed = RejectInput.parse(input);

  const org = await db.organization.findUnique({
    where: { id: parsed.organizationId },
    select: { id: true, accessStatus: true },
  });
  if (!org) throw new Error("ORG_NOT_FOUND");
  if (org.accessStatus !== "PENDING") {
    throw new Error("ORG_NOT_PENDING");
  }

  await db.$transaction(async (tx) => {
    await tx.organization.update({
      where: { id: org.id },
      data: {
        accessStatus: "REJECTED",
        rejectionReason: parsed.rejectionReason,
        approvedByExternalId: ctx.externalId,
      },
    });
    await tx.organizationApprovalEvent.create({
      data: {
        organizationId: org.id,
        action: "REJECTED",
        actorExternalId: ctx.externalId,
        notes: parsed.rejectionReason,
      },
    });
  });

  revalidatePath("/portal/customer-orgs");
  revalidatePath(`/portal/customer-orgs/${org.id}`);
  return { ok: true };
}
