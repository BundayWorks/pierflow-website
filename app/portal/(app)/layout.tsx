import { redirect } from "next/navigation";
import PortalShell from "@/components/portal/PortalShell";
import { resolveSession } from "@/lib/auth";
import { countPendingAccessRequests } from "./access-requests/actions";

export default async function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Staff-only. Anyone else bounces to the portal root, which routes
  // them to the right place (partner shell, pending page, or sign-in).
  const session = await resolveSession();
  if (session.kind === "anonymous") redirect("/portal/sign-in");
  if (session.kind === "partner") redirect("/portal/keys");
  if (session.kind === "unlinked") redirect("/portal/pending");

  const pendingAccessRequests = await countPendingAccessRequests();
  return (
    <PortalShell pendingAccessRequests={pendingAccessRequests}>
      {children}
    </PortalShell>
  );
}
