import Link from "next/link";
import { listPartners } from "./actions";
import { ArrowRight, Building2, CheckCircle2, Clock, XCircle, Sparkles } from "lucide-react";

export const dynamic = "force-dynamic";

const TABS = [
  { label: "Awaiting sandbox", value: "PENDING_SANDBOX" as const },
  { label: "Sandbox", value: "SANDBOX" as const },
  { label: "Production requested", value: "PRODUCTION_REQUESTED" as const },
  { label: "Production", value: "PRODUCTION" as const },
  { label: "All", value: "ALL" as const },
];

export default async function PartnersInboxPage({
  searchParams,
}: {
  searchParams?: { status?: string };
}) {
  const filter =
    (TABS.map((t) => t.value as string).includes(searchParams?.status ?? "")
      ? (searchParams?.status as (typeof TABS)[number]["value"])
      : "PENDING_SANDBOX");

  const partners = await listPartners({ status: filter });

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.16em] text-accent-emerald">
        Inbox
      </p>
      <h1 className="mt-2 font-display text-[32px] md:text-[40px] leading-[1.05] tracking-[-0.02em] text-accent-ink font-medium">
        Partners
      </h1>
      <p className="mt-3 text-[15px] leading-[1.7] text-accent-ink/65 max-w-[640px]">
        Approve sandbox access for newly signed-up partners, review production
        access requests, or browse the full directory.
      </p>

      <div className="mt-6 flex items-center gap-2 text-[12px] flex-wrap">
        {TABS.map((tab) => {
          const active = tab.value === filter;
          return (
            <Link
              key={tab.value}
              href={`/portal/partners?status=${tab.value}`}
              className={`px-3 py-1.5 rounded-full ${
                active
                  ? "bg-accent-ink text-white"
                  : "border border-black/[0.1] text-accent-ink/65 hover:text-accent-ink"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {partners.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-black/[0.12] p-10 text-center">
          <p className="text-[14px] text-accent-ink/55">
            Nothing here right now.
          </p>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {partners.map((p) => (
            <li key={p.id}>
              <Link
                href={`/portal/partners/${p.id}`}
                className="block rounded-xl border border-black/[0.08] p-4 hover:border-black/25 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <span className="w-9 h-9 rounded-xl bg-accent-teal-light text-accent-emerald grid place-items-center shrink-0">
                    <Building2 size={16} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-[14px] font-medium text-accent-ink truncate">
                        {p.name}
                      </p>
                      <StatusChip status={p.accessStatus} />
                      <span className="text-[10px] uppercase tracking-[0.12em] text-accent-ink/55 font-medium">
                        {p.type.replace(/_/g, " ").toLowerCase()}
                      </span>
                    </div>
                    <p className="mt-1 text-[12px] text-accent-ink/55 truncate">
                      {p.users[0]?.email ?? "—"} ·{" "}
                      {new Date(p.createdAt).toLocaleString()}
                    </p>
                    {p.primaryUseCase ? (
                      <p className="mt-1.5 text-[12px] text-accent-ink/65 line-clamp-1">
                        {p.primaryUseCase}
                        {p.expectedVolume ? ` · ${p.expectedVolume}` : ""}
                        {p.timeline ? ` · ${p.timeline}` : ""}
                      </p>
                    ) : null}
                  </div>
                  <ArrowRight
                    size={16}
                    className="text-accent-ink/30 shrink-0"
                  />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  if (status === "PENDING_SANDBOX") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.12em] font-medium px-2 py-0.5 rounded-full bg-[#fff4d4] text-[#7a4a00]">
        <Clock size={10} />
        Awaiting sandbox
      </span>
    );
  }
  if (status === "SANDBOX") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.12em] font-medium px-2 py-0.5 rounded-full bg-card-mint text-accent-emerald">
        <CheckCircle2 size={10} />
        Sandbox
      </span>
    );
  }
  if (status === "PRODUCTION_REQUESTED") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.12em] font-medium px-2 py-0.5 rounded-full bg-[#cfdcff] text-[#1b3a8e]">
        <Sparkles size={10} />
        Prod requested
      </span>
    );
  }
  if (status === "PRODUCTION") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.12em] font-medium px-2 py-0.5 rounded-full bg-accent-emerald text-white">
        <CheckCircle2 size={10} />
        Production
      </span>
    );
  }
  if (status === "SUSPENDED") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.12em] font-medium px-2 py-0.5 rounded-full bg-[#fde6e6] text-[#a83232]">
        <XCircle size={10} />
        Suspended
      </span>
    );
  }
  return null;
}
