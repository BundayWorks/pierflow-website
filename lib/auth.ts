/**
 * Auth helpers that bridge Clerk identities to our domain model.
 *
 * Clerk owns identity (sign-in, sessions). Our DB decides what each
 * signed-in user is allowed to see. There are three populations:
 *
 *   STAFF    — Pierflow employees. OrgMember on the "Pierflow Platform"
 *              org with role OWNER or ADMIN. Promoted by ADMIN_EMAILS.
 *              Sees the reviewer portal (capture, review, patients,
 *              access requests, settings, …).
 *
 *   PARTNER  — Humans linked to a Partner via PartnerUser. Sees a
 *              stripped portal with just their API keys, docs, and
 *              usage. Cannot see any reviewer surface.
 *
 *   UNLINKED — Signed in but not yet authorised for anything. We send
 *              them to /portal/pending with a link to the access form.
 *
 * Important: we do NOT silently auto-provision an Organization on first
 * sign-in. That bug let anyone who signed up get a reviewer console.
 * Now, getting in requires *either* being on the admin list *or*
 * having an APPROVED access request linked via PartnerUser.
 */
import { auth, currentUser } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { getOrCreatePlatformOrg } from "@/lib/platformOrg";
import type {
  OrgMember,
  Organization,
  Partner,
  PartnerUser,
} from "@prisma/client";

/** Cookie key for the staff-side "view as partner" session. */
export const IMPERSONATION_COOKIE = "pf_impersonate";

export type StaffSession = {
  kind: "staff";
  externalId: string;
  email: string | null;
  member: OrgMember;
  organization: Organization;
};

export type PartnerSession = {
  kind: "partner";
  externalId: string;
  email: string | null;
  partnerUser: PartnerUser;
  partner: Partner;
  /**
   * Set when a Pierflow staff member is impersonating this partner.
   * Drives the amber banner in PortalShell and tags audit rows so
   * mutations are attributed to "staff acting on behalf" rather than
   * the partner themselves.
   *
   * Null on real partner sessions.
   */
  impersonatedByStaff?: {
    staffExternalId: string;
    staffEmail: string | null;
    sessionId: string;
    startedAt: string;
  } | null;
};

export type UnlinkedSession = {
  kind: "unlinked";
  externalId: string;
  email: string | null;
};

export type AnonymousSession = { kind: "anonymous" };

export type Session =
  | StaffSession
  | PartnerSession
  | UnlinkedSession
  | AnonymousSession;

/**
 * Best-effort resolver. Returns the appropriate session shape for the
 * current request. Never throws on missing/unlinked users — callers
 * handle each case explicitly (the /portal root uses this to redirect).
 */
export async function resolveSession(): Promise<Session> {
  const { userId } = await auth();
  if (!userId) return { kind: "anonymous" };

  // Pull Clerk identity once so we can both promote-to-staff and
  // back-fill partner records by email.
  let user: Awaited<ReturnType<typeof currentUser>> = null;
  try {
    user = await currentUser();
  } catch {
    // Clerk backend call can fail transiently (rate-limit, new user
    // propagation delay, network hiccup). Fall back to unlinked so
    // the caller's redirect logic handles it gracefully.
    return { kind: "unlinked", externalId: userId, email: null };
  }
  const primaryEmail =
    user?.primaryEmailAddress?.emailAddress ??
    user?.emailAddresses[0]?.emailAddress ??
    null;
  const normalizedEmail = primaryEmail?.trim().toLowerCase() ?? null;

  // ── Staff path ────────────────────────────────────────────────
  // Promote on email match (or honour an existing OrgMember on the
  // Pierflow Platform org).
  const staff = await resolveStaff({
    externalId: userId,
    email: normalizedEmail,
    displayName: buildDisplayName(user),
  });
  if (staff) {
    // Before returning the staff session, check whether this staff
    // member has an active impersonation cookie. If so, return a
    // PartnerSession with impersonatedByStaff set so the portal +
    // every server action treats them as the partner — but with the
    // staff identity preserved for audit + the banner UI.
    const impersonated = await resolveImpersonation({
      staffExternalId: userId,
      staffEmail: primaryEmail,
    });
    if (impersonated) return impersonated;

    return {
      kind: "staff",
      externalId: userId,
      email: primaryEmail,
      member: staff.member,
      organization: staff.organization,
    };
  }

  // ── Partner path ──────────────────────────────────────────────
  // Either already linked by externalId, or matched by invited email
  // (first sign-in after approval).
  const partner = await resolvePartnerUser({
    externalId: userId,
    email: normalizedEmail,
  });
  if (partner) {
    return {
      kind: "partner",
      externalId: userId,
      email: primaryEmail,
      partnerUser: partner.partnerUser,
      partner: partner.partner,
    };
  }

  return { kind: "unlinked", externalId: userId, email: primaryEmail };
}

/**
 * Strict guard for staff-only surfaces. Throws if the caller is not a
 * Pierflow staff member on the platform org.
 *
 * Note: when staff is currently impersonating a partner, this returns
 * the partner session via resolveSession — meaning a staff member
 * inside an impersonation session is locked out of staff-only routes
 * until they end the session. This is intentional. To do real staff
 * work mid-impersonation, end the session first.
 *
 * Pass `allowImpersonating: true` if a caller specifically needs to
 * see the *underlying* staff identity (e.g. the End-Impersonation
 * action itself).
 */
export async function requireStaff(opts?: {
  allowImpersonating?: boolean;
}): Promise<StaffSession> {
  const session = await resolveSession();
  if (session.kind === "staff") return session;
  if (
    opts?.allowImpersonating &&
    session.kind === "partner" &&
    session.impersonatedByStaff
  ) {
    // Reconstruct the staff session from the impersonation context.
    // We don't have the full OrgMember row handy here, but the
    // staffExternalId is enough for actions that only need to assert
    // staff-level auth.
    const staff = await resolveStaff({
      externalId: session.impersonatedByStaff.staffExternalId,
      email: session.impersonatedByStaff.staffEmail,
      displayName: null,
    });
    if (staff) {
      return {
        kind: "staff",
        externalId: session.impersonatedByStaff.staffExternalId,
        email: session.impersonatedByStaff.staffEmail,
        member: staff.member,
        organization: staff.organization,
      };
    }
  }
  const err = new Error("FORBIDDEN_NOT_STAFF") as Error & { kind: string };
  err.kind = session.kind;
  throw err;
}

/**
 * Strict guard for partner-only surfaces. Throws otherwise.
 */
export async function requirePartnerUser(): Promise<PartnerSession> {
  const session = await resolveSession();
  if (session.kind !== "partner") {
    const err = new Error("FORBIDDEN_NOT_PARTNER") as Error & { kind: string };
    err.kind = session.kind;
    throw err;
  }
  return session;
}

/* ── internal helpers ─────────────────────────────────────────── */

function adminEmailSet(): Set<string> {
  const raw = process.env.ADMIN_EMAILS ?? "";
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

async function resolveStaff(input: {
  externalId: string;
  email: string | null;
  displayName: string | null;
}): Promise<{ member: OrgMember; organization: Organization } | null> {
  const platformOrg = await getOrCreatePlatformOrg();

  // Already a member of the platform org?
  const existing = await db.orgMember.findUnique({
    where: {
      externalId_organizationId: {
        externalId: input.externalId,
        organizationId: platformOrg.id,
      },
    },
  });
  if (existing && existing.isActive) {
    return { member: existing, organization: platformOrg };
  }

  // Not a member — auto-promote only if their email is on the list.
  const admins = adminEmailSet();
  if (!input.email || !admins.has(input.email)) {
    return null;
  }

  const member = await db.orgMember.upsert({
    where: {
      externalId_organizationId: {
        externalId: input.externalId,
        organizationId: platformOrg.id,
      },
    },
    update: {
      isActive: true,
      role: "ADMIN",
      email: input.email,
      displayName: input.displayName ?? undefined,
    },
    create: {
      externalId: input.externalId,
      organizationId: platformOrg.id,
      role: "ADMIN",
      email: input.email,
      displayName: input.displayName,
    },
  });
  return { member, organization: platformOrg };
}

async function resolvePartnerUser(input: {
  externalId: string;
  email: string | null;
}): Promise<{ partnerUser: PartnerUser; partner: Partner } | null> {
  // Already linked by Clerk user id.
  const linked = await db.partnerUser.findUnique({
    where: { externalId: input.externalId },
    include: { partner: true },
  });
  if (linked) {
    if (!linked.isActive || !linked.partner.isActive) return null;
    return { partnerUser: linked, partner: linked.partner };
  }

  // Not linked yet — try to match an invited record by email.
  if (!input.email) return null;
  const invited = await db.partnerUser.findFirst({
    where: { email: input.email, externalId: null, isActive: true },
    include: { partner: true },
    orderBy: { invitedAt: "desc" },
  });
  if (!invited) return null;
  if (!invited.partner.isActive) return null;

  // Bind the Clerk user to the invited PartnerUser row. Accepting
  // the Clerk invitation proved email ownership, so tick our
  // emailVerifiedAt column at the same moment we bind.
  const bound = await db.partnerUser.update({
    where: { id: invited.id },
    data: {
      externalId: input.externalId,
      joinedAt: new Date(),
      emailVerifiedAt: invited.emailVerifiedAt ?? new Date(),
    },
  });
  return { partnerUser: bound, partner: invited.partner };
}

function buildDisplayName(user: Awaited<ReturnType<typeof currentUser>>): string | null {
  if (!user) return null;
  const joined = [user.firstName, user.lastName].filter(Boolean).join(" ");
  return joined || user.username || null;
}

/* ── Back-compat shim ─────────────────────────────────────────── */

export type SessionContext = StaffSession;

/**
 * Deprecated alias kept so existing reviewer routes don't have to be
 * touched at once. All callers should migrate to requireStaff(). This
 * preserves the old "throws if not staff" semantics.
 */
export async function requireSessionContext(): Promise<SessionContext> {
  return requireStaff();
}

/* ── Impersonation ─────────────────────────────────────────────── */

/**
 * If a valid impersonation cookie is present for this staff session,
 * return a PartnerSession with impersonatedByStaff populated.
 * Otherwise null — the caller falls back to the normal staff session.
 *
 * Stale cookies (session not found, session ended, partner deleted)
 * are tolerated silently; the staff member just sees the staff
 * portal as usual.
 */
async function resolveImpersonation(input: {
  staffExternalId: string;
  staffEmail: string | null;
}): Promise<PartnerSession | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(IMPERSONATION_COOKIE);
  if (!cookie?.value) return null;

  const sessionId = cookie.value;
  const sess = await db.impersonationSession.findUnique({
    where: { id: sessionId },
  });
  if (!sess) return null;
  if (sess.endedAt) return null;
  // Guard against cookie tampering — the cookie must match the
  // current staff member, not just any session id.
  if (sess.staffExternalId !== input.staffExternalId) return null;

  // Pull partner + a stand-in PartnerUser. The PartnerSession needs
  // a PartnerUser to satisfy callers that reference it; we attach
  // the partner's earliest invited user. Actions performed during
  // impersonation are attributed to the staff member via
  // session.impersonatedByStaff, not partnerUser.
  const partner = await db.partner.findUnique({
    where: { id: sess.partnerId },
    include: { users: { take: 1, orderBy: { invitedAt: "asc" } } },
  });
  if (!partner) return null;
  const partnerUser = partner.users[0];
  if (!partnerUser) return null;

  return {
    kind: "partner",
    externalId: input.staffExternalId,
    email: input.staffEmail,
    partnerUser,
    partner,
    impersonatedByStaff: {
      staffExternalId: sess.staffExternalId,
      staffEmail: sess.staffEmail,
      sessionId: sess.id,
      startedAt: sess.startedAt.toISOString(),
    },
  };
}
