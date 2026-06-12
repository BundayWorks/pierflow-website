import { NextResponse } from "next/server";
import { z } from "zod";
import {
  resolvePartnerSession,
  unauthorized,
  requireScope,
} from "@/lib/partnerAuth";
import { recordPaymentReceived } from "@/lib/insurance/enrollments";

/**
 * POST /v1/enrollments/:enrollmentId/payment-received
 *
 * The fintech reports that they've debited the user's wallet for the
 * full member_pays amount. Pierflow advances the enrollment from
 * PENDING_PAYMENT → PENDING_HMO → ACTIVE by calling the HMO
 * connector.
 *
 * Idempotent: calling twice after the enrollment is ACTIVE returns
 * the current state without re-charging.
 *
 * Scope: insurance:write.
 */

const KoboAmount = z
  .union([z.string(), z.number()])
  .transform((v) => BigInt(typeof v === "number" ? Math.round(v) : v.trim()));

const ExecutedCredit = z.object({
  role: z.enum([
    "HMO",
    "PIERFLOW",
    "EMR_VENDOR",
    "FINTECH",
    "BROKER",
    "REGULATOR_LEVY",
    "REFERRER",
    "OTHER",
  ]),
  settlement_tag: z.string().trim().max(120).nullable().optional(),
  amount_ngn: KoboAmount,
});

const Body = z.object({
  amount_ngn: KoboAmount.describe(
    "Amount debited from the user, in kobo. Must equal member_pays_ngn.",
  ),
  payment_ref: z.string().trim().max(200).optional(),
  /**
   * Optional inline executed-credit report. One row per party you
   * actually credited in your ledger. Sum should equal amount_ngn.
   * Used by Pierflow's reconciliation to match against the
   * settlement instruction we issued.
   */
  executed_credits: z.array(ExecutedCredit).max(20).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: { enrollmentId: string } },
) {
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

  const result = await recordPaymentReceived({
    enrollmentId: params.enrollmentId,
    partnerId: session.partnerId,
    amountNgn: body.amount_ngn,
    paymentRef: body.payment_ref,
    executedCredits: body.executed_credits?.map((e) => ({
      role: e.role,
      settlement_tag: e.settlement_tag ?? null,
      amount_ngn: e.amount_ngn,
    })),
  });

  if (!result.ok) {
    const status =
      result.reason === "ENROLLMENT_NOT_FOUND"
        ? 404
        : result.reason === "HMO_REJECTED"
          ? 502
          : result.reason === "INTERNAL"
            ? 500
            : 422;
    return NextResponse.json(
      { error: result.reason, detail: result.detail },
      { status },
    );
  }
  return NextResponse.json({ enrollment: result.enrollment });
}
