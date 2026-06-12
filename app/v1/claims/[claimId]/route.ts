import { NextResponse } from "next/server";
import {
  resolvePartnerSession,
  unauthorized,
  notFound,
  requireScope,
} from "@/lib/partnerAuth";
import { getClaim } from "@/lib/insurance/claims";

/**
 * GET /v1/claims/:claimId — retrieve a single claim. Scope: insurance:read.
 */
export async function GET(
  req: Request,
  { params }: { params: { claimId: string } },
) {
  const session = await resolvePartnerSession(req);
  if (!session) return unauthorized();
  const scopeFail = requireScope(session, "insurance:read");
  if (scopeFail) return scopeFail;

  const claim = await getClaim(params.claimId, session.partnerId);
  if (!claim) return notFound("CLAIM_NOT_FOUND");
  return NextResponse.json(claim);
}
