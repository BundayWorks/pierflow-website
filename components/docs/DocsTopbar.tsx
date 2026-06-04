"use client";

import Link from "next/link";
import { useState } from "react";
import { Search as SearchIcon, ArrowUpRight, Menu, X } from "lucide-react";
import Logo from "@/components/shared/Logo";
import DocsSearch from "./DocsSearch";

export default function DocsTopbar({
  onMobileMenuToggle,
  mobileMenuOpen,
}: {
  onMobileMenuToggle: () => void;
  mobileMenuOpen: boolean;
}) {
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-40 bg-white border-b border-black/[0.06]">
        <div className="max-w-[1400px] mx-auto px-4 lg:px-6 h-[64px] flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <Logo variant="dark" size="sm" />
            <span className="hidden sm:inline text-[14px] text-accent-ink/55 ml-1">
              Docs
            </span>
          </Link>

          <div className="flex-1 max-w-[680px] mx-auto hidden md:block">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="w-full h-10 px-4 rounded-full border border-black/[0.08] bg-bgl-alt flex items-center justify-between gap-3 hover:border-black/15 transition-colors"
            >
              <span className="flex items-center gap-3 text-[14px] text-accent-ink/55">
                <SearchIcon size={16} />
                Search docs
              </span>
              <kbd className="text-[11px] font-mono text-accent-ink/45 bg-white border border-black/[0.08] rounded px-1.5 py-0.5">
                ⌘K
              </kbd>
            </button>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/"
              className="hidden sm:inline-flex items-center gap-1 text-[13px] text-accent-ink/65 hover:text-accent-ink px-3 py-2 rounded-full"
            >
              Pierflow.com <ArrowUpRight size={13} />
            </Link>
            <Link
              href="/get-started"
              className="text-[13px] font-medium px-4 py-2 rounded-full bg-accent-ink text-white hover:opacity-95"
            >
              Get started
            </Link>
            <button
              aria-label="Toggle docs menu"
              onClick={onMobileMenuToggle}
              className="lg:hidden text-accent-ink p-2 ml-1"
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile-only search trigger */}
        <div className="md:hidden border-t border-black/[0.06] px-4 py-2.5">
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="w-full h-9 px-3 rounded-full border border-black/[0.08] bg-bgl-alt flex items-center gap-2 text-[13px] text-accent-ink/55"
          >
            <SearchIcon size={14} />
            Search docs
          </button>
        </div>
      </header>

      <DocsSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
