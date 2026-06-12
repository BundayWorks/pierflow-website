import { redirect } from "next/navigation";
import PartnerShell from "@/components/portal/PartnerShell";
import { resolveSession } from "@/lib/auth";

export default async function PartnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await resolveSession();
  if (session.kind === "anonymous") redirect("/portal/sign-in");
  if (session.kind === "staff") redirect("/portal");
  if (session.kind === "unlinked") redirect("/portal/pending");

  return (
    <PartnerShell
      partnerName={session.partner.name}
      partnerType={session.partner.type}
      consumesProducts={session.partner.consumesProducts}
      impersonation={
        session.impersonatedByStaff
          ? {
              staffEmail: session.impersonatedByStaff.staffEmail,
              startedAt: session.impersonatedByStaff.startedAt,
            }
          : null
      }
    >
      {children}
    </PartnerShell>
  );
}
