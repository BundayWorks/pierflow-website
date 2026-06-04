/**
 * Partner sign-up: provisions a Partner + PartnerUser record from the
 * /get-started flow and sends a Clerk invitation email so the partner
 * can set a password on Clerk's hosted page. Email verification is
 * implicit in accepting the invitation, so we don't need a separate
 * OTP step on the dashboard.
 *
 * The new Partner starts at PENDING_SANDBOX — the sandbox API key is
 * still only issued after Pierflow staff approval, but once the partner
 * accepts the invite they can sign in immediately and see the dashboard
 * checklist while we review.
 *
 * Email collision policy: if a Clerk user OR a pending invitation
 * already exists for the email, block sign-up and ask them to log in.
 */
import { clerkClient } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { sendMail, partnerInvitationTemplate } from "@/lib/email";
import type { PartnerType } from "@prisma/client";

function portalUrl(): string {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "https://www.pierflow.com";
  return `${base}/portal`;
}

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
      email: string;
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

  // ── Collision guards ────────────────────────────────────────────
  // Block if a Clerk user already exists, or if an unaccepted
  // invitation is already pending.
  const existingUsers = await clerk.users.getUserList({
    emailAddress: [email],
    limit: 1,
  });
  if (existingUsers.data.length > 0) {
    return { ok: false, reason: "EMAIL_ALREADY_REGISTERED" };
  }
  try {
    const pending = await clerk.invitations.getInvitationList({
      status: "pending",
      query: email,
      limit: 5,
    });
    const match = pending.data.find(
      (inv) => inv.emailAddress.toLowerCase() === email,
    );
    if (match) {
      return { ok: false, reason: "EMAIL_ALREADY_REGISTERED" };
    }
  } catch {
    // Non-fatal — if invitations API fails we fall through and let
    // Clerk's createInvitation surface a duplicate error below.
  }

  // ── Provision the Partner record (no Clerk user yet) ────────────
  const nameParts = input.fullName.trim().split(/\s+/);
  const firstName = nameParts[0] ?? "";

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
            // externalId is bound on first sign-in (after accepting the
            // invite) by lib/auth.resolvePartnerUser().
            externalId: null,
            role: "ADMIN",
            isActive: true,
          },
        ],
      },
      profile: { create: {} },
    },
    select: { id: true },
  });

  // ── Create the Clerk invitation ─────────────────────────────────
  // Clerk hands us a ticket URL. The user clicks it → Clerk's hosted
  // sign-up page → they set a password → Clerk marks the email
  // verified by virtue of accepting → redirects to /portal. On first
  // /portal hit, resolveSession binds the new Clerk userId to this
  // PartnerUser by email match and sets emailVerifiedAt.
  //
  // We pass notify: false so Clerk doesn't try to send the email —
  // we deliver it ourselves via Gmail SMTP so the branding matches
  // the rest of our transactional mail and so delivery doesn't depend
  // on Clerk's email setup being right in dev.
  let invitationUrl: string;
  try {
    const invitation = await clerk.invitations.createInvitation({
      emailAddress: email,
      redirectUrl: portalUrl(),
      publicMetadata: {
        firstName: firstName || undefined,
        partnerId: partner.id,
        company: input.company,
      },
      ignoreExisting: false,
      notify: false,
    });
    invitationUrl = invitation.url ?? "";
  } catch (err) {
    // Roll back the Partner row so a retry isn't blocked by the
    // unique email constraint on PartnerUser.
    try {
      await db.partner.delete({ where: { id: partner.id } });
    } catch {}
    const message = err instanceof Error ? err.message : "Unknown Clerk error";
    console.error("[signup] createInvitation failed:", message);
    return { ok: false, reason: "CLERK_ERROR", message };
  }

  if (!invitationUrl) {
    console.error(
      "[signup] Clerk returned invitation with empty url — partner cannot accept",
    );
  }

  // ── Send the invitation email ourselves ────────────────────────
  try {
    const tmpl = partnerInvitationTemplate({
      name: firstName || "",
      company: input.company,
      acceptUrl: invitationUrl,
    });
    await sendMail({ to: email, subject: tmpl.subject, text: tmpl.text });
  } catch (err) {
    // Best-effort. The Partner row is already created and the Clerk
    // invitation exists; staff can resend manually if needed.
    console.error(
      "[signup] invitation email send failed:",
      err instanceof Error ? err.message : String(err),
    );
  }

  return { ok: true, partnerId: partner.id, email };
}

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 32) || "partner"
  );
}
