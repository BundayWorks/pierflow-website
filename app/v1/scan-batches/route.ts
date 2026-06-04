import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  resolveIngestActor,
  assertOrgAllowed,
  unauthorized,
  forbidden,
  validationError,
} from "@/lib/ingestAuth";

/**
 * POST /v1/scan-batches
 *
 * Creates a ScanBatch the caller can then attach ProcessingJobs to via
 * /v1/ingest/documents. A batch groups documents captured together so
 * staff reviewers (and the package builder) treat them as a unit.
 *
 * Body:
 *   {
 *     organizationId: string,
 *     label?: string,
 *     siteId?: string,
 *     priority?: "NORMAL" | "URGENT",
 *     metadata?: object   // free-form: capture device, operator id, etc.
 *   }
 *
 * Auth:
 *   - Staff session: organizationId must match the staff org.
 *   - Partner bearer: organization must be ACTIVE and linked.
 */
const Body = z.object({
  organizationId: z.string().min(1),
  label: z.string().trim().max(120).optional(),
  siteId: z.string().min(1).optional(),
  priority: z.enum(["NORMAL", "URGENT"]).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
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

  if (actor.kind === "staff" && body.organizationId !== actor.organizationId) {
    return forbidden("ORG_SCOPE_MISMATCH");
  }

  if (!(await assertOrgAllowed(actor, body.organizationId))) {
    return forbidden("ORG_NOT_LINKED");
  }

  if (body.siteId) {
    const site = await db.site.findUnique({
      where: { id: body.siteId },
      select: { organizationId: true },
    });
    if (!site || site.organizationId !== body.organizationId) {
      return validationError({ siteId: "SITE_NOT_FOUND" });
    }
  }

  const operatorId =
    actor.kind === "staff" ? actor.externalId : `partner:${actor.partnerId}`;

  const batch = await db.scanBatch.create({
    data: {
      organizationId: body.organizationId,
      siteId: body.siteId ?? null,
      label: body.label ?? null,
      priority: body.priority ?? "NORMAL",
      operatorId,
      metadata: (body.metadata as object | undefined) ?? undefined,
    },
    select: { id: true, organizationId: true, priority: true, createdAt: true },
  });

  return NextResponse.json(
    {
      batch_id: batch.id,
      organization_id: batch.organizationId,
      priority: batch.priority,
      created_at: batch.createdAt.toISOString(),
    },
    { status: 201 },
  );
}
