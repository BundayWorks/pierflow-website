import { NextResponse } from "next/server";
import { z } from "zod";
import { buildSignedUpload } from "@/lib/cloudinary";
import { db } from "@/lib/db";
import {
  resolveIngestActor,
  assertOrgAllowed,
  unauthorized,
  forbidden,
  notFound,
  validationError,
} from "@/lib/ingestAuth";

/**
 * POST /v1/uploads/sign
 *
 * Returns a Cloudinary upload signature for a single asset. The caller
 * uploads the file directly to Cloudinary with that signature — the
 * server never proxies the file body.
 *
 * Accepts:
 *   - Staff Clerk session (legacy reviewer portal /portal/capture)
 *   - Partner bearer token (programmatic ingest, e.g. EMR vendors)
 *
 * Request body:
 *   {
 *     organizationId?: string  // Required for partners; staff scope is implicit
 *     batchId?: string         // Optional; signs into a batch folder if given
 *   }
 */
const Body = z.object({
  organizationId: z.string().min(1).optional(),
  batchId: z.string().min(1).optional(),
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

  // Both staff and partners must pass organizationId. Staff used to
  // implicitly target their own (Pierflow Platform) org — that's how
  // jobs ended up under the platform org instead of the customer org
  // they were captured for. Always explicit now.
  if (!body.organizationId) {
    return validationError({ organizationId: "REQUIRED" });
  }
  const organizationId = body.organizationId;

  if (!(await assertOrgAllowed(actor, organizationId))) {
    return forbidden("ORG_NOT_LINKED");
  }

  // If a batch is supplied, validate it belongs to that org so the
  // folder layout can't be coerced into another tenant's prefix.
  if (body.batchId) {
    const batch = await db.scanBatch.findUnique({
      where: { id: body.batchId },
      select: { organizationId: true },
    });
    if (!batch || batch.organizationId !== organizationId) {
      return notFound("BATCH_NOT_FOUND");
    }
  }

  const folder = body.batchId
    ? `pierflow/${organizationId}/${body.batchId}`
    : `pierflow/${organizationId}/unassigned`;

  const signed = buildSignedUpload({ folder });
  return NextResponse.json(signed, { status: 200 });
}
