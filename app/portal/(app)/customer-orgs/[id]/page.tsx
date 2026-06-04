import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getOrganization } from "../actions";
import OrganizationDetail from "./OrganizationDetail";

export const dynamic = "force-dynamic";

export default async function OrganizationDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const org = await getOrganization(params.id);
  if (!org) notFound();

  return (
    <div>
      <Link
        href="/portal/customer-orgs"
        className="inline-flex items-center gap-1.5 text-[12px] text-accent-ink/55 hover:text-accent-ink"
      >
        <ArrowLeft size={13} />
        All organizations
      </Link>
      <div className="mt-6">
        <OrganizationDetail
          org={{
            id: org.id,
            name: org.name,
            type: org.type,
            country: org.country,
            state: org.state,
            lga: org.lga,
            mrnSystem: org.mrnSystem,
            accessStatus: org.accessStatus,
            rejectionReason: org.rejectionReason,
            reviewerNotes: org.reviewerNotes,
            createdAt: org.createdAt.toISOString(),
            approvedAt: org.approvedAt?.toISOString() ?? null,
            requestedByPartner: org.requestedByPartner
              ? {
                  id: org.requestedByPartner.id,
                  name: org.requestedByPartner.name,
                  accessStatus: org.requestedByPartner.accessStatus,
                }
              : null,
          }}
          linkedPartners={org.partnerLinks.map((l) => ({
            id: l.partner.id,
            name: l.partner.name,
            accessStatus: l.partner.accessStatus,
          }))}
          history={org.approvalEvents.map((e) => ({
            id: e.id,
            action: e.action,
            actor: e.actorExternalId,
            notes: e.notes,
            occurredAt: e.occurredAt.toISOString(),
          }))}
        />
      </div>
    </div>
  );
}
