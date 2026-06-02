"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X, CornerDownLeft } from "lucide-react";
import { DOCS_FLAT } from "@/lib/docs-structure";

type Hit = {
  title: string;
  href: string;
  section: string;
  summary?: string;
  match?: string;
  matchHash?: string;
};

const ALL_ENTRIES: Hit[] = DOCS_FLAT.flatMap((p) => {
  const base: Hit = {
    title: p.title,
    href: `/docs${p.path ? "/" + p.path : ""}`,
    section: p.sectionTitle,
    summary: p.summary,
  };
  const children = (p.anchors ?? []).map((a) => ({
    ...base,
    href: `${base.href}#${a.hash}`,
    match: a.label,
    matchHash: a.hash,
  }));
  return [base, ...children];
});

function score(entry: Hit, q: string): number {
  if (!q) return 0;
  const hay = `${entry.title} ${entry.match ?? ""} ${entry.section} ${
    entry.summary ?? ""
  }`.toLowerCase();
  const needle = q.toLowerCase();
  if (entry.title.toLowerCase() === needle) return 1000;
  if ((entry.match ?? "").toLowerCase() === needle) return 900;
  if (entry.title.toLowerCase().startsWith(needle)) return 800;
  if (hay.includes(needle)) return 500;
  // crude subsequence match
  let i = 0;
  for (const ch of hay) if (ch === needle[i]) i++;
  return i === needle.length ? 100 : 0;
}

export default function DocsSearch({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    if (!q.trim()) return ALL_ENTRIES.slice(0, 8);
    return ALL_ENTRIES.map((e) => ({ e, s: score(e, q) }))
      .filter(({ s }) => s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 20)
      .map(({ e }) => e);
  }, [q]);

  useEffect(() => {
    if (open) {
      setQ("");
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  // ⌘K / Ctrl+K to open
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (!open) inputRef.current?.focus();
      }
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-start justify-center pt-[10vh] px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[640px] bg-white rounded-2xl border border-black/[0.06] shadow-[0_30px_80px_-20px_rgba(10,31,27,0.25)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-5 h-14 border-b border-black/[0.06]">
          <Search size={18} className="text-accent-ink/50 shrink-0" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown")
                setActive((a) => Math.min(a + 1, results.length - 1));
              if (e.key === "ArrowUp") setActive((a) => Math.max(a - 1, 0));
              if (e.key === "Enter" && results[active]) {
                window.location.href = results[active].href;
              }
            }}
            placeholder="Search the docs… (try plans, webhook, identity_confidence)"
            className="flex-1 bg-transparent outline-none text-[15px] text-accent-ink placeholder:text-accent-ink/40"
          />
          <button
            onClick={onClose}
            className="text-accent-ink/50 hover:text-accent-ink p-1"
          >
            <X size={16} />
          </button>
        </div>

        <ul className="max-h-[60vh] overflow-y-auto py-2">
          {results.length === 0 && (
            <li className="px-5 py-6 text-[14px] text-accent-ink/55">
              No matches.
            </li>
          )}
          {results.map((r, i) => (
            <li key={`${r.href}-${i}`}>
              <Link
                href={r.href}
                onClick={onClose}
                onMouseEnter={() => setActive(i)}
                className={`flex items-start gap-3 px-5 py-3 ${
                  i === active ? "bg-bgl-alt" : "bg-white"
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] uppercase tracking-[0.14em] text-accent-emerald">
                    {r.section}
                  </p>
                  <p className="mt-0.5 text-[14px] font-medium text-accent-ink truncate">
                    {r.match ? `${r.title} · ${r.match}` : r.title}
                  </p>
                  {r.summary && (
                    <p className="mt-0.5 text-[12px] text-accent-ink/55 truncate">
                      {r.summary}
                    </p>
                  )}
                </div>
                <CornerDownLeft
                  size={14}
                  className={`shrink-0 mt-1 ${
                    i === active ? "text-accent-emerald" : "text-accent-ink/30"
                  }`}
                />
              </Link>
            </li>
          ))}
        </ul>

        <div className="border-t border-black/[0.06] px-5 py-2.5 flex items-center gap-4 text-[11px] text-accent-ink/45">
          <span>
            <kbd className="font-mono bg-bgl-alt border border-black/[0.08] rounded px-1.5 py-0.5">
              ↑↓
            </kbd>{" "}
            navigate
          </span>
          <span>
            <kbd className="font-mono bg-bgl-alt border border-black/[0.08] rounded px-1.5 py-0.5">
              ↵
            </kbd>{" "}
            open
          </span>
          <span>
            <kbd className="font-mono bg-bgl-alt border border-black/[0.08] rounded px-1.5 py-0.5">
              esc
            </kbd>{" "}
            close
          </span>
        </div>
      </div>
    </div>
  );
}
