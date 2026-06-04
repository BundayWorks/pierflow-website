/**
 * Email helper — Gmail SMTP via Nodemailer.
 *
 * For MVP we send a small number of transactional emails (signup
 * confirmation, sandbox/production approvals + rejections). Gmail SMTP
 * is rate-limited to ~500/day; that's fine for this volume. Switch to
 * Resend later if volume grows.
 */
import nodemailer from "nodemailer";

let cachedTransporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (cachedTransporter) return cachedTransporter;
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) {
    throw new Error(
      "GMAIL_USER / GMAIL_APP_PASSWORD env vars are not set — cannot send email.",
    );
  }
  cachedTransporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user, pass: pass.replace(/\s+/g, "") },
  });
  return cachedTransporter;
}

function from(): string {
  const name = process.env.EMAIL_FROM_NAME ?? "Pierflow";
  const addr = process.env.GMAIL_USER ?? "no-reply@pierflow.com";
  return `"${name}" <${addr}>`;
}

export async function sendMail(input: {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
}): Promise<{ messageId: string }> {
  const transporter = getTransporter();
  const info = await transporter.sendMail({
    from: from(),
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
    replyTo: input.replyTo,
  });
  return { messageId: info.messageId };
}

/* ── Templates ────────────────────────────────────────────────── */

export function signupReceivedTemplate(input: {
  name: string;
  company: string;
  portalUrl: string;
}) {
  const text = `Hi ${input.name},

Welcome to Pierflow. Your partner account for ${input.company} has been created.

You can sign in to the partner console anytime at ${input.portalUrl}. Right now your account is marked as awaiting sandbox approval — we'll review and let you know the moment your sandbox key is ready (usually within one business day).

In the meantime, you can complete your company profile and read through the docs from the dashboard so you're ready to start integrating the moment we approve.

— Pierflow`;
  return {
    subject: "Welcome to Pierflow",
    text,
  };
}

/**
 * Internal "new partner signed up" alert. Goes to every email in
 * ADMIN_EMAILS so the team sees the request without polling the
 * staff inbox.
 */
export function staffNewPartnerSignupTemplate(input: {
  name: string;
  email: string;
  company: string;
  partnerType: string;
  primaryUseCase?: string | null;
  expectedVolume?: string | null;
  timeline?: string | null;
  websiteUrl?: string | null;
  reviewUrl: string;
}) {
  const lines = [
    `New partner sign-up: ${input.company}`,
    "",
    `Requester:     ${input.name} <${input.email}>`,
    `Partner type:  ${input.partnerType}`,
    input.primaryUseCase ? `Use case:      ${input.primaryUseCase}` : null,
    input.expectedVolume ? `Volume:        ${input.expectedVolume}` : null,
    input.timeline ? `Timeline:      ${input.timeline}` : null,
    input.websiteUrl ? `Website:       ${input.websiteUrl}` : null,
    "",
    `Review and approve sandbox access:`,
    `  ${input.reviewUrl}`,
    "",
    "— Pierflow",
  ].filter(Boolean) as string[];
  return {
    subject: `[Pierflow] New partner: ${input.company}`,
    text: lines.join("\n"),
  };
}

/**
 * Partner invitation email — sent from our own Gmail SMTP rather than
 * Clerk's built-in delivery so we don't depend on Clerk's email setup
 * being right in every environment, and so the branding stays
 * consistent with our other transactional mails.
 */
export function partnerInvitationTemplate(input: {
  name: string;
  company: string;
  acceptUrl: string;
}) {
  const text = `Hi ${input.name || "there"},

Welcome to Pierflow. Your partner account for ${input.company} has been created. To finish setting up your account, click the link below to confirm your email and set a password:

  ${input.acceptUrl}

This link expires in 30 days. Once you're in, you'll land on your partner dashboard and can complete your onboarding checklist while our team reviews your account.

If you didn't request this, you can safely ignore this email.

— Pierflow`;
  return {
    subject: "Set up your Pierflow partner account",
    text,
  };
}

export function sandboxApprovedTemplate(input: {
  company: string;
  rawApiKey: string;
  docsUrl: string;
  portalUrl: string;
}) {
  const text = `Your Pierflow sandbox access for ${input.company} has been approved.

Sandbox API key (sk_test_*):

  ${input.rawApiKey}

Treat this like a password — Pierflow only stores its hash, so this is your single copy. The same key is also visible in your partner console under API keys.

Use it in the Authorization header on every request:

  curl -H "Authorization: Bearer ${input.rawApiKey}" https://www.pierflow.com/v1/organizations

Quick start: ${input.docsUrl}
Partner console: ${input.portalUrl}

— Pierflow`;
  return {
    subject: "Pierflow sandbox access — approved",
    text,
  };
}

export function sandboxRejectedTemplate(input: {
  company: string;
  reason: string;
}) {
  const text = `We've reviewed your Pierflow partner account for ${input.company}, and unfortunately we're not able to grant sandbox access right now.

Reason: ${input.reason}

If circumstances change or you'd like to discuss further, reply to this email.

— Pierflow`;
  return {
    subject: "Pierflow access — update",
    text,
  };
}

export function productionApprovedTemplate(input: {
  company: string;
  portalUrl: string;
}) {
  const text = `Your Pierflow production access for ${input.company} is now approved.

You can now issue live API keys (pf_live_sk_*) from the partner console at:

  ${input.portalUrl}

Live keys carry the same Authorization-header semantics as sandbox keys but call against real organisation data. Please rotate any test keys you embedded in production by accident.

— Pierflow`;
  return {
    subject: "Pierflow production access — approved",
    text,
  };
}

export function productionRejectedTemplate(input: {
  company: string;
  reason: string;
  portalUrl: string;
}) {
  const text = `We've reviewed your production access request for ${input.company} and need a few more things before we can approve it.

Reviewer notes:

${input.reason}

Your sandbox access is still active. Once you've addressed the items above, you can re-submit from the partner console:

  ${input.portalUrl}

— Pierflow`;
  return {
    subject: "Pierflow production access — needs follow-up",
    text,
  };
}
