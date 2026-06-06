import { NextResponse } from "next/server";
import { z } from "zod";
import {
  resolveIngestActor,
  unauthorized,
  forbidden,
  validationError,
} from "@/lib/ingestAuth";
import { linkBulk, BULK_MAX } from "@/lib/partnerPatientLinks";

/**
 * POST /v1/partner-patient-links/bulk
 *
 * Cohort-migration entry point. Partners POST up to 500 mapping items
 * at a time, mixing by_mrn and by_patient_id flavours. Response
 * mirrors each input item with ok / reason so partners can retry only
 * the failures.
 */

const Item = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("by_mrn"),
    mrn: z.string().trim().min(1).max(120),
    external_id: z.string().trim().min(1).max(200),
    placeholder_name: z.string().trim().min(2).max(200).optional(),
  }),
  z.object({
    kind: z.literal("by_patient_id"),
    patient_id: z.string().min(1),
    external_id: z.string().trim().min(1).max(200),
  }),
]);

const Body = z.object({
  organization_id: z.string().min(1),
  external_system: z
    .string()
    .trim()
    .url()
    .max(300)
    .optional()
    .or(z.literal("")),
  items: z.array(Item).min(1).max(BULK_MAX),
});

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

  const result = await linkBulk({
    partnerId: actor.partnerId,
    organizationId: body.organization_id,
    externalSystem,
    source: "PARTNER_API",
    items: body.items.map((it) =>
      it.kind === "by_mrn"
        ? {
            kind: "mrn" as const,
            mrn: it.mrn,
            externalId: it.external_id,
            placeholderName: it.placeholder_name,
          }
        : {
            kind: "patient" as const,
            patientId: it.patient_id,
            externalId: it.external_id,
          },
    ),
  });

  return NextResponse.json(
    {
      ok_count: result.ok,
      failed_count: result.failed,
      results: result.results.map((r) => ({
        ok: r.ok,
        patient_id: r.patientId,
        external_id: r.externalId,
        reason: r.reason,
        detail: r.detail,
        created_placeholder: r.createdPlaceholder,
        link_id: r.linkId,
      })),
    },
    { status: 200 },
  );
}
