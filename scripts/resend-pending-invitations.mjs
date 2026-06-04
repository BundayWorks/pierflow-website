// One-off: deliver invitation emails for any pending Clerk invitations
// that haven't been emailed yet (because we previously relied on Clerk's
// own delivery, which is disabled on dev instances).
//
// Run with: node --env-file=.env.local scripts/resend-pending-invitations.mjs
import { createClerkClient } from "@clerk/backend";
import nodemailer from "nodemailer";

const clerk = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.GMAIL_USER,
    pass: (process.env.GMAIL_APP_PASSWORD ?? "").replace(/\s+/g, ""),
  },
});

const fromName = process.env.EMAIL_FROM_NAME ?? "Pierflow";

const invitations = await clerk.invitations.getInvitationList({
  status: "pending",
  limit: 50,
});

for (const inv of invitations.data) {
  const meta = inv.publicMetadata ?? {};
  const firstName = typeof meta.firstName === "string" ? meta.firstName : "";
  const company = typeof meta.company === "string" ? meta.company : "your team";
  const acceptUrl = inv.url ?? "";
  if (!acceptUrl) {
    console.warn(`skipping ${inv.id} — no url`);
    continue;
  }
  const text = `Hi ${firstName || "there"},

Welcome to Pierflow. Your partner account for ${company} has been created. To finish setting up your account, click the link below to confirm your email and set a password:

  ${acceptUrl}

This link expires in 30 days. Once you're in, you'll land on your partner dashboard and can complete your onboarding checklist while our team reviews your account.

If you didn't request this, you can safely ignore this email.

— Pierflow`;
  await transporter.sendMail({
    from: `"${fromName}" <${process.env.GMAIL_USER}>`,
    to: inv.emailAddress,
    subject: "Set up your Pierflow partner account",
    text,
  });
  console.log(`sent to ${inv.emailAddress} (${inv.id})`);
}
