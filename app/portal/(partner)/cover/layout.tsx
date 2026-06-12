import { redirect } from "next/navigation";
import { resolveSession } from "@/lib/auth";

/**
 * Guard: only INSURER partners can access /portal/cover/*.
 * Non-INSURER partners are redirected to the overview.
 */
export default async function CoverLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await resolveSession();
  if (session.kind !== "partner") redirect("/portal");
  if (session.partner.type !== "INSURER") redirect("/portal/overview");

  return <>{children}</>;
}
