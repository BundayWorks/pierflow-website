import { NextResponse } from "next/server";
import { z } from "zod";
import {
  resolvePartnerSession,
  unauthorized,
  forbidden,
  notFound,
} from "@/lib/partnerAuth";
import { findProviderBySlug } from "@/lib/insurance/providers";
import { ingestPlans } from "@/lib/insurance/catalogue";

/**
 * GET  /v1/hmo-providers/:providerSlug/plans
 * POST /v1/hmo-providers/:providerSlug/plans
 *
 * The connector-facing catalogue surface.
 *
 *   GET  — paginated list of plans the partner has published for this
 *          provider. Read-only mirror of what's in our cache.
 *
 *   POST — bulk upsert. The EMR vendor sends his full catalogue (or a
 *          subset for partial updates) and we re-write each plan in
 *          place. Returns per-plan outcomes so the connector can retry
 *          only the failures.
 *
 * Authorization: the calling partner must have a PartnerOrganizationLink
 * to the Organization backing the HMO provider. This is the same gate
 * that protects every other tenant-scoped /v1 surface.
 */

// ─── POST body ───────────────────────────────────────────────────────
//
// The connector's catalogue shape. `plans` is a flat array of
// Universal Plan Schema objects (see lib/insurance/plan-schema.ts).
// The route validates the wrapper here; the per-plan validation runs
// inside ingestPlans() so bad plans don't poison the whole batch.
const PostBody = z.object({
  kind: z
    .enum(["BULK_SYNC", "PARTIAL_UPDATE", "CHANGE_NOTIFICATION"])
    .default("BULK_SYNC"),
  /**
   * Format of each entry in `plans`:
   *   "universal" — Universal Plan Schema (default)
   *   "native"    — HMO's native shape; the active ConnectorMapping
   *                 is applied per-entry before validation.
   */
  format: z.enum(["universal", "native"]).default("universal"),
  plans: z.array(z.unknown()).min(1).max(2000),
  /**
   * Optional soft TTL for this batch, in milliseconds. Used to
   * surface a freshness hint on the consumer-side API. Defaults to 26
   * hours when omitted on a BULK_SYNC (one daily cycle + a 2-hour
   * grace) and to null otherwise.
   */
  stale_after_ms: z.number().int().positive().max(7 * 24 * 60 * 60_000).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: { providerSlug: string } },
) {
  const session = await resolvePartnerSession(req);
  if (!session) return unauthorized();

  const provider = await findProviderBySlug(params.providerSlug);
  if (!provider) return notFound("HMO_PROVIDER_NOT_FOUND");
  if (!session.organizationIds.has(provider.organizationId)) {
    return forbidden();
  }

  let body: z.infer<typeof PostBody>;
  try {
    body = PostBody.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      {
        error: "VALIDATION_ERROR",
        details: err instanceof z.ZodError ? err.issues : undefined,
      },
      { status: 422 },
    );
  }

  const staleAfterMs =
    body.stale_after_ms ??
    (body.kind === "BULK_SYNC" ? 26 * 60 * 60_000 : undefined);

  const outcome = await ingestPlans({
    providerId: provider.id,
    plans: body.plans,
    format: body.format,
    kind: body.kind,
    staleAfterMs,
  });

  return NextResponse.json({
    provider: { id: provider.id, slug: provider.slug },
    ...outcome,
  });
}

// ─── GET query ───────────────────────────────────────────────────────
//
// Simple read-back. We keep filters narrow — this is the connector
// confirming "what does Pierflow think my catalogue looks like?"
// not the fintech-facing browse surface (that comes in Chapter 2).
const GetQuery = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
  status: z.enum(["DRAFT", "ACTIVE", "WITHDRAWN"]).optional(),
});

export async function GET(
  req: Request,
  { params }: { params: { providerSlug: string } },
) {
  const session = await resolvePartnerSession(req);
  if (!session) return unauthorized();

  const provider = await findProviderBySlug(params.providerSlug);
  if (!provider) return notFound("HMO_PROVIDER_NOT_FOUND");
  if (!session.organizationIds.has(provider.organizationId)) {
    return forbidden();
  }

  const url = new URL(req.url);
  let query: z.infer<typeof GetQuery>;
  try {
    query = GetQuery.parse({
      cursor: url.searchParams.get("cursor") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: "VALIDATION_ERROR",
        details: err instanceof z.ZodError ? err.issues : undefined,
      },
      { status: 422 },
    );
  }

  // Lazy import to keep the route handler small.
  const { db } = await import("@/lib/db");
  const rows = await db.hmoPlan.findMany({
    where: {
      providerId: provider.id,
      ...(query.status ? { status: query.status } : {}),
    },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    take: query.limit + 1,
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    select: {
      id: true,
      externalId: true,
      name: true,
      scope: true,
      status: true,
      billingFrequency: true,
      lastSyncedAt: true,
      lastVerifiedAt: true,
      staleAfter: true,
      effectiveFrom: true,
      effectiveTo: true,
      coverage: true,
      pricing: true,
      waitingPeriods: true,
      exclusions: true,
    },
  });

  const hasMore = rows.length > query.limit;
  const items = hasMore ? rows.slice(0, query.limit) : rows;
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  return NextResponse.json({
    provider: { id: provider.id, slug: provider.slug },
    items,
    next_cursor: nextCursor,
  });
}
