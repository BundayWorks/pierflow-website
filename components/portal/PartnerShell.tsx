"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { Key, BookOpen, BarChart3, type LucideIcon } from "lucide-react";
import Logo from "@/components/shared/Logo";

type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  external?: boolean;
};

const NAV: NavItem[] = [
  { label: "API keys", href: "/portal/keys", icon: Key },
  { label: "Usage", href: "/portal/usage", icon: BarChart3 },
  {
    label: "Docs",
    href: "/docs/quickstart/introduction",
    icon: BookOpen,
    external: true,
  },
];

export default function PartnerShell({
  children,
  partnerName,
}: {
  children: React.ReactNode;
  partnerName: string;
}) {
  const pathname = usePathname() ?? "/portal/keys";

  const isActive = (href: string) =>
    href.startsWith("/portal") && pathname.startsWith(href);

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-30 bg-white border-b border-black/[0.06]">
        <div className="max-w-[1400px] mx-auto px-4 lg:px-6 h-[60px] flex items-center justify-between gap-4">
          <Link href="/portal/keys" className="flex items-center gap-2">
            <Logo variant="dark" size="sm" />
            <span className="text-[14px] text-accent-ink/55 ml-1 hidden sm:inline">
              Partners
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline text-[12px] text-accent-ink/55">
              {partnerName}
            </span>
            <UserButton
              appearance={{ elements: { avatarBox: "w-8 h-8" } }}
            />
          </div>
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto px-4 lg:px-6 grid lg:grid-cols-[220px_minmax(0,1fr)] gap-8">
        <aside className="hidden lg:block py-8 lg:sticky lg:top-[60px] lg:max-h-[calc(100vh-60px)] lg:overflow-y-auto">
          <nav className="space-y-1">
            {NAV.map((item) => {
              const active = isActive(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  {...(item.external
                    ? { target: "_blank", rel: "noreferrer" }
                    : {})}
                  className={`flex items-center gap-3 px-3 py-2 rounded-md text-[14px] ${
                    active
                      ? "bg-accent-teal-light text-accent-emerald font-medium"
                      : "text-accent-ink/75 hover:text-accent-ink hover:bg-black/[0.03]"
                  }`}
                >
                  <Icon size={16} />
                  <span className="flex-1">{item.label}</span>
                  {item.external ? (
                    <span className="text-[10px] text-accent-ink/35">↗</span>
                  ) : null}
                </Link>
              );
            })}
          </nav>
        </aside>

        <main className="py-8">{children}</main>
      </div>
    </div>
  );
}
