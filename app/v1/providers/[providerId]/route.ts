import { NextResponse } from "next/server";
import {
  resolvePartnerSession,
  unauthorized,
  notFound,
  requireScope,
} from "@/lib/partnerAuth";
import { getProviderPublic } from "@/lib/insurance/providers-network";

/**
 * GET /v1/providers/:providerId — single provider detail.
 * Scope: insurance:read.
 */
export async function GET(
  req: Request,
  { params }: { params: { providerId: string } },
) {
  const session = await resolvePartnerSession(req);
  if (!session) return unauthorized();
  const scopeFail = requireScope(session, "insurance:read");
  if (scopeFail) return scopeFail;

  const provider = await getProviderPublic(params.providerId);
  if (!provider) return notFound("PROVIDER_NOT_FOUND");
  return NextResponse.json(provider);
}
