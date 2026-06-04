import { NextResponse } from "next/server";
import {
  resolvePartnerSession,
  unauthorized,
  forbidden,
} from "@/lib/partnerAuth";
import {
  listPatientSummaries,
  reconcileOrganizationPatients,
} from "@/lib/patientIdentity";

/**
 * GET /v1/organizations/:orgId/patients
 *
 * Returns the list of patients for an organization that the calling
 * Partner is allowed to see. Demographics + counts only; the per-patient
 * FHIR bundle comes from the next endpoint.
 *
 * Query params:
 *   limit  — page size, default 100, max 500
 *   cursor — opaque pagination cursor (patient_id)
 */
export async function GET(
  req: Request,
  { params }: { params: { orgId: string } },
) {
  const session = await resolvePartnerSession(req);
  if (!session) return unauthorized();
  if (!session.organizationIds.has(params.orgId)) return forbidden();

  const url = new URL(req.url);
  const limitParam = url.searchParams.get("limit");
  const limit = Math.max(
    1,
    Math.min(500, Number(limitParam ?? "100") || 100),
  );
  const cursor = url.searchParams.get("cursor") ?? undefined;

  // Lazy patient reconciliation: link any unlinked validated records
  // before we list. Bounded to 500 records per call so worst-case
  // latency stays reasonable.
  await reconcileOrganizationPatients(params.orgId);

  const patients = await listPatientSummaries({
    organizationId: params.orgId,
    limit,
    cursor,
  });

  return NextResponse.json(
    {
      patients,
      pagination: {
        per_page: limit,
        next_cursor:
          patients.length === limit
            ? patients[patients.length - 1].patient_id
            : null,
      },
    },
    { status: 200 },
  );
}
