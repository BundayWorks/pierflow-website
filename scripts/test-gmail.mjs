// Standalone Gmail SMTP smoke test.
// Run with: node --env-file=.env.local scripts/test-gmail.mjs
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

console.log("verifying credentials with smtp.gmail.com...");
try {
  await transporter.verify();
  console.log("verify OK");
} catch (e) {
  console.error("verify FAIL:", e.message);
  process.exit(1);
}

console.log("sending a test email to", process.env.GMAIL_USER);
const info = await transporter.sendMail({
  from: `"${process.env.EMAIL_FROM_NAME ?? "Pierflow"}" <${process.env.GMAIL_USER}>`,
  to: process.env.GMAIL_USER,
  subject: "Pierflow SMTP smoke test",
  text: "If you can read this, Gmail SMTP is wired up correctly.",
});
console.log("sent:", info.messageId);
