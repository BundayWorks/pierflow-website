/**
 * Build a per-patient FHIR R4 Bundle by merging every approved
 * ExtractedRecord on that Patient into one document.
 *
 * Used by:
 *   - GET /v1/organizations/:orgId/patients/:patientId/fhir
 *   - GET /v1/organizations/:orgId/patients/by-external/:externalId/fhir
 *
 * Optional `partnerId` lets us include the partner's external id as a
 * third Identifier so an EMR vendor can round-trip the mapping
 * without out-of-band state.
 */
import { db } from "@/lib/db";
import type { FhirBundle } from "@/lib/fhir/mapper";
import { resolveLinkForPatient } from "@/lib/partnerPatientLinks";

type FhirEntry = FhirBundle["entry"][number];

export type BuildOptions = {
  include?: Set<string> | null;
  dateFrom?: string;
  dateTo?: string;
  /**
   * If set, the resulting Patient.identifier array gains a third
   * entry pointing at the partner's external id (and externalSystem
   * URI, if claimed).
   */
  partnerIdForExternalId?: string;
};

export async function buildPatientBundle(input: {
  organizationId: string;
  patientId: string;
  options?: BuildOptions;
}): Promise<FhirBundle | null> {
  const patient = await db.patient.findFirst({
    where: { id: input.patientId, organizationId: input.organizationId },
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
  if (!patient) return null;

  const include = input.options?.include ?? null;
  const dateFrom = input.options?.dateFrom;
  const dateTo = input.options?.dateTo;

  const entries: FhirEntry[] = [];
  const seenIds = new Set<string>();

  const identifiers = patient.identifiers.map((i) => ({
    system: i.system,
    value: i.value,
    use: i.use ?? undefined,
  }));

  if (input.options?.partnerIdForExternalId) {
    const partnerLink = await resolveLinkForPatient({
      partnerId: input.options.partnerIdForExternalId,
      patientId: patient.id,
    });
    if (partnerLink) {
      identifiers.push({
        system:
          partnerLink.externalSystem ?? "https://pierflow.com/partner-external",
        value: partnerLink.externalId,
        use: "secondary",
      });
    }
  }

  // 1. Canonical Patient resource
  const patientResource = {
    resourceType: "Patient" as const,
    id: patient.id,
    identifier: identifiers,
    name: [
      {
        use: "official",
        text: patient.fullName,
        ...splitName(patient.fullName),
      },
    ],
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
      if (r.resourceType === "Patient") continue;
      if (r.resourceType === "Organization") continue;
      const dedupKey = `${r.resourceType}/${r.id}`;
      if (seenIds.has(dedupKey)) continue;
      if (include && !include.has(r.resourceType)) continue;
      if ((dateFrom || dateTo) && r.resourceType === "Encounter") {
        const enc = r as unknown as { period?: { start?: string } };
        const start = enc.period?.start;
        if (dateFrom && start && start < dateFrom) continue;
        if (dateTo && start && start > dateTo) continue;
      }
      seenIds.add(dedupKey);
      entries.push(entry);
    }
  }

  return {
    resourceType: "Bundle" as const,
    type: "collection" as const,
    timestamp: new Date().toISOString(),
    total: entries.length,
    entry: entries,
  };
}

function splitName(text: string): { family?: string; given?: string[] } {
  const parts = text.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return {};
  if (parts.length === 1) return { family: parts[0] };
  return { family: parts[parts.length - 1], given: parts.slice(0, -1) };
}
