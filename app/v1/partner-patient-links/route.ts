import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  resolveIngestActor,
  unauthorized,
  forbidden,
  validationError,
  notFound,
} from "@/lib/ingestAuth";
import {
  linkOneByMrn,
  linkOneByPatientId,
} from "@/lib/partnerPatientLinks";

/**
 * POST /v1/partner-patient-links
 *
 * Register a single mapping between the partner's EMR-side patient id
 * and a Pierflow Patient. Two flavours:
 *
 *   - by_mrn:    { mrn, external_id, placeholder_name? }
 *                Looks up the Patient under the org's mrnSystem URI.
 *                If none exists, creates a placeholder Patient so
 *                future records flowing through extraction attach.
 *
 *   - by_patient_id: { patient_id, external_id }
 *                Direct link to an existing Pierflow patient id.
 *                Used after the partner imported records and got
 *                back the Pierflow id in a package manifest.
 *
 * Idempotent on (partner_id, patient_id): re-posting the same pair
 * returns 200 with the existing link.
 *
 * Auth: partner bearer only. Staff sessions are rejected (this is a
 * partner-facing endpoint by design).
 */

const Body = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("by_mrn"),
    organization_id: z.string().min(1),
    mrn: z.string().trim().min(1).max(120),
    external_id: z.string().trim().min(1).max(200),
    external_system: z.string().trim().url().max(300).optional().or(z.literal("")),
    placeholder_name: z.string().trim().min(2).max(200).optional(),
  }),
  z.object({
    kind: z.literal("by_patient_id"),
    organization_id: z.string().min(1),
    patient_id: z.string().min(1),
    external_id: z.string().trim().min(1).max(200),
    external_system: z.string().trim().url().max(300).optional().or(z.literal("")),
  }),
]);

export async function POST(req: Request) {
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (err) {
    return validationError(err instanceof z.ZodError ? err.issues : undefined);
  }

  const actor = await resolveIngestActor(req);
  if (!actor) return unauthorized();
  if (actor.kind !== "partner") return forbidden("PARTNER_ONLY");

  if (!actor.organizationIds.has(body.organization_id)) {
    return forbidden("ORG_NOT_LINKED");
  }
  const externalSystem =
    body.external_system && body.external_system.length > 0
      ? body.external_system
      : undefined;

  const result =
    body.kind === "by_mrn"
      ? await linkOneByMrn({
          partnerId: actor.partnerId,
          organizationId: body.organization_id,
          mrn: body.mrn,
          externalId: body.external_id,
          externalSystem,
          placeholderName: body.placeholder_name,
          source: "PARTNER_API",
        })
      : await linkOneByPatientId({
          partnerId: actor.partnerId,
          organizationId: body.organization_id,
          patientId: body.patient_id,
          externalId: body.external_id,
          externalSystem,
          source: "PARTNER_API",
        });

  if (!result.ok) {
    const status =
      result.reason === "PARTNER_NOT_LINKED_TO_ORG"
        ? 403
        : result.reason === "PATIENT_NOT_FOUND"
          ? 404
          : 409;
    return NextResponse.json(
      { error: result.reason, detail: result.detail },
      { status },
    );
  }

  return NextResponse.json(
    {
      link_id: result.linkId,
      patient_id: result.patientId,
      external_id: result.externalId,
      created_placeholder: result.createdPlaceholder,
    },
    { status: 201 },
  );
}

/**
 * GET /v1/partner-patient-links?patient_id=...&external_id=...
 *
 * Look up a mapping by either side. Returns 404 if no link exists.
 * At least one of patient_id or external_id is required.
 */
export async function GET(req: Request) {
  const actor = await resolveIngestActor(req);
  if (!actor) return unauthorized();
  if (actor.kind !== "partner") return forbidden("PARTNER_ONLY");

  const url = new URL(req.url);
  const patientId = url.searchParams.get("patient_id");
  const externalId = url.searchParams.get("external_id");
  if (!patientId && !externalId) {
    return validationError({ query: "patient_id_or_external_id_required" });
  }

  const where = patientId
    ? {
        partnerId_patientId: {
          partnerId: actor.partnerId,
          patientId,
        },
      }
    : {
        partnerId_externalId: {
          partnerId: actor.partnerId,
          externalId: externalId!,
        },
      };

  const link = await db.partnerPatientLink.findUnique({
    where,
    select: {
      id: true,
      patientId: true,
      organizationId: true,
      externalId: true,
      externalSystem: true,
      source: true,
      confidence: true,
      linkedAt: true,
    },
  });
  if (!link) return notFound("LINK_NOT_FOUND");
  if (!actor.organizationIds.has(link.organizationId)) {
    return forbidden("ORG_NOT_LINKED");
  }

  return NextResponse.json({
    link_id: link.id,
    patient_id: link.patientId,
    organization_id: link.organizationId,
    external_id: link.externalId,
    external_system: link.externalSystem,
    source: link.source,
    confidence: link.confidence,
    linked_at: link.linkedAt.toISOString(),
  });
}
