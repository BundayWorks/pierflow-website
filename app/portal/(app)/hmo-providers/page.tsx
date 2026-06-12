import Link from "next/link";
import {
  Building2,
  CheckCircle2,
  Clock,
  AlertCircle,
  ArrowRight,
  Plus,
} from "lucide-react";
import { listHmoProviders, type HmoProviderListFilter } from "./actions";

export const dynamic = "force-dynamic";

const TABS: { label: string; value: HmoProviderListFilter }[] = [
  { label: "All", value: "ALL" },
  { label: "Pending", value: "PENDING" },
  { label: "Active", value: "ACTIVE" },
  { label: "Suspended", value: "SUSPENDED" },
];

export default async function HmoProvidersPage({
  searchParams,
}: {
  searchParams?: { status?: string };
}) {
  const filter = TABS.map((t) => t.value as string).includes(
    searchParams?.status ?? "",
  )
    ? (searchParams?.status as HmoProviderListFilter)
    : "ALL";
  const providers = await listHmoProviders({ status: filter });

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[12px] uppercase tracking-[0.16em] text-accent-emerald">
            Insurance
          </p>
          <h1 className="mt-2 font-display text-[32px] md:text-[40px] leading-[1.05] tracking-[-0.02em] text-accent-ink font-medium">
            HMO providers
          </h1>
          <p className="mt-3 text-[15px] leading-[1.7] text-accent-ink/65 max-w-[640px]">
            HMOs registered for distribution through Pierflow. Each provider is
            a tenant: register here, capture their contract, and expose their
            catalogue to fintech consumers.
          </p>
        </div>
        <Link
          href="/portal/hmo-providers/new"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent-ink text-white text-[13px] font-medium shrink-0"
        >
          <Plus size={14} /> Register HMO
        </Link>
      </div>

      <div className="mt-6 flex items-center gap-2 text-[12px] flex-wrap">
        {TABS.map((tab) => {
          const active = tab.value === filter;
          return (
            <Link
              key={tab.value}
              href={`/portal/hmo-providers?status=${tab.value}`}
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

      {providers.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-black/[0.12] p-10 text-center">
          <p className="text-[14px] text-accent-ink/55">
            No HMO providers yet. Register the first one to start.
          </p>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {providers.map((p) => (
            <li key={p.id}>
              <Link
                href={`/portal/hmo-providers/${p.slug}`}
                className="block rounded-xl border border-black/[0.08] p-4 hover:border-black/25 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <span className="w-9 h-9 rounded-xl bg-accent-teal-light text-accent-emerald grid place-items-center shrink-0">
                    <Building2 size={16} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-[14px] font-medium text-accent-ink truncate">
                        {p.displayName}
                      </p>
                      <Chip status={p.status} />
                      <span className="text-[10px] uppercase tracking-[0.12em] text-accent-ink/55 font-mono">
                        {p.slug}
                      </span>
                    </div>
                    <p className="mt-1 text-[12px] text-accent-ink/55 truncate">
                      {p._count.plans} plan{p._count.plans === 1 ? "" : "s"} ·{" "}
                      {p._count.contracts} contract
                      {p._count.contracts === 1 ? "" : "s"} ·{" "}
                      {new Date(p.createdAt).toLocaleDateString()}
                    </p>
                    {p.registrationNo ? (
                      <p className="mt-1 text-[11px] font-mono text-accent-ink/55 truncate">
                        Reg #: {p.registrationNo}
                      </p>
                    ) : null}
                  </div>
                  <ArrowRight size={16} className="text-accent-ink/30 shrink-0" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Chip({ status }: { status: string }) {
  if (status === "PENDING") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.12em] font-medium px-2 py-0.5 rounded-full bg-[#fff4d4] text-[#7a4a00]">
        <Clock size={10} /> Pending
      </span>
    );
  }
  if (status === "ACTIVE") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.12em] font-medium px-2 py-0.5 rounded-full bg-card-mint text-accent-emerald">
        <CheckCircle2 size={10} /> Active
      </span>
    );
  }
  if (status === "SUSPENDED") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.12em] font-medium px-2 py-0.5 rounded-full bg-[#fde6e6] text-[#a83232]">
        <AlertCircle size={10} /> Suspended
      </span>
    );
  }
  return null;
}
