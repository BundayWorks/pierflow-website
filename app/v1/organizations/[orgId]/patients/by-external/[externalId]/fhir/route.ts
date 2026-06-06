import { NextResponse } from "next/server";
import {
  resolvePartnerSession,
  unauthorized,
  forbidden,
  notFound,
} from "@/lib/partnerAuth";
import { buildPatientBundle } from "@/lib/fhir/patientBundle";
import { resolvePartnerExternalId } from "@/lib/partnerPatientLinks";

/**
 * GET /v1/organizations/:orgId/patients/by-external/:externalId/fhir
 *
 * EMR-vendor convenience: the partner hits Pierflow with *their own*
 * patient id (e.g. the row id in their EMR) and gets back the merged
 * FHIR Bundle without ever caring about Pierflow's internal patient
 * id. The mapping is resolved through PartnerPatientLink.
 *
 * Same query params as the direct patient-id route:
 *   include    — comma-separated resource types to include
 *   date_from  — YYYY-MM-DD filter on Encounter.period.start
 *   date_to    — YYYY-MM-DD filter on Encounter.period.start
 */
export async function GET(
  req: Request,
  { params }: { params: { orgId: string; externalId: string } },
) {
  const session = await resolvePartnerSession(req);
  if (!session) return unauthorized();
  if (!session.organizationIds.has(params.orgId)) return forbidden();

  const link = await resolvePartnerExternalId({
    partnerId: session.partnerId,
    organizationId: params.orgId,
    externalId: decodeURIComponent(params.externalId),
  });
  if (!link) return notFound("LINK_NOT_FOUND");

  const url = new URL(req.url);
  const includeParam = url.searchParams.get("include");
  const include = includeParam
    ? new Set(
        includeParam
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      )
    : null;
  const dateFrom = url.searchParams.get("date_from") ?? undefined;
  const dateTo = url.searchParams.get("date_to") ?? undefined;

  const bundle = await buildPatientBundle({
    organizationId: params.orgId,
    patientId: link.patientId,
    options: {
      include,
      dateFrom,
      dateTo,
      partnerIdForExternalId: session.partnerId,
    },
  });
  if (!bundle) return notFound("PATIENT_NOT_FOUND");
  return NextResponse.json(bundle, { status: 200 });
}
