"use server";

import { z } from "zod";
import { signupPartner } from "@/lib/partnerSignup";
import { PARTNER_TYPES } from "@/lib/onboarding";

const SignupSchema = z.object({
  partnerType: z.enum([
    "EMR_VENDOR",
    "HMS_VENDOR",
    "EHR_VENDOR",
    "INSURER",
    "GOVERNMENT",
    "ANALYTICS",
    "OTHER",
  ]),
  primaryUseCase: z.string().trim().min(1).max(120),
  expectedVolume: z.string().trim().min(1).max(80),
  timeline: z.string().trim().min(1).max(80),
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(200),
  company: z.string().trim().min(2).max(160),
  websiteUrl: z
    .string()
    .trim()
    .max(300)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  country: z
    .string()
    .trim()
    .length(2)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v && v.length > 0 ? v.toUpperCase() : undefined)),
  // Honeypot — populated only by bots. Server silently accepts to make
  // detection invisible.
  company_url: z.string().optional(),
});

export type SignupActionResult =
  | { ok: true; signInToken: string }
  | { ok: false; error: "EMAIL_TAKEN" }
  | { ok: false; error: "VALIDATION_ERROR"; message: string }
  | { ok: false; error: "SERVER_ERROR"; message: string };

export async function submitSignup(
  raw: unknown,
): Promise<SignupActionResult> {
  let parsed: z.infer<typeof SignupSchema>;
  try {
    parsed = SignupSchema.parse(raw);
  } catch (err) {
    const message =
      err instanceof z.ZodError
        ? err.issues.map((i) => i.message).join("; ")
        : "Invalid input.";
    return { ok: false, error: "VALIDATION_ERROR", message };
  }

  // Honeypot: silently return success-ish to bots so they can't tune.
  if (parsed.company_url && parsed.company_url.trim().length > 0) {
    return { ok: true, signInToken: "" };
  }

  if (!PARTNER_TYPES.includes(parsed.partnerType)) {
    return {
      ok: false,
      error: "VALIDATION_ERROR",
      message: "Unknown partner type.",
    };
  }

  try {
    const result = await signupPartner({
      partnerType: parsed.partnerType,
      primaryUseCase: parsed.primaryUseCase,
      expectedVolume: parsed.expectedVolume,
      timeline: parsed.timeline,
      fullName: parsed.fullName,
      email: parsed.email,
      company: parsed.company,
      websiteUrl: parsed.websiteUrl,
      country: parsed.country,
    });
    if (!result.ok) {
      if (result.reason === "EMAIL_ALREADY_REGISTERED") {
        return { ok: false, error: "EMAIL_TAKEN" };
      }
      console.error("[signup] Clerk error:", result.message);
      return { ok: false, error: "SERVER_ERROR", message: result.message };
    }
    return { ok: true, signInToken: result.signInToken };
  } catch (err) {
    console.error("[signup] unexpected:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: "SERVER_ERROR", message };
  }
}
