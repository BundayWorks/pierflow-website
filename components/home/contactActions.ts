"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { rateLimit } from "@/lib/rateLimit";
import {
  sendMail,
  staffContactInquiryTemplate,
  contactInquiryAckTemplate,
} from "@/lib/email";

const ADMIN_FALLBACK = "pierflowllc@gmail.com";

const ContactInput = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(200),
  company: z.string().trim().min(2).max(160),
  country: z
    .string()
    .trim()
    .max(80)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  phone: z
    .string()
    .trim()
    .max(40)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  // Honeypot — bots fill it, humans don't see it. Server silently
  // 200s when populated so the bot can't tune its evasion.
  company_url: z.string().optional(),
});

export type ContactActionResult =
  | { ok: true }
  | { ok: false; error: "VALIDATION_ERROR"; message: string }
  | { ok: false; error: "RATE_LIMITED" }
  | { ok: false; error: "SERVER_ERROR"; message: string };

export async function submitContactInquiry(
  raw: unknown,
): Promise<ContactActionResult> {
  let parsed: z.infer<typeof ContactInput>;
  try {
    parsed = ContactInput.parse(raw);
  } catch (err) {
    const message =
      err instanceof z.ZodError
        ? err.issues.map((i) => i.message).join("; ")
        : "Invalid input.";
    return { ok: false, error: "VALIDATION_ERROR", message };
  }

  // Honeypot — silent success so the bot can't tune its evasion.
  if (parsed.company_url && parsed.company_url.trim().length > 0) {
    return { ok: true };
  }

  const hdrs = await headers();
  const ip =
    hdrs.get("x-forwarded-for")?.split(",")[0].trim() ??
    hdrs.get("x-real-ip") ??
    "unknown";

  // 5 inquiries per IP per hour is plenty for a real human and stops
  // a bot from spamming the inbox even after the honeypot bypass.
  const limit = rateLimit({
    key: `contact:${ip}`,
    limit: 5,
    windowSeconds: 3600,
  });
  if (!limit.allowed) {
    return { ok: false, error: "RATE_LIMITED" };
  }

  // Staff alert.
  const adminRecipients = (process.env.ADMIN_EMAILS ?? ADMIN_FALLBACK)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  try {
    const tmpl = staffContactInquiryTemplate({
      firstName: parsed.firstName,
      lastName: parsed.lastName,
      email: parsed.email,
      company: parsed.company,
      country: parsed.country,
      phone: parsed.phone,
      source: "homepage:get-started",
    });
    await sendMail({
      to: adminRecipients.join(", "),
      subject: tmpl.subject,
      text: tmpl.text,
      replyTo: parsed.email,
    });
  } catch (err) {
    console.error("[contact] staff alert failed:", err);
    return {
      ok: false,
      error: "SERVER_ERROR",
      message:
        "We couldn't send your message right now. Try again, or email pierflowllc@gmail.com directly.",
    };
  }

  // Best-effort ack to the visitor. Failure here doesn't fail the
  // submission — staff already got the alert and will reply.
  void (async () => {
    try {
      const tmpl = contactInquiryAckTemplate({ firstName: parsed.firstName });
      await sendMail({
        to: parsed.email,
        subject: tmpl.subject,
        text: tmpl.text,
      });
    } catch (err) {
      console.warn("[contact] ack email failed:", err);
    }
  })();

  return { ok: true };
}
