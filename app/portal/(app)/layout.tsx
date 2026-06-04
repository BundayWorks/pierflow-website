import PortalShell from "@/components/portal/PortalShell";
import { countPendingAccessRequests } from "./access-requests/actions";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pendingAccessRequests = await countPendingAccessRequests();
  return (
    <PortalShell pendingAccessRequests={pendingAccessRequests}>
      {children}
    </PortalShell>
  );
}
