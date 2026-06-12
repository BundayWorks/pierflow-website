import { NextResponse } from "next/server";
import { z } from "zod";
import {
  resolvePartnerSession,
  unauthorized,
  requireScope,
} from "@/lib/partnerAuth";
import { createClaim, listClaimsByUserRef } from "@/lib/insurance/claims";

/**
 * POST /v1/claims
 *
 * Submit a claim against an ACTIVE enrollment. The claim is
 * forwarded to the HMO connector; status moves SUBMITTED →
 * PENDING_HMO → UNDER_REVIEW → APPROVED → PAID (or REJECTED at any
 * step) via the poll-claims cron.
 *
 * Idempotency: pass `idempotency_key`. Same key under the same
 * partner returns the existing claim row.
 *
 * Scope: insurance:write.
 */

const KoboAmount = z
  .union([z.string(), z.number()])
  .transform((v) => BigInt(typeof v === "number" ? Math.round(v) : v.trim()));

const Body = z.object({
  enrollment_id: z.string().min(1),
  fintech_user_ref: z.string().trim().min(1).max(200),
  service_date: z.string().regex(/^\d{4}-\d{2}-\d{2}/),
  service_type: z.string().trim().max(120).optional().nullable(),
  facility_name: z.string().trim().max(200).optional().nullable(),
  facility_network_provider_id: z.string().trim().optional().nullable(),
  amount_ngn: KoboAmount.describe(
    "Claimed amount in kobo. Positive integer.",
  ),
  diagnosis_codes: z.array(z.string().trim().min(1).max(40)).min(1).max(20),
  procedure_codes: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  notes: z.string().trim().max(2000).optional().nullable(),
  idempotency_key: z.string().trim().max(200).optional(),
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

  const result = await createClaim({
    partnerId: session.partnerId,
    enrollmentId: body.enrollment_id,
    fintechUserRef: body.fintech_user_ref,
    serviceDate: body.service_date,
    serviceType: body.service_type,
    facilityName: body.facility_name,
    facilityNetworkProviderId: body.facility_network_provider_id,
    amountNgn: body.amount_ngn,
    diagnosisCodes: body.diagnosis_codes,
    procedureCodes: body.procedure_codes,
    notes: body.notes,
    idempotencyKey: body.idempotency_key,
  });
  if (!result.ok) {
    const status =
      result.reason === "ENROLLMENT_NOT_FOUND"
        ? 404
        : result.reason === "ENROLLMENT_NOT_ACTIVE"
          ? 422
          : result.reason === "CONNECTOR_REFUSED"
            ? 502
            : 500;
    return NextResponse.json(
      { error: result.reason, detail: result.detail },
      { status },
    );
  }
  return NextResponse.json(
    { claim: result.claim, idempotent_replay: result.idempotentReplay },
    { status: 202 },
  );
}

/**
 * GET /v1/claims?fintech_user_ref=…
 *
 * List a user's claims across all enrollments. Scope: insurance:read.
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
  const items = await listClaimsByUserRef(session.partnerId, ref);
  return NextResponse.json({ items });
}
