/**
 * Cover bridge — upserts Pierflow data as FHIR R4 resources in Medplum.
 *
 * Each sync* function:
 *   1. Builds the FHIR resource via lib/cover/fhir.ts
 *   2. Upserts to Medplum using conditional create (identifier match)
 *   3. Returns the Medplum resource id (or null if Cover is not configured)
 *
 * All functions are idempotent. Re-running with the same Pierflow id
 * updates the existing Medplum resource.
 */

import { getMedplum } from "@/lib/medplum";
import { getCountryProfile } from "@/lib/cover/countries/index.ts";
import {
  buildPatient,
  buildOrganization,
  buildCoverage,
  buildClaim,
  buildClaimResponse,
  buildExplanationOfBenefit,
  type EnrollmentForFhir,
  type ClaimForFhir,
  type OrgForFhir,
} from "@/lib/cover/fhir.ts";

const PIERFLOW = "https://pierflow.com/cover";

// ─────────────────────────────────────────────────────────────────────
// Upsert helper
// ─────────────────────────────────────────────────────────────────────

/**
 * Create-if-none-exist or update. Uses the Pierflow system identifier
 * as the match key so we get idempotent upserts.
 */
async function upsertResource(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  resource: any,
  system: string,
  value: string,
): Promise<string | null> {
  const medplum = await getMedplum();
  if (!medplum) return null;

  // Try to find existing resource by identifier.
  const bundle = await medplum.search(resource.resourceType, {
    identifier: `${system}|${value}`,
    _count: "1",
  });

  const existing = bundle.entry?.[0]?.resource;
  if (existing?.id) {
    // Update existing.
    const updated = await medplum.updateResource({
      ...resource,
      id: existing.id,
    });
    return updated.id ?? null;
  }

  // Create new.
  const created = await medplum.createResource(resource);
  return created.id ?? null;
}

// ─────────────────────────────────────────────────────────────────────
// Public sync functions
// ─────────────────────────────────────────────────────────────────────

export async function syncOrganizationToMedplum(
  org: OrgForFhir,
): Promise<string | null> {
  const resource = buildOrganization(org);
  return upsertResource(
    resource,
    `${PIERFLOW}/organization`,
    org.id,
  );
}

export async function syncPatientToMedplum(
  enrollment: EnrollmentForFhir,
): Promise<string | null> {
  const country = await getCountryProfile();
  const resource = buildPatient(enrollment, country);
  return upsertResource(
    resource,
    `${PIERFLOW}/enrollment`,
    enrollment.id,
  );
}

export async function syncCoverageToMedplum(
  enrollment: EnrollmentForFhir,
  patientMedplumId: string,
  orgMedplumId: string,
): Promise<string | null> {
  const country = await getCountryProfile();
  const resource = buildCoverage(
    enrollment,
    `Patient/${patientMedplumId}`,
    `Organization/${orgMedplumId}`,
    country,
  );
  return upsertResource(
    resource,
    `${PIERFLOW}/coverage`,
    enrollment.id,
  );
}

export async function syncClaimToMedplum(
  claim: ClaimForFhir,
  patientMedplumId: string,
  orgMedplumId: string,
): Promise<string | null> {
  const country = await getCountryProfile();
  const resource = buildClaim(
    claim,
    `Patient/${patientMedplumId}`,
    `Organization/${orgMedplumId}`,
    country,
  );
  return upsertResource(resource, `${PIERFLOW}/claim`, claim.id);
}

export async function syncClaimResponseToMedplum(
  claim: ClaimForFhir,
  claimMedplumId: string,
  patientMedplumId: string,
  orgMedplumId: string,
): Promise<string | null> {
  const country = await getCountryProfile();
  const resource = buildClaimResponse(
    claim,
    `Claim/${claimMedplumId}`,
    `Patient/${patientMedplumId}`,
    `Organization/${orgMedplumId}`,
    country,
  );
  return upsertResource(
    resource,
    `${PIERFLOW}/claim/response`,
    claim.id,
  );
}

export async function syncEobToMedplum(
  claim: ClaimForFhir,
  enrollment: EnrollmentForFhir,
  claimMedplumId: string,
  patientMedplumId: string,
  orgMedplumId: string,
): Promise<string | null> {
  const country = await getCountryProfile();
  const resource = buildExplanationOfBenefit(
    claim,
    enrollment,
    `Claim/${claimMedplumId}`,
    `Patient/${patientMedplumId}`,
    `Organization/${orgMedplumId}`,
    country,
  );
  return upsertResource(
    resource,
    `${PIERFLOW}/claim/eob`,
    claim.id,
  );
}
