"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Menu, X, ChevronDown } from "lucide-react";
import { NAV_ITEMS, type NavMenu } from "@/lib/constants";
import Logo from "@/components/shared/Logo";

const HOVER_CLOSE_DELAY = 120;

export default function Nav() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname?.startsWith(href);

  // Close on route change
  useEffect(() => {
    setOpenMenu(null);
    setMobileOpen(false);
  }, [pathname]);

  // Close on escape
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenMenu(null);
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, []);

  const openWithCancel = (label: string) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpenMenu(label);
  };

  const scheduleClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpenMenu(null), HOVER_CLOSE_DELAY);
  };

  const activeMenu = NAV_ITEMS.find((i) => i.label === openMenu);

  return (
    <header className="fixed top-4 left-0 right-0 z-50 px-4">
      <div className="mx-auto max-w-[1200px] relative">
        <div className="flex items-center justify-between gap-4 rounded-full bg-white/90 backdrop-blur-md border border-black/5 shadow-[0_8px_30px_rgba(10,31,27,0.08)] pl-4 pr-2 h-[56px]">
          <Link href="/" className="flex items-center shrink-0">
            <Logo variant="dark" size="sm" />
          </Link>

          <nav className="hidden lg:flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <NavItemButton
                key={item.label}
                item={item}
                isActive={isActive(item.href)}
                isOpen={openMenu === item.label}
                onEnter={() => openWithCancel(item.label)}
                onLeave={scheduleClose}
              />
            ))}
          </nav>

          <div className="hidden lg:flex items-center gap-2">
            <Link
              href="/company/contact"
              className="text-[14px] px-4 py-2 rounded-full border border-accent-ink/15 text-accent-ink hover:bg-black/[0.04]"
            >
              Talk to us
            </Link>
            <Link
              href="/developers/request-access"
              className="gradient-ring text-[14px] px-4 py-2 rounded-full bg-accent-ink text-white hover:opacity-95"
            >
              Get API access
            </Link>
          </div>

          <button
            aria-label="Toggle menu"
            className="lg:hidden text-accent-ink p-2"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Mega menu panel */}
        {activeMenu?.menu && (
          <div
            className="hidden lg:block absolute left-1/2 -translate-x-1/2 top-[60px] w-[min(880px,calc(100vw-32px))]"
            onMouseEnter={() => openWithCancel(activeMenu.label)}
            onMouseLeave={scheduleClose}
          >
            <div className="rounded-2xl bg-white border border-black/[0.06] shadow-[0_20px_60px_-10px_rgba(10,31,27,0.18)] p-6">
              <div
                className={`grid gap-x-8 gap-y-6 ${
                  activeMenu.menu.length > 1
                    ? "grid-cols-2"
                    : "grid-cols-1"
                }`}
              >
                {activeMenu.menu.map((section, i) => (
                  <div key={i}>
                    {section.heading && (
                      <p className="text-[11px] uppercase tracking-[0.16em] text-accent-emerald mb-3">
                        {section.heading}
                      </p>
                    )}
                    <ul className="space-y-1">
                      {section.items.map((sub) => (
                        <li key={sub.href}>
                          <Link
                            href={sub.href}
                            className="block rounded-lg px-3 py-2 hover:bg-black/[0.03]"
                          >
                            <p className="text-[14px] font-medium text-accent-ink">
                              {sub.label}
                            </p>
                            {sub.desc && (
                              <p className="text-[12px] text-accent-ink/55 mt-0.5">
                                {sub.desc}
                              </p>
                            )}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="lg:hidden mt-2 rounded-2xl bg-white border border-black/5 shadow-lg p-4 max-h-[80vh] overflow-y-auto">
            <div className="flex flex-col">
              {NAV_ITEMS.map((item) => (
                <MobileSection
                  key={item.label}
                  item={item}
                  onLinkClick={() => setMobileOpen(false)}
                />
              ))}
              <Link
                href="/developers/request-access"
                className="mt-4 text-center text-[14px] px-4 py-2.5 rounded-full bg-accent-ink text-white"
                onClick={() => setMobileOpen(false)}
              >
                Get API access
              </Link>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

function NavItemButton({
  item,
  isActive,
  isOpen,
  onEnter,
  onLeave,
}: {
  item: NavMenu;
  isActive: boolean;
  isOpen: boolean;
  onEnter: () => void;
  onLeave: () => void;
}) {
  return (
    <span
      className="relative"
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      <Link
        href={item.href}
        className={`inline-flex items-center gap-1 text-[14px] px-3 py-1.5 rounded-full transition-colors ${
          isActive || isOpen
            ? "text-accent-ink bg-black/[0.05]"
            : "text-accent-ink/75 hover:text-accent-ink hover:bg-black/[0.04]"
        }`}
      >
        {item.label}
        {item.menu && (
          <ChevronDown
            size={13}
            className={`opacity-50 transition-transform ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        )}
      </Link>
    </span>
  );
}

function MobileSection({
  item,
  onLinkClick,
}: {
  item: NavMenu;
  onLinkClick: () => void;
}) {
  const [open, setOpen] = useState(false);
  if (!item.menu) {
    return (
      <Link
        href={item.href}
        className="text-[15px] font-medium text-accent-ink/85 hover:text-accent-ink py-3 border-b border-black/[0.06]"
        onClick={onLinkClick}
      >
        {item.label}
      </Link>
    );
  }
  return (
    <div className="border-b border-black/[0.06]">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full text-left py-3 flex items-center justify-between text-[15px] font-medium text-accent-ink/85"
      >
        {item.label}
        <ChevronDown
          size={15}
          className={`opacity-60 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      {open && (
        <div className="pb-3 pl-3 space-y-3">
          {item.menu.map((sec, i) => (
            <div key={i}>
              {sec.heading && (
                <p className="text-[10px] uppercase tracking-[0.16em] text-accent-emerald mb-1">
                  {sec.heading}
                </p>
              )}
              <ul className="space-y-1.5">
                {sec.items.map((sub) => (
                  <li key={sub.href}>
                    <Link
                      href={sub.href}
                      onClick={onLinkClick}
                      className="block text-[14px] text-accent-ink/75 hover:text-accent-ink py-1"
                    >
                      {sub.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
