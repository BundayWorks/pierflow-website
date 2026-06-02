import Link from "next/link";
import { ArrowRight, Info, AlertTriangle, BookOpen, Key } from "lucide-react";

/* ─────────────────────────── Page header ─────────────────────────── */
export function DocPageHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
}) {
  return (
    <header className="mb-10 not-prose">
      {eyebrow && (
        <p className="text-[12px] uppercase tracking-[0.16em] text-accent-emerald font-medium">
          {eyebrow}
        </p>
      )}
      <h1 className="mt-2 font-display text-[34px] md:text-[44px] leading-[1.05] tracking-[-0.02em] text-accent-ink font-medium">
        {title}
      </h1>
      {description && (
        <p className="mt-4 text-[17px] md:text-[18px] leading-[1.55] text-accent-ink/70 max-w-[680px]">
          {description}
        </p>
      )}
    </header>
  );
}

/* ─────────────────────────── Anchored heading ─────────────────────────── */
export function H2({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  return (
    <h2
      id={id}
      className="group scroll-mt-24 mt-14 mb-4 font-display text-[24px] md:text-[28px] tracking-[-0.01em] text-accent-ink font-medium flex items-center gap-2"
    >
      <span>{children}</span>
      <a
        href={`#${id}`}
        aria-label="Link to this section"
        className="opacity-0 group-hover:opacity-60 hover:opacity-100 text-accent-emerald text-[14px] font-normal no-underline"
      >
        #
      </a>
    </h2>
  );
}

export function H3({
  id,
  children,
}: {
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <h3
      id={id}
      className="scroll-mt-24 mt-10 mb-3 text-[18px] md:text-[20px] text-accent-ink font-medium"
    >
      {children}
    </h3>
  );
}

/* ─────────────────────────── Lead / body text ─────────────────────────── */
export function Lead({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[16px] leading-[1.7] text-accent-ink/75 mb-5">
      {children}
    </p>
  );
}

export function Body({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[15px] leading-[1.75] text-accent-ink/80 mb-5">
      {children}
    </p>
  );
}

/* ─────────────────────────── Callout ─────────────────────────── */
export function Callout({
  kind = "info",
  title,
  children,
}: {
  kind?: "info" | "warn" | "tip";
  title?: string;
  children: React.ReactNode;
}) {
  const palette = {
    info: {
      icon: Info,
      bg: "bg-card-sky",
      border: "border-[#bce0f0]",
      iconColor: "text-[#1f6f99]",
    },
    warn: {
      icon: AlertTriangle,
      bg: "bg-[#fff7e6]",
      border: "border-[#f3d28a]",
      iconColor: "text-[#a06b00]",
    },
    tip: {
      icon: BookOpen,
      bg: "bg-card-mint",
      border: "border-[#bbe9d6]",
      iconColor: "text-accent-emerald",
    },
  }[kind];
  const Icon = palette.icon;
  return (
    <div
      className={`not-prose my-6 rounded-2xl border ${palette.border} ${palette.bg} p-5 flex gap-4`}
    >
      <Icon size={18} className={`${palette.iconColor} shrink-0 mt-0.5`} />
      <div className="flex-1 min-w-0 text-[14px] leading-[1.6] text-accent-ink/85">
        {title && (
          <p className="font-medium text-accent-ink mb-1">{title}</p>
        )}
        <div className="[&_a]:text-accent-emerald [&_a]:underline">
          {children}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── Key / field card row ─────────────────────────── */
export function FieldCardList({ children }: { children: React.ReactNode }) {
  return (
    <div className="not-prose my-6 rounded-2xl border border-black/[0.08] divide-y divide-black/[0.06] overflow-hidden">
      {children}
    </div>
  );
}

export function FieldCard({
  name,
  description,
  required,
  type,
}: {
  name: string;
  description: React.ReactNode;
  required?: boolean;
  type?: string;
}) {
  return (
    <div className="flex flex-col md:flex-row md:items-start gap-4 md:gap-6 p-5">
      <div className="flex items-start gap-3 md:w-[260px] shrink-0">
        <Key size={16} className="text-accent-ink/45 mt-1 shrink-0" />
        <div className="min-w-0">
          <p className="font-mono text-[13px] text-accent-ink font-medium break-all">
            {name}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] font-mono">
            {type && (
              <span className="text-accent-ink/55 bg-bgl-alt px-1.5 py-0.5 rounded">
                {type}
              </span>
            )}
            {required && (
              <span className="text-[#a06b00] bg-[#fff4d4] px-1.5 py-0.5 rounded">
                required
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="flex-1 text-[14px] leading-[1.6] text-accent-ink/80">
        {description}
      </div>
    </div>
  );
}

/* ─────────────────────────── Key/Value table ─────────────────────────── */
export function KVTable({
  rows,
  headers,
}: {
  rows: (string | React.ReactNode)[][];
  headers?: string[];
}) {
  return (
    <div className="not-prose my-6 overflow-x-auto rounded-2xl border border-black/[0.08]">
      <table className="w-full text-[13px]">
        {headers && (
          <thead className="bg-bgl-alt">
            <tr>
              {headers.map((h) => (
                <th
                  key={h}
                  className="text-left px-4 py-2.5 font-medium text-accent-ink/65 text-[12px] uppercase tracking-[0.12em]"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody className="divide-y divide-black/[0.06]">
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td
                  key={j}
                  className={`px-4 py-3 align-top ${
                    j === 0
                      ? "font-mono text-accent-ink whitespace-nowrap"
                      : "text-accent-ink/75"
                  }`}
                >
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─────────────────────────── Code block ─────────────────────────── */
export function Code({
  language,
  filename,
  children,
}: {
  language?: string;
  filename?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="not-prose my-6 rounded-2xl overflow-hidden border border-[#1e2e29] bg-[#0a1f1b]">
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/10">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#28c940]" />
          {(filename || language) && (
            <span className="ml-3 text-[11px] font-mono text-white/55">
              {filename ?? language}
            </span>
          )}
        </div>
        {language && (
          <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-white/40">
            {language}
          </span>
        )}
      </div>
      <pre className="px-5 py-4 text-[12.5px] leading-[1.65] font-mono text-white/90 overflow-x-auto">
        <code>{children}</code>
      </pre>
    </div>
  );
}

/* ─────────────────────────── Endpoint badge row ─────────────────────────── */
export function Endpoint({
  method,
  path,
}: {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
}) {
  const color = {
    GET: "text-[#0a7c6e] bg-accent-teal-light",
    POST: "text-[#1f6f99] bg-card-sky",
    PUT: "text-[#7a4a00] bg-[#fff4d4]",
    PATCH: "text-[#7a4a00] bg-[#fff4d4]",
    DELETE: "text-[#a83232] bg-[#fde6e6]",
  }[method];
  return (
    <div className="not-prose my-4 flex items-center gap-2 rounded-xl border border-black/[0.08] bg-bgl-alt p-3">
      <span
        className={`font-mono text-[11px] font-semibold px-2 py-1 rounded ${color}`}
      >
        {method}
      </span>
      <code className="font-mono text-[13px] text-accent-ink">{path}</code>
    </div>
  );
}

/* ─────────────────────────── CTA row (Plaid landing-page style) ─────────────────────────── */
export function CtaRow({
  items,
}: {
  items: { icon?: React.ReactNode; label: string; href: string }[];
}) {
  return (
    <div className="not-prose my-8 flex flex-wrap gap-3">
      {items.map((i) => (
        <Link
          key={i.href + i.label}
          href={i.href}
          className="inline-flex items-center gap-2 text-[14px] font-medium px-4 py-2.5 rounded-xl border border-black/[0.1] bg-white hover:border-black/30 transition-colors"
        >
          {i.icon}
          {i.label}
          <ArrowRight size={14} className="opacity-50" />
        </Link>
      ))}
    </div>
  );
}

/* ─────────────────────────── Prev / Next nav ─────────────────────────── */
export function PrevNext({
  prev,
  next,
}: {
  prev?: { label: string; href: string };
  next?: { label: string; href: string };
}) {
  return (
    <nav className="not-prose mt-16 pt-8 border-t border-black/[0.06] grid grid-cols-2 gap-4">
      <div>
        {prev && (
          <Link
            href={prev.href}
            className="block rounded-xl border border-black/[0.08] p-4 hover:border-black/25 transition-colors"
          >
            <p className="text-[11px] uppercase tracking-[0.14em] text-accent-ink/50">
              ← Previous
            </p>
            <p className="mt-1 text-[14px] font-medium text-accent-ink">
              {prev.label}
            </p>
          </Link>
        )}
      </div>
      <div>
        {next && (
          <Link
            href={next.href}
            className="block rounded-xl border border-black/[0.08] p-4 text-right hover:border-black/25 transition-colors"
          >
            <p className="text-[11px] uppercase tracking-[0.14em] text-accent-ink/50">
              Next →
            </p>
            <p className="mt-1 text-[14px] font-medium text-accent-ink">
              {next.label}
            </p>
          </Link>
        )}
      </div>
    </nav>
  );
}
