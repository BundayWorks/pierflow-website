import { NextResponse } from "next/server";
import {
  resolvePartnerSession,
  unauthorized,
  requireScope,
} from "@/lib/partnerAuth";
import { optInToHmo, optOutOfHmo } from "@/lib/insurance/hmo-access";

/**
 * POST /v1/hmo-providers/{slug}/opt-in
 *
 * Accept the published rate card for an HMO. After this call the HMO's
 * plans appear in GET /v1/plans for this partner's API key.
 *
 * The rate card terms are frozen in rateCardSnapshot at the moment of
 * acceptance — if Pierflow later renegotiates with the HMO, existing
 * enrollments honour the accepted terms and you will be notified of
 * rate changes via the hmo.rate_card.updated webhook event.
 *
 * Auth: requires insurance:write scope.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ providerSlug: string }> },
) {
  const session = await resolvePartnerSession(req);
  if (!session) return unauthorized();
  const scopeFail = requireScope(session, "insurance:write");
  if (scopeFail) return scopeFail;

  const { providerSlug } = await params;
  const result = await optInToHmo(session.partnerId, providerSlug);

  if (!result.ok) {
    const status = result.reason === "HMO_NOT_FOUND" ? 404 : 422;
    return NextResponse.json({ error: result.reason }, { status });
  }

  return NextResponse.json(
    { status: result.status, provider_slug: providerSlug },
    { status: result.status === "activated" ? 201 : 200 },
  );
}

/**
 * DELETE /v1/hmo-providers/{slug}/opt-in
 *
 * Remove opt-in for an HMO. The HMO's plans will no longer appear in
 * GET /v1/plans. In-flight enrollments are unaffected — this only gates
 * new quote and browse requests.
 *
 * Auth: requires insurance:write scope.
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ providerSlug: string }> },
) {
  const session = await resolvePartnerSession(req);
  if (!session) return unauthorized();
  const scopeFail = requireScope(session, "insurance:write");
  if (scopeFail) return scopeFail;

  const { providerSlug } = await params;
  const result = await optOutOfHmo(session.partnerId, providerSlug);

  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: 404 });
  }

  return NextResponse.json({ status: "opted_out", provider_slug: providerSlug });
}
