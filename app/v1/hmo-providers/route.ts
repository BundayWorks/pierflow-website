import { NextResponse } from "next/server";
import {
  resolvePartnerSession,
  unauthorized,
  requireScope,
} from "@/lib/partnerAuth";
import { listHmosForFintech } from "@/lib/insurance/hmo-access";

/**
 * GET /v1/hmo-providers — fintech HMO marketplace.
 *
 * Lists every active HMO on the Pierflow network with:
 *   - The published FINTECH rate card (what you earn per enrollment)
 *   - Your current opt-in status for each HMO
 *
 * Use POST /v1/hmo-providers/{slug}/opt-in to accept a rate card and
 * unlock that HMO's plans in GET /v1/plans.
 *
 * Auth: requires insurance:read scope.
 */
export async function GET(req: Request) {
  const session = await resolvePartnerSession(req);
  if (!session) return unauthorized();
  const scopeFail = requireScope(session, "insurance:read");
  if (scopeFail) return scopeFail;

  const hmos = await listHmosForFintech(session.partnerId);

  return NextResponse.json({
    items: hmos,
    total: hmos.length,
  });
}
