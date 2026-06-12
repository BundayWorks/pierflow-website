"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireStaff, IMPERSONATION_COOKIE } from "@/lib/auth";

/**
 * Start an impersonation session as the calling staff member, scoped
 * to the partner. Writes an ImpersonationSession audit row, sets the
 * cookie, and redirects into the partner-side portal.
 *
 * Only callable from a staff session — partner sessions and
 * impersonation sessions throw FORBIDDEN_NOT_STAFF.
 */
export async function startImpersonation(partnerId: string): Promise<void> {
  const staff = await requireStaff();
  const partner = await db.partner.findUnique({
    where: { id: partnerId },
    select: { id: true, name: true },
  });
  if (!partner) throw new Error("PARTNER_NOT_FOUND");

  const hdrs = await headers();
  const ipAddress =
    hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    hdrs.get("x-real-ip") ||
    null;
  const userAgent = hdrs.get("user-agent");

  const session = await db.impersonationSession.create({
    data: {
      staffExternalId: staff.externalId,
      staffEmail: staff.email,
      partnerId: partner.id,
      partnerName: partner.name,
      ipAddress,
      userAgent,
    },
    select: { id: true },
  });

  const cookieStore = await cookies();
  cookieStore.set(IMPERSONATION_COOKIE, session.id, {
    httpOnly: true,
    sameSite: "lax",
    // Sessions expire after 4 hours by absence + audit row endedAt
    // semantics. Cookie expiry is a hard upper bound.
    maxAge: 4 * 60 * 60,
    path: "/",
    secure: process.env.NODE_ENV === "production",
  });

  redirect("/portal");
}

/**
 * End the active impersonation session. Closes the audit row and
 * clears the cookie, then redirects back to the staff partners
 * inbox.
 *
 * Uses `allowImpersonating` so it can be called from inside the
 * partner-shaped session this very cookie produces.
 */
export async function endImpersonation(): Promise<void> {
  const staff = await requireStaff({ allowImpersonating: true });
  const cookieStore = await cookies();
  const cookie = cookieStore.get(IMPERSONATION_COOKIE);
  if (cookie?.value) {
    // Best-effort close. If the session row is stale we don't fail —
    // the cookie clear below is what matters operationally.
    try {
      await db.impersonationSession.updateMany({
        where: {
          id: cookie.value,
          staffExternalId: staff.externalId,
          endedAt: null,
        },
        data: { endedAt: new Date() },
      });
    } catch {
      /* swallow */
    }
    cookieStore.delete(IMPERSONATION_COOKIE);
  }
  revalidatePath("/portal");
  redirect("/portal/partners");
}
