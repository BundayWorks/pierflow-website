import { NextResponse } from "next/server";
import { z } from "zod";
import {
  resolvePartnerSession,
  unauthorized,
  requireScope,
} from "@/lib/partnerAuth";
import { createClaim } from "@/lib/insurance/claims";
import { getCountryProfile } from "@/lib/cover/countries/index.ts";
import { buildClaim, buildClaimResponse, type ClaimForFhir } from "@/lib/cover/fhir.ts";

/**
 * POST /v1/cover/claims
 *
 * Hospital submits a claim via FHIR-inspired payload. Internally
 * translates to the existing createClaim() orchestrator (reuse, don't
 * rewrite). Returns FHIR Claim + ClaimResponse.
 *
 * Scope: insurance:write
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
  amount_ngn: KoboAmount,
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

  // Reuse existing createClaim orchestrator.
  const result = await createClaim({
    partnerId: session.partnerId,
    enrollmentId: body.enrollment_id,
    fintechUserRef: body.fintech_user_ref,
    serviceDate: body.service_date,
    serviceType: body.service_type ?? null,
    facilityName: body.facility_name ?? null,
    facilityNetworkProviderId: body.facility_network_provider_id ?? null,
    amountNgn: body.amount_ngn,
    diagnosisCodes: body.diagnosis_codes,
    procedureCodes: body.procedure_codes,
    notes: body.notes ?? null,
    idempotencyKey: body.idempotency_key,
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        resourceType: "OperationOutcome",
        issue: [
          {
            severity: "error",
            code: "processing",
            diagnostics: `${result.reason}${result.detail ? `: ${result.detail}` : ""}`,
          },
        ],
      },
      { status: result.reason === "ENROLLMENT_NOT_FOUND" ? 404 : 422 },
    );
  }

  // Build FHIR Claim + ClaimResponse for the response.
  const country = await getCountryProfile();
  const c = result.claim;

  const claimForFhir: ClaimForFhir = {
    id: c.id,
    enrollmentId: c.enrollment_id,
    fintechUserRef: c.fintech_user_ref,
    hmoClaimId: c.hmo_claim_id,
    serviceDate: new Date(c.service_date),
    serviceType: c.service_type,
    facilityName: c.facility_name,
    amountNgn: BigInt(c.amount_ngn),
    diagnosisCodes: c.diagnosis_codes,
    procedureCodes: c.procedure_codes,
    notes: c.notes,
    status: c.status,
    approvedAmountNgn: c.approved_amount_ngn
      ? BigInt(c.approved_amount_ngn)
      : null,
    paidAmountNgn: c.paid_amount_ngn ? BigInt(c.paid_amount_ngn) : null,
    rejectionReason: c.rejection_reason,
    createdAt: new Date(c.created_at),
  };

  const patientRef = `Patient/${c.enrollment_id}`;
  const orgRef = "Organization/insurer";

  const fhirClaim = buildClaim(claimForFhir, patientRef, orgRef, country);
  const fhirClaimResponse = buildClaimResponse(
    claimForFhir,
    `Claim/${c.id}`,
    patientRef,
    orgRef,
    country,
  );

  return NextResponse.json(
    {
      claim: result.claim,
      fhir_claim: fhirClaim,
      fhir_claim_response: fhirClaimResponse,
      idempotent_replay: result.idempotentReplay,
    },
    { status: result.idempotentReplay ? 200 : 201 },
  );
}
