import { redirect } from "next/navigation";
import PortalShell from "@/components/portal/PortalShell";
import { resolveSession } from "@/lib/auth";
import { countPartnersAwaitingReview } from "./partners/actions";
import { countOrganizationsAwaitingReview } from "./customer-orgs/actions";

export default async function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await resolveSession();
  if (session.kind === "anonymous") redirect("/portal/sign-in");
  if (session.kind === "partner") redirect("/portal/overview");
  if (session.kind === "unlinked") redirect("/portal/pending");

  const [partnersAwaitingReview, orgsAwaitingReview] = await Promise.all([
    countPartnersAwaitingReview(),
    countOrganizationsAwaitingReview(),
  ]);
  return (
    <PortalShell
      partnersAwaitingReview={partnersAwaitingReview}
      orgsAwaitingReview={orgsAwaitingReview}
    >
      {children}
    </PortalShell>
  );
}
