import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Eye } from "lucide-react";
import { getPartner } from "../actions";
import { startImpersonation } from "../impersonation";
import PartnerDetail from "./PartnerDetail";

export const dynamic = "force-dynamic";

export default async function PartnerDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const partner = await getPartner(params.id);
  if (!partner) notFound();

  // Server action bound at render time so the button form posts back
  // to this page with the partner id captured in the closure.
  async function impersonateAction() {
    "use server";
    await startImpersonation(partner!.id);
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Link
          href="/portal/partners"
          className="inline-flex items-center gap-1.5 text-[12px] text-accent-ink/55 hover:text-accent-ink"
        >
          <ArrowLeft size={13} />
          All partners
        </Link>
        <form action={impersonateAction}>
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-black/[0.12] text-[12px] text-accent-ink/75 hover:text-accent-ink hover:border-accent-ink/40"
            title="Open the partner portal as this partner. All actions you take will be logged as 'staff_impersonating'."
          >
            <Eye size={12} /> View as {partner.name}
          </button>
        </form>
      </div>
      <div className="mt-6">
        <PartnerDetail
          partner={{
            id: partner.id,
            name: partner.name,
            slug: partner.slug,
            type: partner.type,
            websiteUrl: partner.websiteUrl,
            country: partner.country,
            accessStatus: partner.accessStatus,
            consumesProducts: partner.consumesProducts,
            primaryUseCase: partner.primaryUseCase,
            expectedVolume: partner.expectedVolume,
            timeline: partner.timeline,
            reviewerNotes: partner.reviewerNotes,
            createdAt: partner.createdAt.toISOString(),
            sandboxApprovedAt:
              partner.sandboxApprovedAt?.toISOString() ?? null,
            productionRequestedAt:
              partner.productionRequestedAt?.toISOString() ?? null,
            productionApprovedAt:
              partner.productionApprovedAt?.toISOString() ?? null,
          }}
          users={partner.users.map((u) => ({
            id: u.id,
            email: u.email,
            role: u.role,
            joinedAt: u.joinedAt?.toISOString() ?? null,
            externalId: u.externalId,
          }))}
          keys={partner.apiKeys.map((k) => ({
            id: k.id,
            last4: k.last4,
            label: k.label,
            env: k.env,
            scopes: k.scopes,
            createdAt: k.createdAt.toISOString(),
            revokedAt: k.revokedAt?.toISOString() ?? null,
            lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
          }))}
          profile={
            partner.profile
              ? {
                  legalName: partner.profile.legalName,
                  registeredAddress: partner.profile.registeredAddress,
                  contactPhone: partner.profile.contactPhone,
                  completedAt:
                    partner.profile.completedAt?.toISOString() ?? null,
                }
              : null
          }
          security={
            partner.securityAssessment
              ? {
                  dataResidency: partner.securityAssessment.dataResidency,
                  retentionDays: partner.securityAssessment.retentionDays,
                  encryptsAtRest:
                    partner.securityAssessment.encryptsAtRest,
                  encryptsInTransit:
                    partner.securityAssessment.encryptsInTransit,
                  hasIncidentResponse:
                    partner.securityAssessment.hasIncidentResponse,
                  hasNda: partner.securityAssessment.hasNda,
                  accessControlNotes:
                    partner.securityAssessment.accessControlNotes,
                  completedAt:
                    partner.securityAssessment.completedAt?.toISOString() ??
                    null,
                }
              : null
          }
          agreements={partner.agreements.map((a) => ({
            id: a.id,
            kind: a.kind,
            signedAt: a.signedAt.toISOString(),
            signedByEmail: a.signedByEmail,
            signedByName: a.signedByName,
            documentVersion: a.documentVersion,
          }))}
        />
      </div>
    </div>
  );
}
