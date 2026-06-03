/**
 * Auth helpers that bridge Clerk identities to our domain model.
 *
 * Clerk owns the human identity (sign-in, MFA, sessions). Our DB owns
 * the multi-tenant model (Organization → OrgMember → role). This module
 * keeps the two in sync.
 */
import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import type { OrgMember, Organization } from "@prisma/client";

export type SessionContext = {
  externalId: string;
  member: OrgMember;
  organization: Organization;
};

/**
 * Ensure the current Clerk user has an OrgMember row, creating a
 * personal Organization on first sign-in if they don't already belong
 * to one. Returns the resolved session context.
 *
 * NOTE: in production, joining a real Organization happens via an
 * invitation flow. This helper handles the "fresh sign-up" case so the
 * portal never crashes on first visit.
 */
export async function getOrCreateSessionContext(): Promise<SessionContext | null> {
  const { userId } = await auth();
  if (!userId) return null;

  // Fast path: already a member somewhere.
  const existing = await db.orgMember.findFirst({
    where: { externalId: userId, isActive: true },
    include: { organization: true },
    orderBy: { createdAt: "asc" },
  });
  if (existing) {
    return {
      externalId: userId,
      member: existing,
      organization: existing.organization,
    };
  }

  // First-time sign-in: provision a personal organization.
  const user = await currentUser();
  const displayName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    user?.username ||
    user?.emailAddresses[0]?.emailAddress?.split("@")[0] ||
    "Member";
  const orgName = displayName ? `${displayName}'s workspace` : "My workspace";
  const email = user?.emailAddresses[0]?.emailAddress;

  const member = await db.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: {
        name: orgName,
        type: "OTHER",
      },
    });
    return tx.orgMember.create({
      data: {
        externalId: userId,
        organizationId: org.id,
        role: "OWNER",
        email,
        displayName,
      },
      include: { organization: true },
    });
  });

  return {
    externalId: userId,
    member,
    organization: member.organization,
  };
}

/** Strict variant — throws if no session. Use inside route handlers. */
export async function requireSessionContext(): Promise<SessionContext> {
  const ctx = await getOrCreateSessionContext();
  if (!ctx) {
    throw new Error("UNAUTHENTICATED");
  }
  return ctx;
}
