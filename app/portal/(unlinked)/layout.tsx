import { redirect } from "next/navigation";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import Logo from "@/components/shared/Logo";
import { resolveSession } from "@/lib/auth";

export default async function UnlinkedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await resolveSession();
  if (session.kind === "anonymous") redirect("/portal/sign-in");
  if (session.kind === "staff") redirect("/portal");
  if (session.kind === "partner") redirect("/portal/overview");

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-30 bg-white border-b border-black/[0.06]">
        <div className="max-w-[900px] mx-auto px-4 lg:px-6 h-[60px] flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2">
            <Logo variant="dark" size="sm" />
          </Link>
          <UserButton appearance={{ elements: { avatarBox: "w-8 h-8" } }} />
        </div>
      </header>
      <main className="max-w-[900px] mx-auto px-4 lg:px-6 py-16">
        {children}
      </main>
    </div>
  );
}
