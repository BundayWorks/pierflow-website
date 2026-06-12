import { NextResponse } from "next/server";
import { z } from "zod";
import {
  resolvePartnerSession,
  unauthorized,
  requireScope,
} from "@/lib/partnerAuth";
import { listProvidersPublic } from "@/lib/insurance/providers-network";

/**
 * GET /v1/providers
 *
 * Hospitals / clinics / labs / pharmacies in HMO networks.
 * Filter by state, lga, specialty, plan, type, or HMO. Cursor
 * paginated.
 *
 * Scope: insurance:read.
 */

const Query = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  state: z.string().optional(),
  lga: z.string().optional(),
  specialty: z.string().optional(),
  plan_id: z.string().optional(),
  type: z.enum(["HOSPITAL", "CLINIC", "LAB", "PHARMACY", "OTHER"]).optional(),
  hmo_slug: z.string().optional(),
});

export async function GET(req: Request) {
  const session = await resolvePartnerSession(req);
  if (!session) return unauthorized();
  const scopeFail = requireScope(session, "insurance:read");
  if (scopeFail) return scopeFail;

  const url = new URL(req.url);
  let q: z.infer<typeof Query>;
  try {
    q = Query.parse({
      cursor: url.searchParams.get("cursor") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
      state: url.searchParams.get("state") ?? undefined,
      lga: url.searchParams.get("lga") ?? undefined,
      specialty: url.searchParams.get("specialty") ?? undefined,
      plan_id: url.searchParams.get("plan_id") ?? undefined,
      type: url.searchParams.get("type") ?? undefined,
      hmo_slug: url.searchParams.get("hmo_slug") ?? undefined,
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

  const result = await listProvidersPublic(
    {
      state: q.state,
      lga: q.lga,
      specialty: q.specialty,
      planId: q.plan_id,
      type: q.type,
      hmoSlug: q.hmo_slug,
    },
    { cursor: q.cursor, limit: q.limit },
  );
  return NextResponse.json(result);
}
