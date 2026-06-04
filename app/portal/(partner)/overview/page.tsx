import { currentUser } from "@clerk/nextjs/server";
import { requirePartnerUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { buildChecklist } from "@/lib/partnerChecklist";
import OverviewClient from "./OverviewClient";

export const dynamic = "force-dynamic";

export default async function PartnerOverviewPage() {
  const { partner: sessionPartner } = await requirePartnerUser();
  const [partner, user] = await Promise.all([
    db.partner.findUnique({
      where: { id: sessionPartner.id },
      include: {
        users: {
          select: { joinedAt: true, externalId: true, email: true },
        },
        apiKeys: {
          select: { id: true, lastUsedAt: true, revokedAt: true, last4: true, label: true, createdAt: true },
        },
        agreements: { select: { kind: true, signedAt: true } },
        profile: true,
        securityAssessment: true,
      },
    }),
    currentUser(),
  ]);

  if (!partner) {
    throw new Error("PARTNER_NOT_FOUND");
  }

  const emailVerified =
    user?.primaryEmailAddress?.verification?.status === "verified";

  const checklist = buildChecklist(partner, emailVerified);

  return (
    <OverviewClient
      partner={{
        id: partner.id,
        name: partner.name,
        accessStatus: partner.accessStatus,
        productionRequestedAt: partner.productionRequestedAt?.toISOString() ?? null,
        sandboxApprovedAt: partner.sandboxApprovedAt?.toISOString() ?? null,
        reviewerNotes: partner.reviewerNotes,
        primaryUseCase: partner.primaryUseCase,
        expectedVolume: partner.expectedVolume,
        timeline: partner.timeline,
      }}
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
              accessControlNotes:
                partner.securityAssessment.accessControlNotes,
              encryptsAtRest: partner.securityAssessment.encryptsAtRest,
              encryptsInTransit:
                partner.securityAssessment.encryptsInTransit,
              hasIncidentResponse:
                partner.securityAssessment.hasIncidentResponse,
              hasNda: partner.securityAssessment.hasNda,
              completedAt:
                partner.securityAssessment.completedAt?.toISOString() ??
                null,
            }
          : null
      }
      checklist={checklist}
      sandboxKey={
        partner.apiKeys
          .filter((k) => !k.revokedAt)
          .map((k) => ({
            id: k.id,
            last4: k.last4,
            label: k.label,
            createdAt: k.createdAt.toISOString(),
            lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
          }))[0] ?? null
      }
    />
  );
}
