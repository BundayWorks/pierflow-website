import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rateLimit";
import { sendMail, accessRequestReceivedTemplate } from "@/lib/email";

/**
 * POST /v1/access-requests
 *
 * Public endpoint. Receives the /developers/request-access form
 * submission. Validates, applies a honeypot + per-IP rate limit, writes
 * the AccessRequest row, sends an acknowledgement email to the
 * requester, and returns 202.
 *
 * Reviewers handle the request inside the portal at
 * /portal/access-requests.
 */

const Body = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(200),
  company: z.string().trim().min(2).max(160),
  websiteUrl: z
    .string()
    .trim()
    .max(300)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  useCase: z.string().trim().min(10).max(4000),
  expectedVolume: z
    .string()
    .trim()
    .max(80)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  partnerType: z
    .enum([
      "EMR_VENDOR",
      "HMS_VENDOR",
      "EHR_VENDOR",
      "INSURER",
      "GOVERNMENT",
      "ANALYTICS",
      "OTHER",
    ])
    .default("OTHER"),
  // Honeypot — bots fill hidden fields, humans don't see it.
  // If non-empty we silently 200 to make bot detection invisible.
  company_url: z.string().optional(),
});

export async function POST(req: Request) {
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      {
        error: "VALIDATION_ERROR",
        details: err instanceof z.ZodError ? err.issues : undefined,
      },
      { status: 422 },
    );
  }

  // Honeypot. Return 202 so a bot can't tell its trick was caught.
  if (body.company_url && body.company_url.trim().length > 0) {
    return NextResponse.json(
      { status: "accepted" },
      { status: 202 },
    );
  }

  // Per-IP rate limit: 3 requests per hour.
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";
  const userAgent = req.headers.get("user-agent") ?? "";
  const limit = rateLimit({
    key: `access-request:${ip}`,
    limit: 3,
    windowSeconds: 3600,
  });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "RATE_LIMITED" },
      {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfterSeconds) },
      },
    );
  }

  const created = await db.accessRequest.create({
    data: {
      name: body.name,
      email: body.email,
      company: body.company,
      websiteUrl: body.websiteUrl,
      useCase: body.useCase,
      expectedVolume: body.expectedVolume,
      partnerType: body.partnerType,
      ipAddress: ip,
      userAgent,
    },
    select: { id: true },
  });

  // Send acknowledgement. Fire-and-forget — don't fail the submission
  // if Gmail is briefly down.
  void (async () => {
    try {
      const tmpl = accessRequestReceivedTemplate({
        name: body.name,
        company: body.company,
      });
      await sendMail({
        to: body.email,
        subject: tmpl.subject,
        text: tmpl.text,
      });
    } catch (err) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[access-requests] ack email failed:", err);
      }
    }
  })();

  return NextResponse.json(
    { status: "accepted", request_id: created.id },
    { status: 202 },
  );
}
