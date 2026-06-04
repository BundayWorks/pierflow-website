/**
 * Email helper — Gmail SMTP via Nodemailer.
 *
 * For MVP we send a small number of transactional emails (access-request
 * approval, rejection, confirmation). Gmail SMTP is rate-limited to
 * ~500/day; that's fine for this volume. Switch to Resend later if
 * volume grows.
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

export function accessRequestReceivedTemplate(input: {
  name: string;
  company: string;
}) {
  const text = `Hi ${input.name},

Thanks for requesting access to the Pierflow Records API on behalf of ${input.company}.

We've received your request and a member of the team will review it within one business day. You'll receive an email with your sandbox credentials as soon as it's approved.

If you've got context to add — a deadline, a partner relationship you'd like us to know about, or a specific integration question — just reply to this email and it'll reach the right person.

— Pierflow`;
  return {
    subject: "Your Pierflow access request",
    text,
  };
}

export function accessRequestApprovedTemplate(input: {
  name: string;
  company: string;
  rawApiKey: string;
  docsUrl: string;
  portalSignUpUrl?: string;
  approvedEmail: string;
}) {
  const signUpUrl =
    input.portalSignUpUrl ?? "https://www.pierflow.com/portal/sign-up";

  const text = `Hi ${input.name},

Your Pierflow Records API access for ${input.company} has been approved.

Sandbox API key (sk_test_*):

  ${input.rawApiKey}

Treat this like a password — Pierflow only stores its hash, so this is your single copy. Send it in the Authorization header on every request:

  curl -H "Authorization: Bearer ${input.rawApiKey}" https://www.pierflow.com/v1/organizations

Quick start: ${input.docsUrl}

You can also manage your keys, rotate credentials, and view usage in the partner portal:

  1. Sign up at ${signUpUrl} using this email address: ${input.approvedEmail}
  2. You'll land directly in your partner workspace — no extra setup required.

If anything looks off, reply to this email and we'll sort it.

— Pierflow`;

  return {
    subject: "Pierflow Records API — access approved",
    text,
  };
}

export function accessRequestRejectedTemplate(input: {
  name: string;
  company: string;
  reason: string;
}) {
  const text = `Hi ${input.name},

We've reviewed your request for Pierflow Records API access on behalf of ${input.company}, and unfortunately we're not able to approve it right now.

Reason: ${input.reason}

If circumstances change or you'd like to discuss further, reply to this email.

— Pierflow`;
  return {
    subject: "Pierflow access request — update",
    text,
  };
}
