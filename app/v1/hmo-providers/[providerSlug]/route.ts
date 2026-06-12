import { NextResponse } from "next/server";
import {
  resolvePartnerSession,
  unauthorized,
  forbidden,
  notFound,
} from "@/lib/partnerAuth";
import { findProviderBySlug } from "@/lib/insurance/providers";

/**
 * GET /v1/hmo-providers/:providerSlug
 *
 * Lightweight read of a single HMO provider. The EMR vendor's
 * connector hits this on startup to confirm Pierflow's view of an
 * HMO matches its own (slug, display name, status, contract count).
 *
 * Surfaces only the fields a partner is allowed to see — internal
 * settlement details stay staff-only.
 */
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

  return NextResponse.json({
    id: provider.id,
    slug: provider.slug,
    display_name: provider.displayName,
    status: provider.status,
    registration_no: provider.registrationNo,
    website_url: provider.websiteUrl,
    contact_email: provider.contactEmail,
    contact_phone: provider.contactPhone,
    organization: {
      id: provider.organization.id,
      name: provider.organization.name,
      state: provider.organization.state,
      lga: provider.organization.lga,
    },
  });
}
