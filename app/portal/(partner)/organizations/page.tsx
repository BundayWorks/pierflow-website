import { requirePartnerUser } from "@/lib/auth";
import { listMyOrganizations } from "./actions";
import OrganizationsClient from "./OrganizationsClient";

export const dynamic = "force-dynamic";

export default async function PartnerOrganizationsPage() {
  const [{ partner }, orgs] = await Promise.all([
    requirePartnerUser(),
    listMyOrganizations(),
  ]);

  const canRegister =
    partner.accessStatus === "SANDBOX" ||
    partner.accessStatus === "PRODUCTION_REQUESTED" ||
    partner.accessStatus === "PRODUCTION";

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.16em] text-accent-emerald">
        Customer organizations
      </p>
      <h1 className="mt-2 font-display text-[32px] md:text-[40px] leading-[1.05] tracking-[-0.02em] text-accent-ink font-medium">
        Organizations
      </h1>
      <p className="mt-3 text-[15px] leading-[1.7] text-accent-ink/65 max-w-[640px]">
        Each hospital, clinic, lab, or program you want to capture records on
        behalf of needs to be registered here. We review every new
        organization before enabling ingest so the audit trail stays clean.
      </p>
      <div className="mt-8">
        <OrganizationsClient
          initialOrgs={orgs.map((o) => ({
            ...o,
            createdAt: o.createdAt.toISOString(),
            approvedAt: o.approvedAt?.toISOString() ?? null,
          }))}
          canRegister={canRegister}
          accessStatus={partner.accessStatus}
        />
      </div>
    </div>
  );
}
