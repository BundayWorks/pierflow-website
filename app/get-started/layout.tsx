import Link from "next/link";
import Logo from "@/components/shared/Logo";

export const metadata = {
  title: "Get started · Pierflow",
};

export default function GetStartedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-black/[0.06]">
        <div className="max-w-[1100px] mx-auto px-4 lg:px-6 h-[60px] flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2">
            <Logo variant="dark" size="sm" />
          </Link>
          <div className="flex items-center gap-4 text-[13px] text-accent-ink/65">
            <span>Already have an account?</span>
            <Link
              href="/portal"
              className="text-accent-emerald hover:underline"
            >
              Log in
            </Link>
          </div>
        </div>
      </header>
      <main className="max-w-[640px] mx-auto px-4 lg:px-6 py-12 lg:py-16">
        {children}
      </main>
    </div>
  );
}
