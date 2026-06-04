/**
 * Partner sign-up: provisions a Clerk user + Partner + PartnerUser
 * record from the /get-started flow. The new Partner starts at
 * PENDING_SANDBOX — sandbox API key is issued only when Pierflow staff
 * approve, and the Partner can sign in to the portal immediately to
 * see the dashboard checklist and complete profile/security tasks.
 *
 * Email collision policy: if a Clerk user already exists with the
 * given email, we block the sign-up and ask them to log in.
 */
import { clerkClient } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { sendMail, signupReceivedTemplate } from "@/lib/email";
import type { PartnerType } from "@prisma/client";

const PORTAL_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") + "/portal" ||
  "https://www.pierflow.com/portal";

export type SignupInput = {
  // Step 1
  partnerType: PartnerType;
  // Step 2
  primaryUseCase: string;
  expectedVolume: string;
  timeline: string;
  // Step 3
  fullName: string;
  email: string;
  company: string;
  websiteUrl?: string;
  country?: string;
};

export type SignupResult =
  | {
      ok: true;
      partnerId: string;
      clerkUserId: string;
      // Single-use ticket Clerk gives us for auto-sign-in after signup.
      signInToken: string;
    }
  | {
      ok: false;
      reason: "EMAIL_ALREADY_REGISTERED";
    }
  | {
      ok: false;
      reason: "CLERK_ERROR";
      message: string;
    };

export async function signupPartner(input: SignupInput): Promise<SignupResult> {
  const email = input.email.trim().toLowerCase();
  const clerk = await clerkClient();

  // ── Email collision guard ──────────────────────────────────────
  // If a Clerk user already exists with this email, refuse — let
  // them log in instead.
  const existing = await clerk.users.getUserList({
    emailAddress: [email],
    limit: 1,
  });
  if (existing.data.length > 0) {
    return { ok: false, reason: "EMAIL_ALREADY_REGISTERED" };
  }

  // ── Create the Clerk user ──────────────────────────────────────
  const nameParts = input.fullName.trim().split(/\s+/);
  const firstName = nameParts[0] ?? "";
  const lastName = nameParts.slice(1).join(" ") || undefined;

  // Create the Clerk user with the email. Clerk's admin-create flow
  // marks the email verified by default. Immediately walk that back
  // via updateEmailAddress so the dashboard OTP flow can send a code
  // and verify ownership for real.
  let clerkUserId: string;
  let primaryEmailId: string | null = null;
  try {
    const user = await clerk.users.createUser({
      emailAddress: [email],
      firstName: firstName || undefined,
      lastName,
      skipPasswordRequirement: true,
      skipPasswordChecks: true,
    });
    clerkUserId = user.id;
    primaryEmailId =
      user.emailAddresses.find(
        (e) => e.emailAddress.toLowerCase() === email,
      )?.id ?? null;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown Clerk error";
    console.error("[signup] createUser failed:", message);
    return { ok: false, reason: "CLERK_ERROR", message };
  }

  if (primaryEmailId) {
    try {
      await clerk.emailAddresses.updateEmailAddress(primaryEmailId, {
        verified: false,
      });
    } catch (err) {
      // If Clerk refuses (e.g. "primary must be verified"), we leave
      // the email verified and rely on PartnerUser.emailVerifiedAt
      // for the gate. The dashboard widget will show
      // "already verified" and we'll handle that case there.
      console.warn(
        "[signup] could not unverify email:",
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  // ── Provision the Partner record ───────────────────────────────
  const slug =
    slugify(input.company) + "-" + Math.random().toString(36).slice(2, 8);

  const partner = await db.partner.create({
    data: {
      name: input.company,
      slug,
      type: input.partnerType,
      websiteUrl: input.websiteUrl?.trim() || null,
      country: (input.country ?? "NG").toUpperCase(),
      primaryUseCase: input.primaryUseCase,
      expectedVolume: input.expectedVolume,
      timeline: input.timeline,
      accessStatus: "PENDING_SANDBOX",
      users: {
        create: [
          {
            email,
            externalId: clerkUserId,
            role: "ADMIN",
            joinedAt: new Date(),
            isActive: true,
          },
        ],
      },
      profile: {
        create: {
          // legalName, registeredAddress, contactPhone left null —
          // partner completes these from the dashboard.
        },
      },
    },
    select: { id: true },
  });

  // ── Issue a single-use sign-in ticket ──────────────────────────
  // Lets the next page auto-sign-them-in without a password round-trip.
  let signInToken = "";
  try {
    const ticket = await clerk.signInTokens.createSignInToken({
      userId: clerkUserId,
      expiresInSeconds: 60 * 10, // 10 minutes
    });
    signInToken = ticket.token;
  } catch {
    // Non-fatal — they can still log in via the normal sign-in page.
    signInToken = "";
  }

  // ── Welcome email (best-effort) ────────────────────────────────
  void (async () => {
    try {
      const tmpl = signupReceivedTemplate({
        name: firstName || "there",
        company: input.company,
        portalUrl: PORTAL_URL,
      });
      await sendMail({ to: email, subject: tmpl.subject, text: tmpl.text });
    } catch (err) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[partner-signup] welcome email failed:", err);
      }
    }
  })();

  return {
    ok: true,
    partnerId: partner.id,
    clerkUserId,
    signInToken,
  };
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 32) || "partner";
}
