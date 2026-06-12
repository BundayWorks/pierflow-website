"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import {
  Home,
  Key,
  BookOpen,
  BarChart3,
  Building2,
  Webhook,
  Eye,
  ShieldCheck,
  Users,
  FileText,
  ClipboardCheck,
  LayoutDashboard,
  Package,
  MapPin,
  Landmark,
  Receipt,
  type LucideIcon,
} from "lucide-react";
import Logo from "@/components/shared/Logo";
import { endImpersonation } from "@/app/portal/(app)/partners/impersonation";

type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  external?: boolean;
};

// ── API Console nav ────────────────────────────────────────────────

const CONSOLE_BASE: NavItem[] = [
  { label: "Overview", href: "/portal/overview", icon: Home },
  { label: "API keys", href: "/portal/keys", icon: Key },
  { label: "Webhooks", href: "/portal/webhooks", icon: Webhook },
  {
    label: "Docs",
    href: "/docs/quickstart/introduction",
    icon: BookOpen,
    external: true,
  },
];

const RECORDS_NAV: NavItem[] = [
  { label: "Organizations", href: "/portal/organizations", icon: Building2 },
  { label: "Usage", href: "/portal/usage", icon: BarChart3 },
];

const INSURANCE_FINTECH_NAV: NavItem[] = [
  { label: "HMO Network", href: "/portal/hmo-network", icon: ShieldCheck },
];

// ── Cover nav ──────────────────────────────────────────────────────

const COVER_NAV: NavItem[] = [
  { label: "Dashboard", href: "/portal/cover", icon: LayoutDashboard },
  { label: "Plans", href: "/portal/cover/plans", icon: Package },
  { label: "Network", href: "/portal/cover/network", icon: MapPin },
  { label: "Members", href: "/portal/cover/members", icon: Users },
  { label: "Claims", href: "/portal/cover/claims", icon: FileText },
  { label: "Contracts", href: "/portal/cover/contracts", icon: Receipt },
  { label: "Settlement", href: "/portal/cover/settlement", icon: Landmark },
  { label: "Eligibility", href: "/portal/cover/eligibility", icon: ClipboardCheck },
];

// ── Helpers ────────────────────────────────────────────────────────

type NavSection = "console" | "cover";

function buildConsoleNav(
  partnerType?: string,
  consumesProducts?: string[],
): NavItem[] {
  const products = new Set(consumesProducts ?? []);
  const isInsurer = partnerType === "INSURER";
  const items: NavItem[] = [...CONSOLE_BASE];

  if (products.has("RECORDS")) items.splice(1, 0, ...RECORDS_NAV);
  if (products.has("INSURANCE") && !isInsurer)
    items.splice(1, 0, ...INSURANCE_FINTECH_NAV);

  return items;
}

function detectSection(pathname: string): NavSection {
  return pathname.startsWith("/portal/cover") ? "cover" : "console";
}

// ── Component ──────────────────────────────────────────────────────

export default function PartnerShell({
  children,
  partnerName,
  partnerType,
  consumesProducts,
  impersonation,
}: {
  children: React.ReactNode;
  partnerName: string;
  partnerType?: string;
  consumesProducts?: string[];
  impersonation?: {
    staffEmail: string | null;
    startedAt: string;
  } | null;
}) {
  const pathname = usePathname() ?? "/portal/overview";
  const isInsurer = partnerType === "INSURER";
  const hasCover = isInsurer;

  const activeSection = detectSection(pathname);
  const consoleItems = buildConsoleNav(partnerType, consumesProducts);
  const navItems = activeSection === "cover" ? COVER_NAV : consoleItems;

  const isActive = (href: string) => {
    if (!href.startsWith("/portal")) return false;
    if (href === "/portal/overview" || href === "/portal/cover")
      return pathname === href;
    return pathname.startsWith(href);
  };

  return (
    <div className="min-h-screen bg-white">
      {impersonation ? (
        <div className="sticky top-0 z-40 bg-[#fff8e5] border-b border-[#f5d28a]">
          <div className="max-w-[1400px] mx-auto px-4 lg:px-6 py-2 flex items-center justify-between gap-4 text-[12px] text-[#7a4a00] flex-wrap">
            <div className="inline-flex items-center gap-2">
              <Eye size={13} />
              <span>
                <strong>Viewing portal as {partnerName}.</strong> Every
                action you take is logged as staff_impersonating
                {impersonation.staffEmail
                  ? ` (${impersonation.staffEmail})`
                  : ""}
                .
              </span>
            </div>
            <form action={endImpersonation}>
              <button
                type="submit"
                className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#7a4a00] text-white text-[11px] font-medium hover:bg-[#5a3700]"
              >
                End session
              </button>
            </form>
          </div>
        </div>
      ) : null}

      <header
        className={`sticky z-30 bg-white border-b border-black/[0.06] ${
          impersonation ? "top-[37px]" : "top-0"
        }`}
      >
        <div className="max-w-[1400px] mx-auto px-4 lg:px-6 h-[60px] flex items-center justify-between gap-4">
          <Link href="/portal/overview" className="flex items-center gap-2">
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
          {/* Section switcher — only when both sections exist */}
          {hasCover && (
            <div className="flex rounded-lg bg-black/[0.04] p-0.5 mb-5">
              <Link
                href="/portal/overview"
                className={`flex-1 text-center px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors ${
                  activeSection === "console"
                    ? "bg-white text-accent-ink shadow-sm"
                    : "text-accent-ink/50 hover:text-accent-ink/75"
                }`}
              >
                API Console
              </Link>
              <Link
                href="/portal/cover"
                className={`flex-1 text-center px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors ${
                  activeSection === "cover"
                    ? "bg-white text-accent-ink shadow-sm"
                    : "text-accent-ink/50 hover:text-accent-ink/75"
                }`}
              >
                Cover
              </Link>
            </div>
          )}

          <nav className="space-y-1">
            {navItems.map((item) => {
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
