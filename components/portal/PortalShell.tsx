"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import {
  LayoutDashboard,
  Camera,
  FileCheck2,
  Users,
  Building2,
  Settings,
  Inbox,
  type LucideIcon,
} from "lucide-react";
import Logo from "@/components/shared/Logo";

type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  badgeKey?: "partnersAwaitingReview" | "orgsAwaitingReview";
};

const NAV: NavItem[] = [
  { label: "Dashboard", href: "/portal", icon: LayoutDashboard },
  { label: "Capture", href: "/portal/capture", icon: Camera },
  { label: "Review queue", href: "/portal/review", icon: FileCheck2 },
  { label: "Patients", href: "/portal/patients", icon: Users },
  {
    label: "Partners",
    href: "/portal/partners",
    icon: Inbox,
    badgeKey: "partnersAwaitingReview",
  },
  {
    label: "Customer orgs",
    href: "/portal/customer-orgs",
    icon: Building2,
    badgeKey: "orgsAwaitingReview",
  },
  { label: "Settings", href: "/portal/settings", icon: Settings },
];

export default function PortalShell({
  children,
  partnersAwaitingReview = 0,
  orgsAwaitingReview = 0,
}: {
  children: React.ReactNode;
  partnersAwaitingReview?: number;
  orgsAwaitingReview?: number;
}) {
  const badges = { partnersAwaitingReview, orgsAwaitingReview };
  const pathname = usePathname() ?? "/portal";

  const isActive = (href: string) =>
    href === "/portal" ? pathname === "/portal" : pathname.startsWith(href);

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-30 bg-white border-b border-black/[0.06]">
        <div className="max-w-[1400px] mx-auto px-4 lg:px-6 h-[60px] flex items-center justify-between gap-4">
          <Link href="/portal" className="flex items-center gap-2">
            <Logo variant="dark" size="sm" />
            <span className="text-[14px] text-accent-ink/55 ml-1 hidden sm:inline">
              Portal
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <UserButton
              appearance={{
                elements: {
                  avatarBox: "w-8 h-8",
                },
              }}
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
              const count = item.badgeKey ? badges[item.badgeKey] : 0;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-md text-[14px] ${
                    active
                      ? "bg-accent-teal-light text-accent-emerald font-medium"
                      : "text-accent-ink/75 hover:text-accent-ink hover:bg-black/[0.03]"
                  }`}
                >
                  <Icon size={16} />
                  <span className="flex-1">{item.label}</span>
                  {count > 0 ? (
                    <span
                      className={`text-[10px] font-medium leading-none px-1.5 py-1 rounded-full min-w-[18px] text-center ${
                        active
                          ? "bg-accent-emerald text-white"
                          : "bg-[#fff4d4] text-[#7a4a00]"
                      }`}
                    >
                      {count > 99 ? "99+" : count}
                    </span>
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
