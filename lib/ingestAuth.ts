/**
 * Unified auth for the ingest surface (uploads/sign, scan-batches,
 * ingest/documents, ingest/jobs).
 *
 * These endpoints accept TWO authentication flavours:
 *
 *   - Staff session via Clerk: the reviewer portal hits them while
 *     capturing through /portal/capture. Staff are scoped to the
 *     Pierflow Platform org (and anything they create lives under it).
 *
 *   - Partner bearer token via PartnerApiKey: an EMR vendor or other
 *     integrator hits them programmatically. The partner must have an
 *     ACTIVE PartnerOrganizationLink to the target org.
 *
 * The resolver returns a discriminated union; route handlers branch on
 * `kind` for authorization logic. Org-scoping is enforced via
 * `assertOrgAllowed(...)` so we don't repeat the check in every route.
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveSession } from "@/lib/auth";
import { resolvePartnerSession } from "@/lib/partnerAuth";

export type IngestActor =
  | {
      kind: "staff";
      externalId: string;
      organizationId: string;
      organizationName: string;
    }
  | {
      kind: "partner";
      partnerId: string;
      partnerName: string;
      apiKeyId: string;
      organizationIds: Set<string>;
    };

export async function resolveIngestActor(
  req: Request,
): Promise<IngestActor | null> {
  // Bearer token wins if present — partners always send it explicitly,
  // and we never want a stray Clerk cookie on a partner request to
  // accidentally elevate it to staff scope.
  const authz = req.headers.get("authorization");
  if (authz && authz.toLowerCase().startsWith("bearer ")) {
    const partner = await resolvePartnerSession(req);
    if (!partner) return null;
    return {
      kind: "partner",
      partnerId: partner.partnerId,
      partnerName: partner.partnerName,
      apiKeyId: partner.apiKeyId,
      organizationIds: partner.organizationIds,
    };
  }

  // Fall back to a staff session.
  const session = await resolveSession();
  if (session.kind !== "staff") return null;
  return {
    kind: "staff",
    externalId: session.externalId,
    organizationId: session.organization.id,
    organizationName: session.organization.name,
  };
}

/**
 * Returns true if the actor is allowed to read/write the given org id.
 * Staff can act on their own org; partners on any org they have an
 * ACTIVE PartnerOrganizationLink for AND that's accessStatus = ACTIVE.
 */
export async function assertOrgAllowed(
  actor: IngestActor,
  organizationId: string,
): Promise<boolean> {
  if (actor.kind === "staff") {
    return organizationId === actor.organizationId;
  }
  if (!actor.organizationIds.has(organizationId)) return false;
  // Belt-and-suspenders: ensure the org is currently ACTIVE. A linked
  // org that's PENDING / REJECTED / SUSPENDED is not ingestable.
  const org = await db.organization.findUnique({
    where: { id: organizationId },
    select: { accessStatus: true, isActive: true },
  });
  if (!org || !org.isActive) return false;
  return org.accessStatus === "ACTIVE";
}

/* ── Error envelopes ─────────────────────────────────────────── */

export function unauthorized(message = "UNAUTHENTICATED") {
  return NextResponse.json(
    { error: message },
    {
      status: 401,
      headers: { "WWW-Authenticate": 'Bearer realm="pierflow"' },
    },
  );
}

export function forbidden(message = "FORBIDDEN") {
  return NextResponse.json({ error: message }, { status: 403 });
}

export function notFound(message = "NOT_FOUND") {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function validationError(details?: unknown) {
  return NextResponse.json(
    { error: "VALIDATION_ERROR", details },
    { status: 422 },
  );
}
