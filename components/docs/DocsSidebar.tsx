"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Rocket,
  TerminalSquare,
  ShieldCheck,
  Layers,
  Box,
  Webhook,
  Wallet,
  Sparkles,
  Lock,
  BookOpen,
  FileText,
  type LucideIcon,
} from "lucide-react";
import { DOCS_TREE, type DocSection, type DocPage } from "@/lib/docs-structure";

const ICONS: Record<string, LucideIcon> = {
  Home,
  Rocket,
  TerminalSquare,
  ShieldCheck,
  Layers,
  Box,
  Webhook,
  Wallet,
  Sparkles,
  Lock,
  BookOpen,
  FileText,
};

function hrefFor(p: DocPage) {
  return `/docs${p.path ? "/" + p.path : ""}`;
}

export default function DocsSidebar({
  onLinkClick,
}: {
  onLinkClick?: () => void;
}) {
  const pathname = usePathname() ?? "/docs";

  return (
    <nav className="text-[13px]">
      {DOCS_TREE.map((section) => (
        <SectionBlock
          key={section.title}
          section={section}
          pathname={pathname}
          onLinkClick={onLinkClick}
        />
      ))}
    </nav>
  );
}

function SectionBlock({
  section,
  pathname,
  onLinkClick,
}: {
  section: DocSection;
  pathname: string;
  onLinkClick?: () => void;
}) {
  const Icon = section.icon ? ICONS[section.icon] : null;
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 px-3 mb-2">
        {Icon && <Icon size={14} className="text-accent-ink/55" />}
        <span className="text-[11px] uppercase tracking-[0.14em] text-accent-ink/55 font-medium">
          {section.title}
        </span>
      </div>
      <ul>
        {section.pages.map((p) => {
          const href = hrefFor(p);
          const isActive = pathname === href;
          return (
            <li key={p.slug}>
              <Link
                href={href}
                onClick={onLinkClick}
                className={`block px-3 py-1.5 rounded-md text-[13px] ${
                  isActive
                    ? "bg-accent-teal-light text-accent-emerald font-medium"
                    : "text-accent-ink/75 hover:text-accent-ink hover:bg-black/[0.03]"
                }`}
              >
                {p.title}
              </Link>
              {isActive && p.anchors && (
                <ul className="mt-1 mb-2 ml-3 border-l border-black/[0.08]">
                  {p.anchors.map((a) => (
                    <li key={a.hash}>
                      <Link
                        href={`${href}#${a.hash}`}
                        onClick={onLinkClick}
                        className="block pl-4 py-1 text-[12px] text-accent-ink/55 hover:text-accent-emerald"
                      >
                        # {a.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
