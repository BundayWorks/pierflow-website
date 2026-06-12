import { NextResponse } from "next/server";
import { z } from "zod";
import {
  resolvePartnerSession,
  unauthorized,
  requireScope,
} from "@/lib/partnerAuth";
import {
  createEnrollment,
  listEnrollmentsByUserRef,
} from "@/lib/insurance/enrollments";

/**
 * POST /v1/enrollments
 *
 * Submit a member enrollment intent. Pierflow verifies identity,
 * computes settlement splits, and returns a PENDING_PAYMENT
 * enrollment record. The fintech is expected to debit the user's
 * wallet for `member_pays_ngn` and then call
 * POST /v1/enrollments/:id/payment-received to advance the lifecycle.
 *
 * Scope: insurance:write.
 *
 * Idempotency: pass an `idempotency_key` (any opaque string up to
 * 200 chars). The same key under the same partner returns the
 * existing enrollment for 24 hours.
 */

const Body = z.object({
  plan_id: z.string().min(1),
  quote_id: z.string().optional().nullable(),
  fintech_user_ref: z.string().trim().min(1).max(200),
  idempotency_key: z.string().trim().max(200).optional(),
  identity: z.object({
    nin: z.string().trim().min(8).max(20).optional(),
    bvn: z.string().trim().min(8).max(20).optional(),
    full_name: z.string().trim().min(1).max(200),
    date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    sex: z.enum(["M", "F", "U"]).optional(),
    phone: z.string().trim().max(40).optional(),
  }),
  effective_from: z.string().datetime().optional(),
});

export async function POST(req: Request) {
  const session = await resolvePartnerSession(req);
  if (!session) return unauthorized();
  const scopeFail = requireScope(session, "insurance:write");
  if (scopeFail) return scopeFail;

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
  if (!body.identity.nin && !body.identity.bvn) {
    return NextResponse.json(
      {
        error: "VALIDATION_ERROR",
        details: [{ path: ["identity"], message: "One of nin or bvn is required" }],
      },
      { status: 422 },
    );
  }

  const result = await createEnrollment({
    partnerId: session.partnerId,
    planId: body.plan_id,
    quoteId: body.quote_id ?? undefined,
    fintechUserRef: body.fintech_user_ref,
    idempotencyKey: body.idempotency_key,
    identity: {
      nin: body.identity.nin,
      bvn: body.identity.bvn,
      fullName: body.identity.full_name,
      dateOfBirth: body.identity.date_of_birth,
      sex: body.identity.sex,
      phone: body.identity.phone,
    },
    effectiveFrom: body.effective_from ? new Date(body.effective_from) : undefined,
  });

  if (!result.ok) {
    const status =
      result.reason === "PLAN_NOT_FOUND" ||
      result.reason === "QUOTE_NOT_FOUND_OR_EXPIRED"
        ? 404
        : result.reason === "IDENTITY_REJECTED"
          ? 422
          : result.reason === "INTERNAL"
            ? 500
            : 400;
    return NextResponse.json(
      {
        error: result.reason,
        detail: result.detail,
        issues: result.issues,
      },
      { status },
    );
  }

  return NextResponse.json(
    {
      enrollment: result.enrollment,
      identity: result.identity,
      idempotent_replay: result.idempotentReplay,
    },
    { status: 202 },
  );
}

/**
 * GET /v1/enrollments?fintech_user_ref=…
 *
 * Look up enrollments by the partner's user reference. Returns an
 * array; usually one row per user, but a user may have multiple
 * plans across time.
 */
export async function GET(req: Request) {
  const session = await resolvePartnerSession(req);
  if (!session) return unauthorized();
  const scopeFail = requireScope(session, "insurance:read");
  if (scopeFail) return scopeFail;

  const url = new URL(req.url);
  const ref = url.searchParams.get("fintech_user_ref");
  if (!ref) {
    return NextResponse.json(
      { error: "VALIDATION_ERROR", detail: "fintech_user_ref is required" },
      { status: 422 },
    );
  }
  const items = await listEnrollmentsByUserRef(session.partnerId, ref);
  return NextResponse.json({ items });
}
