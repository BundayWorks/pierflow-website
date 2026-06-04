import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolvePartnerSession, unauthorized } from "@/lib/partnerAuth";

/**
 * GET /v1/organizations
 *
 * Returns every organization the calling Partner is permitted to act on,
 * with summary counts. Pagination kept simple — we expect partners to
 * have on the order of dozens or low hundreds of linked organizations,
 * not millions.
 */
export async function GET(req: Request) {
  const session = await resolvePartnerSession(req);
  if (!session) return unauthorized();

  const orgIds = Array.from(session.organizationIds);
  if (orgIds.length === 0) {
    return NextResponse.json(
      { organizations: [], pagination: { total: 0, page: 1, per_page: 0 } },
      { status: 200 },
    );
  }

  const orgs = await db.organization.findMany({
    where: { id: { in: orgIds }, isActive: true },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      type: true,
      street: true,
      lga: true,
      state: true,
      country: true,
      _count: {
        select: {
          patients: true,
          extractedRecords: {
            where: { validationStatus: { in: ["AUTO_APPROVED", "VALIDATED"] } },
          },
        },
      },
    },
  });

  return NextResponse.json(
    {
      organizations: orgs.map((o) => ({
        organization_id: o.id,
        name: o.name,
        type: o.type,
        address:
          o.street || o.lga || o.state
            ? {
                street: o.street ?? undefined,
                lga: o.lga ?? undefined,
                state: o.state ?? undefined,
                country: o.country,
              }
            : undefined,
        stats: {
          patient_count: o._count.patients,
          validated_record_count: o._count.extractedRecords,
        },
      })),
      pagination: {
        total: orgs.length,
        page: 1,
        per_page: orgs.length,
      },
    },
    { status: 200 },
  );
}
