/**
 * Partner ↔ Pierflow patient-id mapping.
 *
 * Two main entry points:
 *
 *   - linkOneByMrn / linkOneByPatientId — single mapping create.
 *     `linkOneByMrn` handles the cohort-import case where the partner
 *     POSTs (mrn, external_id) pairs en masse during onboarding. If
 *     we don't have a Patient under that MRN yet, we create a
 *     placeholder one + identifier + link so future records flowing
 *     through extraction for that MRN attach automatically.
 *
 *   - linkBulk — wraps the above to handle large arrays without
 *     blowing the transaction limits.
 *
 * Every link is idempotent: re-running with the same pair returns the
 * existing row instead of failing the unique constraint.
 */
import type { PartnerPatientLinkSource } from "@prisma/client";
import { db } from "@/lib/db";

export type LinkResult =
  | {
      ok: true;
      linkId: string;
      patientId: string;
      externalId: string;
      createdPlaceholder: boolean;
    }
  | {
      ok: false;
      reason:
        | "PARTNER_NOT_LINKED_TO_ORG"
        | "PATIENT_NOT_FOUND"
        | "DIFFERENT_PATIENT_ALREADY_LINKED"
        | "EXTERNAL_ID_TAKEN_BY_ANOTHER_PATIENT"
        | "MRN_REQUIRED"
        | "EXTERNAL_ID_REQUIRED";
      detail?: string;
    };

/**
 * Link a partner's externalId to an existing Patient by Pierflow's
 * own patient id. Used by the staff-side reviewer flow and by
 * acknowledge-flow when partners return ids for patients we already
 * sent them.
 */
export async function linkOneByPatientId(input: {
  partnerId: string;
  organizationId: string;
  patientId: string;
  externalId: string;
  externalSystem?: string | null;
  source: PartnerPatientLinkSource;
  linkedByExternalId?: string | null;
  confidence?: number;
}): Promise<LinkResult> {
  const externalId = input.externalId.trim();
  if (!externalId) return { ok: false, reason: "EXTERNAL_ID_REQUIRED" };

  // The partner must be linked to the org. Belt-and-suspenders: the
  // caller will already have asserted this via ingestAuth, but the
  // library is exposed enough that we re-check.
  const orgLink = await db.partnerOrganizationLink.findUnique({
    where: {
      partnerId_organizationId: {
        partnerId: input.partnerId,
        organizationId: input.organizationId,
      },
    },
    select: { partnerId: true },
  });
  if (!orgLink) return { ok: false, reason: "PARTNER_NOT_LINKED_TO_ORG" };

  const patient = await db.patient.findUnique({
    where: { id: input.patientId },
    select: { id: true, organizationId: true },
  });
  if (!patient || patient.organizationId !== input.organizationId) {
    return { ok: false, reason: "PATIENT_NOT_FOUND" };
  }

  return upsertLink({
    partnerId: input.partnerId,
    organizationId: input.organizationId,
    patientId: input.patientId,
    externalId,
    externalSystem: input.externalSystem,
    source: input.source,
    linkedByExternalId: input.linkedByExternalId,
    confidence: input.confidence,
    createdPlaceholder: false,
  });
}

/**
 * Link a partner's externalId to a Patient identified by an MRN under
 * the org's `mrnSystem` URI. If no Patient has that MRN yet, create a
 * placeholder Patient + PatientIdentifier so future extracted records
 * with the same MRN auto-attach.
 */
export async function linkOneByMrn(input: {
  partnerId: string;
  organizationId: string;
  mrn: string;
  externalId: string;
  externalSystem?: string | null;
  // If the caller supplies a name, we use it for the placeholder Patient.
  // Otherwise the placeholder gets "Unknown (linked by partner)".
  placeholderName?: string | null;
  source?: PartnerPatientLinkSource;
  linkedByExternalId?: string | null;
}): Promise<LinkResult> {
  const externalId = input.externalId.trim();
  const mrn = input.mrn.trim();
  if (!externalId) return { ok: false, reason: "EXTERNAL_ID_REQUIRED" };
  if (!mrn) return { ok: false, reason: "MRN_REQUIRED" };

  const orgLink = await db.partnerOrganizationLink.findUnique({
    where: {
      partnerId_organizationId: {
        partnerId: input.partnerId,
        organizationId: input.organizationId,
      },
    },
    select: { partnerId: true },
  });
  if (!orgLink) return { ok: false, reason: "PARTNER_NOT_LINKED_TO_ORG" };

  const org = await db.organization.findUnique({
    where: { id: input.organizationId },
    select: { mrnSystem: true },
  });
  const mrnSystem = org?.mrnSystem ?? "https://pierflow.com/mrn";

  const existingIdent = await db.patientIdentifier.findFirst({
    where: {
      system: mrnSystem,
      value: mrn,
      patient: { organizationId: input.organizationId },
    },
    select: { patientId: true },
  });

  let patientId: string;
  let createdPlaceholder = false;
  if (existingIdent) {
    patientId = existingIdent.patientId;
  } else {
    // Placeholder Patient — name TBD when records flow through later.
    const placeholderName =
      input.placeholderName?.trim() ||
      `Unknown (linked by partner · MRN ${mrn})`;
    const created = await db.patient.create({
      data: {
        organizationId: input.organizationId,
        fullName: placeholderName,
        identifiers: {
          create: [{ system: mrnSystem, value: mrn }],
        },
      },
      select: { id: true },
    });
    patientId = created.id;
    createdPlaceholder = true;
  }

  return upsertLink({
    partnerId: input.partnerId,
    organizationId: input.organizationId,
    patientId,
    externalId,
    externalSystem: input.externalSystem,
    source:
      input.source ??
      (createdPlaceholder ? "PLACEHOLDER_FROM_MRN" : "AUTO_MRN"),
    linkedByExternalId: input.linkedByExternalId,
    createdPlaceholder,
  });
}

async function upsertLink(input: {
  partnerId: string;
  organizationId: string;
  patientId: string;
  externalId: string;
  externalSystem?: string | null;
  source: PartnerPatientLinkSource;
  linkedByExternalId?: string | null;
  confidence?: number;
  createdPlaceholder: boolean;
}): Promise<LinkResult> {
  // Check for the (partner, externalId) collision first — if the
  // partner has already claimed this externalId for a *different*
  // patient, surface that explicitly instead of letting Prisma error.
  const collision = await db.partnerPatientLink.findUnique({
    where: {
      partnerId_externalId: {
        partnerId: input.partnerId,
        externalId: input.externalId,
      },
    },
    select: { patientId: true, id: true },
  });
  if (collision && collision.patientId !== input.patientId) {
    return {
      ok: false,
      reason: "EXTERNAL_ID_TAKEN_BY_ANOTHER_PATIENT",
      detail: `externalId ${input.externalId} is already linked to patient ${collision.patientId}`,
    };
  }

  // (partner, patient) collision — partner can't have two external ids
  // for the same patient.
  const reverse = await db.partnerPatientLink.findUnique({
    where: {
      partnerId_patientId: {
        partnerId: input.partnerId,
        patientId: input.patientId,
      },
    },
    select: { id: true, externalId: true },
  });
  if (reverse && reverse.externalId !== input.externalId) {
    return {
      ok: false,
      reason: "DIFFERENT_PATIENT_ALREADY_LINKED",
      detail: `patient ${input.patientId} is already linked to externalId ${reverse.externalId}`,
    };
  }

  // Idempotent upsert on (partner, patient). If both reverse and
  // collision point at the same row, this updates a no-op.
  const link = await db.partnerPatientLink.upsert({
    where: {
      partnerId_patientId: {
        partnerId: input.partnerId,
        patientId: input.patientId,
      },
    },
    update: {
      externalId: input.externalId,
      externalSystem: input.externalSystem ?? null,
      source: input.source,
      linkedByExternalId: input.linkedByExternalId ?? null,
      confidence: input.confidence ?? 1.0,
    },
    create: {
      partnerId: input.partnerId,
      patientId: input.patientId,
      organizationId: input.organizationId,
      externalId: input.externalId,
      externalSystem: input.externalSystem ?? null,
      source: input.source,
      linkedByExternalId: input.linkedByExternalId ?? null,
      confidence: input.confidence ?? 1.0,
    },
    select: { id: true },
  });

  return {
    ok: true,
    linkId: link.id,
    patientId: input.patientId,
    externalId: input.externalId,
    createdPlaceholder: input.createdPlaceholder,
  };
}

/**
 * Bulk variant — partner-friendly for cohort imports. Caps at 500
 * items per call so we don't lock the database for minutes; the
 * partner is expected to page above that.
 */
export const BULK_MAX = 500;

export type BulkLinkItem =
  | {
      kind: "mrn";
      mrn: string;
      externalId: string;
      placeholderName?: string | null;
    }
  | {
      kind: "patient";
      patientId: string;
      externalId: string;
    };

export type BulkLinkOutcome = {
  ok: boolean;
  patientId?: string;
  externalId: string;
  reason?: string;
  detail?: string;
  createdPlaceholder?: boolean;
  linkId?: string;
};

export async function linkBulk(input: {
  partnerId: string;
  organizationId: string;
  items: BulkLinkItem[];
  externalSystem?: string | null;
  source?: PartnerPatientLinkSource;
  linkedByExternalId?: string | null;
}): Promise<{
  results: BulkLinkOutcome[];
  ok: number;
  failed: number;
}> {
  if (input.items.length > BULK_MAX) {
    throw new Error(`BULK_MAX_EXCEEDED: ${input.items.length} > ${BULK_MAX}`);
  }

  const results: BulkLinkOutcome[] = [];
  let ok = 0;
  let failed = 0;

  for (const item of input.items) {
    try {
      const r =
        item.kind === "mrn"
          ? await linkOneByMrn({
              partnerId: input.partnerId,
              organizationId: input.organizationId,
              mrn: item.mrn,
              externalId: item.externalId,
              externalSystem: input.externalSystem,
              placeholderName: item.placeholderName,
              source: input.source,
              linkedByExternalId: input.linkedByExternalId,
            })
          : await linkOneByPatientId({
              partnerId: input.partnerId,
              organizationId: input.organizationId,
              patientId: item.patientId,
              externalId: item.externalId,
              externalSystem: input.externalSystem,
              source: input.source ?? "PARTNER_API",
              linkedByExternalId: input.linkedByExternalId,
            });
      if (r.ok) {
        ok++;
        results.push({
          ok: true,
          patientId: r.patientId,
          externalId: r.externalId,
          createdPlaceholder: r.createdPlaceholder,
          linkId: r.linkId,
        });
      } else {
        failed++;
        results.push({
          ok: false,
          externalId: item.externalId,
          reason: r.reason,
          detail: "detail" in r ? r.detail : undefined,
        });
      }
    } catch (err) {
      failed++;
      results.push({
        ok: false,
        externalId: item.externalId,
        reason: "SERVER_ERROR",
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return { results, ok, failed };
}

/**
 * Resolve the partner's view of a patient: given an externalId the
 * partner sent us, return our patientId (or null). Used by the
 * `by-external` FHIR shortcut.
 */
export async function resolvePartnerExternalId(input: {
  partnerId: string;
  organizationId: string;
  externalId: string;
}): Promise<{ patientId: string; linkId: string } | null> {
  const link = await db.partnerPatientLink.findUnique({
    where: {
      partnerId_externalId: {
        partnerId: input.partnerId,
        externalId: input.externalId,
      },
    },
    select: { id: true, patientId: true, organizationId: true },
  });
  if (!link) return null;
  if (link.organizationId !== input.organizationId) return null;
  return { patientId: link.patientId, linkId: link.id };
}

/**
 * Look up the link for one of our patient ids — used when emitting the
 * partner's externalId as a FHIR Identifier on Bundle responses.
 */
export async function resolveLinkForPatient(input: {
  partnerId: string;
  patientId: string;
}): Promise<{
  externalId: string;
  externalSystem: string | null;
} | null> {
  const link = await db.partnerPatientLink.findUnique({
    where: {
      partnerId_patientId: {
        partnerId: input.partnerId,
        patientId: input.patientId,
      },
    },
    select: { externalId: true, externalSystem: true },
  });
  if (!link) return null;
  return { externalId: link.externalId, externalSystem: link.externalSystem };
}
