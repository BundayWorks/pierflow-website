import PortalShell from "@/components/portal/PortalShell";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PortalShell>{children}</PortalShell>;
}
