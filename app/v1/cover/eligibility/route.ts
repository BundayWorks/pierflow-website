import { NextResponse } from "next/server";
import { z } from "zod";
import {
  resolvePartnerSession,
  unauthorized,
  requireScope,
} from "@/lib/partnerAuth";
import { db } from "@/lib/db";
import { getCountryProfile } from "@/lib/cover/countries/index.ts";
import {
  buildCoverageEligibilityRequest,
  buildCoverageEligibilityResponse,
} from "@/lib/cover/fhir.ts";

/**
 * POST /v1/cover/eligibility
 *
 * Hospital / provider checks member eligibility. Accepts a patient
 * identifier (enrollment id or HMO member id) and returns a FHIR R4
 * CoverageEligibilityResponse with benefit details.
 *
 * Scope: insurance:read
 */

const Body = z.object({
  /** Pierflow enrollment id or HMO member id */
  patient_identifier: z.string().trim().min(1).max(200),
  /** Which identifier system to match against. */
  identifier_type: z
    .enum(["enrollment_id", "hmo_member_id"])
    .default("enrollment_id"),
  /** Optional: restrict to a specific service type category */
  service_type: z.string().trim().max(120).optional(),
});

export async function POST(req: Request) {
  const session = await resolvePartnerSession(req);
  if (!session) return unauthorized();
  const scopeFail = requireScope(session, "insurance:read");
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

  // Look up enrollment.
  const where =
    body.identifier_type === "hmo_member_id"
      ? { hmoMemberId: body.patient_identifier }
      : { id: body.patient_identifier };

  const enrollment = await db.hmoEnrollment.findFirst({
    where: { ...where, status: "ACTIVE" },
    include: {
      plan: true,
      provider: { include: { organization: true } },
    },
  });

  if (!enrollment) {
    return NextResponse.json(
      {
        resourceType: "OperationOutcome",
        issue: [
          {
            severity: "error",
            code: "not-found",
            diagnostics: "No active enrollment found for the given identifier.",
          },
        ],
      },
      { status: 404 },
    );
  }

  const country = await getCountryProfile();
  const org = enrollment.provider.organization;

  const patientRef = `Patient/${enrollment.id}`;
  const orgRef = `Organization/${org.id}`;
  const coverageRef = `Coverage/${enrollment.id}`;

  // Build eligibility request (for the response's back-reference).
  const eligibilityRequest = buildCoverageEligibilityRequest({
    patientRef,
    coverageRef,
    orgRef,
    serviceType: body.service_type,
  });

  // Build eligibility response from plan coverage.
  const planCoverage =
    (enrollment.plan.coverage as Record<string, unknown>) ?? {};
  const isEligible = enrollment.status === "ACTIVE";

  const eligibilityResponse = buildCoverageEligibilityResponse({
    requestRef: "CoverageEligibilityRequest/inline",
    patientRef,
    orgRef,
    planCoverage,
    planName: enrollment.plan.name,
    country,
    isEligible,
  });

  return NextResponse.json({
    eligibility_request: eligibilityRequest,
    eligibility_response: eligibilityResponse,
    enrollment: {
      id: enrollment.id,
      plan_name: enrollment.plan.name,
      hmo: enrollment.provider.displayName,
      status: enrollment.status,
      effective_from: enrollment.effectiveFrom?.toISOString() ?? null,
      effective_to: enrollment.effectiveTo?.toISOString() ?? null,
    },
  });
}
