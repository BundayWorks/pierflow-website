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
import {
  sendMail,
  partnerInvitationTemplate,
  staffNewPartnerSignupTemplate,
} from "@/lib/email";
import type { PartnerType } from "@prisma/client";
import { productsFor } from "@/lib/onboarding";

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
      consumesProducts: productsFor(input.partnerType),
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
  // We construct our own accept URL that points directly at our
  // sign-up route with the Clerk ticket attached. Clerk's hosted
  // accept endpoint is supposed to redirect to the configured sign-up
  // URL, but on dev instances it can end up on sign-in instead. By
  // building the link ourselves we bypass that hop entirely — the
  // <SignUp /> component reads __clerk_ticket from the URL and
  // completes the flow.
  let invitationTicket: string;
  try {
    const invitation = await clerk.invitations.createInvitation({
      emailAddress: email,
      redirectUrl: portalUrl(),
      publicMetadata: {
        firstName: firstName || undefined,
        partnerId: partner.id,
        company: input.company,
      },
      ignoreExisting: true,
      notify: false,
    });
    // invitation.url is "https://<clerk-frontend>/v1/tickets/accept?ticket=…"
    // — pull the ticket out for our own redirect.
    invitationTicket = invitation.url
      ? new URL(invitation.url).searchParams.get("ticket") ?? ""
      : "";
  } catch (err) {
    // Roll back the Partner row so a retry isn't blocked by the
    // unique email constraint on PartnerUser.
    try {
      await db.partner.delete({ where: { id: partner.id } });
    } catch {}
    const message = err instanceof Error ? err.message : "Unknown Clerk error";
    // Log full Clerk error details for debugging
    const clerkErrors = (err as Record<string, unknown>)?.errors;
    console.error("[signup] createInvitation failed:", message, {
      status: (err as Record<string, unknown>)?.status,
      errors: clerkErrors ? JSON.stringify(clerkErrors) : undefined,
      redirectUrl: portalUrl(),
      email,
    });
    return { ok: false, reason: "CLERK_ERROR", message };
  }

  if (!invitationTicket) {
    console.error(
      "[signup] Clerk returned invitation with no ticket — partner cannot accept",
    );
  }

  const siteBase =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "https://www.pierflow.com";
  const invitationUrl = `${siteBase}/portal/sign-up?__clerk_ticket=${encodeURIComponent(invitationTicket)}&redirect_url=${encodeURIComponent("/portal")}`;

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

  // ── Notify Pierflow staff ──────────────────────────────────────
  // Fire-and-forget alert to anyone in ADMIN_EMAILS so the team
  // doesn't have to poll the partners inbox. Failures are logged but
  // don't break the signup response.
  void (async () => {
    const adminRecipients = (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (adminRecipients.length === 0) return;
    try {
      const tmpl = staffNewPartnerSignupTemplate({
        name: input.fullName,
        email,
        company: input.company,
        partnerType: input.partnerType,
        primaryUseCase: input.primaryUseCase,
        expectedVolume: input.expectedVolume,
        timeline: input.timeline,
        websiteUrl: input.websiteUrl,
        reviewUrl: `${siteBase}/portal/partners/${partner.id}`,
      });
      await sendMail({
        to: adminRecipients.join(", "),
        subject: tmpl.subject,
        text: tmpl.text,
        replyTo: email,
      });
    } catch (err) {
      console.error(
        "[signup] staff alert email failed:",
        err instanceof Error ? err.message : String(err),
      );
    }
  })();

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
