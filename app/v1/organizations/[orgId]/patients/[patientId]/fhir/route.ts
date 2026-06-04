import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  resolvePartnerSession,
  unauthorized,
  forbidden,
  notFound,
} from "@/lib/partnerAuth";
import type { FhirBundle } from "@/lib/fhir/mapper";

type FhirEntry = FhirBundle["entry"][number];

/**
 * GET /v1/organizations/:orgId/patients/:patientId/fhir
 *
 * Assembles a single FHIR R4 Bundle for a patient by merging the
 * per-record fhirBundle blobs we already stored on every ExtractedRecord
 * (built during the extraction pipeline).
 *
 * The canonical Patient row supplies the Patient resource. Other
 * resources (Encounter, Observation, Condition, MedicationRequest,
 * Practitioner, AllergyIntolerance, DiagnosticReport) are union'd from
 * every approved record. Per-record Patient/Organization entries are
 * dropped to avoid duplicates.
 *
 * Query params:
 *   include    — comma-separated resource types to include (default: all)
 *   date_from  — YYYY-MM-DD filter on Encounter.period.start
 *   date_to    — YYYY-MM-DD filter on Encounter.period.start
 */
export async function GET(
  req: Request,
  { params }: { params: { orgId: string; patientId: string } },
) {
  const session = await resolvePartnerSession(req);
  if (!session) return unauthorized();
  if (!session.organizationIds.has(params.orgId)) return forbidden();

  const patient = await db.patient.findFirst({
    where: { id: params.patientId, organizationId: params.orgId },
    select: {
      id: true,
      fullName: true,
      dateOfBirth: true,
      sex: true,
      bloodGroup: true,
      genotype: true,
      identifiers: { select: { system: true, value: true, use: true } },
      extractedRecords: {
        where: {
          validationStatus: { in: ["AUTO_APPROVED", "VALIDATED"] },
        },
        orderBy: { createdAt: "asc" },
        select: { id: true, fhirBundle: true, createdAt: true },
      },
    },
  });
  if (!patient) return notFound("PATIENT_NOT_FOUND");

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

  const entries: FhirEntry[] = [];
  const seenIds = new Set<string>();

  // 1. Canonical Patient resource
  const patientResource = {
    resourceType: "Patient" as const,
    id: patient.id,
    identifier: patient.identifiers.map((i) => ({
      system: i.system,
      value: i.value,
      use: i.use ?? undefined,
    })),
    name: [{ use: "official", text: patient.fullName, ...splitName(patient.fullName) }],
    gender:
      patient.sex === "M" ? "male" : patient.sex === "F" ? "female" : "unknown",
    birthDate: patient.dateOfBirth
      ? patient.dateOfBirth.toISOString().slice(0, 10)
      : undefined,
    extension: [
      patient.bloodGroup && {
        url: "https://pierflow.com/fhir/StructureDefinition/blood-group",
        valueCode: patient.bloodGroup,
      },
      patient.genotype && {
        url: "https://pierflow.com/fhir/StructureDefinition/genotype",
        valueCode: patient.genotype,
      },
    ].filter(Boolean),
  };
  entries.push({
    fullUrl: `Patient/${patient.id}`,
    resource: patientResource as unknown as FhirEntry["resource"],
  });
  seenIds.add(`Patient/${patient.id}`);

  // 2. Union per-record entries
  for (const record of patient.extractedRecords) {
    const bundle = record.fhirBundle as FhirBundle | null;
    if (!bundle?.entry) continue;
    for (const entry of bundle.entry) {
      const r = entry.resource as { resourceType: string; id: string };
      // Drop duplicate Patient + Organization — they're already in the
      // canonical position, or aren't part of the patient view.
      if (r.resourceType === "Patient") continue;
      if (r.resourceType === "Organization") continue;

      const dedupKey = `${r.resourceType}/${r.id}`;
      if (seenIds.has(dedupKey)) continue;

      if (include && !include.has(r.resourceType)) continue;

      // Date filter applies to Encounter.period.start
      if ((dateFrom || dateTo) && r.resourceType === "Encounter") {
        const enc = r as unknown as {
          period?: { start?: string };
        };
        const start = enc.period?.start;
        if (dateFrom && start && start < dateFrom) continue;
        if (dateTo && start && start > dateTo) continue;
      }

      seenIds.add(dedupKey);
      entries.push(entry);
    }
  }

  const bundle = {
    resourceType: "Bundle" as const,
    type: "collection" as const,
    timestamp: new Date().toISOString(),
    total: entries.length,
    entry: entries,
  };

  return NextResponse.json(bundle, { status: 200 });
}

function splitName(text: string): { family?: string; given?: string[] } {
  const parts = text.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return {};
  if (parts.length === 1) return { family: parts[0] };
  return { family: parts[parts.length - 1], given: parts.slice(0, -1) };
}
