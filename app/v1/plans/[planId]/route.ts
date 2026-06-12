import { NextResponse } from "next/server";
import {
  resolvePartnerSession,
  unauthorized,
  notFound,
  requireScope,
} from "@/lib/partnerAuth";
import { getPlanPublic } from "@/lib/insurance/plans-public";

/**
 * GET /v1/plans/:planId — single-plan detail for the fintech browse
 * surface. Same shape as the list response, one element.
 *
 * Plans from non-ACTIVE providers (PENDING / SUSPENDED) return 404
 * even if they exist — the partner shouldn't see them.
 */
export async function GET(
  req: Request,
  { params }: { params: { planId: string } },
) {
  const session = await resolvePartnerSession(req);
  if (!session) return unauthorized();
  const scopeFail = requireScope(session, "insurance:read");
  if (scopeFail) return scopeFail;

  const plan = await getPlanPublic(params.planId);
  if (!plan) return notFound("PLAN_NOT_FOUND");

  return NextResponse.json(plan);
}
