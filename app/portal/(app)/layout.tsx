import { redirect } from "next/navigation";
import PortalShell from "@/components/portal/PortalShell";
import { resolveSession } from "@/lib/auth";
import { countPartnersAwaitingReview } from "./partners/actions";

export default async function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Staff-only. Anyone else bounces to the portal root, which routes
  // them to the right place (partner shell, pending page, or sign-in).
  const session = await resolveSession();
  if (session.kind === "anonymous") redirect("/portal/sign-in");
  if (session.kind === "partner") redirect("/portal/overview");
  if (session.kind === "unlinked") redirect("/portal/pending");

  const partnersAwaitingReview = await countPartnersAwaitingReview();
  return (
    <PortalShell partnersAwaitingReview={partnersAwaitingReview}>
      {children}
    </PortalShell>
  );
}
