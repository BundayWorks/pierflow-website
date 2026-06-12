import { NextResponse } from "next/server";
import {
  resolvePartnerSession,
  unauthorized,
  requireScope,
} from "@/lib/partnerAuth";
import { getMedplum } from "@/lib/medplum";

/**
 * GET /v1/cover/Patient/:id
 *
 * Read-through to Medplum. Returns the FHIR Patient resource for the
 * given Medplum id. Requires insurance:read scope.
 */

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await resolvePartnerSession(req);
  if (!session) return unauthorized();
  const scopeFail = requireScope(session, "insurance:read");
  if (scopeFail) return scopeFail;

  const { id } = await params;

  const medplum = await getMedplum();
  if (!medplum) {
    return NextResponse.json(
      { error: "Cover is not configured on this instance." },
      { status: 503 },
    );
  }

  try {
    const patient = await medplum.readResource("Patient", id);
    return NextResponse.json(patient);
  } catch {
    return NextResponse.json(
      {
        resourceType: "OperationOutcome",
        issue: [
          {
            severity: "error",
            code: "not-found",
            diagnostics: `Patient/${id} not found in Medplum.`,
          },
        ],
      },
      { status: 404 },
    );
  }
}
