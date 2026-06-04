import Link from "next/link";
import { listOrganizations } from "./actions";
import {
  Building2,
  CheckCircle2,
  Clock,
  XCircle,
  ArrowRight,
  AlertCircle,
} from "lucide-react";

export const dynamic = "force-dynamic";

const TABS = [
  { label: "Pending", value: "PENDING" as const },
  { label: "Active", value: "ACTIVE" as const },
  { label: "Rejected", value: "REJECTED" as const },
  { label: "Suspended", value: "SUSPENDED" as const },
  { label: "All", value: "ALL" as const },
];

export default async function OrganizationsInboxPage({
  searchParams,
}: {
  searchParams?: { status?: string };
}) {
  const filter = TABS.map((t) => t.value as string).includes(
    searchParams?.status ?? "",
  )
    ? (searchParams?.status as (typeof TABS)[number]["value"])
    : "PENDING";
  const orgs = await listOrganizations({ status: filter });

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.16em] text-accent-emerald">
        Inbox
      </p>
      <h1 className="mt-2 font-display text-[32px] md:text-[40px] leading-[1.05] tracking-[-0.02em] text-accent-ink font-medium">
        Organizations
      </h1>
      <p className="mt-3 text-[15px] leading-[1.7] text-accent-ink/65 max-w-[640px]">
        Customer organizations partners have registered. Approve to grant the
        partner an organizationLink + enable ingest, or reject with a note
        the partner will see.
      </p>

      <div className="mt-6 flex items-center gap-2 text-[12px] flex-wrap">
        {TABS.map((tab) => {
          const active = tab.value === filter;
          return (
            <Link
              key={tab.value}
              href={`/portal/customer-orgs?status=${tab.value}`}
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

      {orgs.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-black/[0.12] p-10 text-center">
          <p className="text-[14px] text-accent-ink/55">
            Nothing here right now.
          </p>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {orgs.map((o) => (
            <li key={o.id}>
              <Link
                href={`/portal/customer-orgs/${o.id}`}
                className="block rounded-xl border border-black/[0.08] p-4 hover:border-black/25 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <span className="w-9 h-9 rounded-xl bg-accent-teal-light text-accent-emerald grid place-items-center shrink-0">
                    <Building2 size={16} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-[14px] font-medium text-accent-ink truncate">
                        {o.name}
                      </p>
                      <Chip status={o.accessStatus} />
                      <span className="text-[10px] uppercase tracking-[0.12em] text-accent-ink/55 font-medium">
                        {o.type.replace(/_/g, " ").toLowerCase()}
                      </span>
                    </div>
                    <p className="mt-1 text-[12px] text-accent-ink/55 truncate">
                      Requested by{" "}
                      {o.requestedByPartner?.name ?? "Pierflow staff"} ·{" "}
                      {new Date(o.createdAt).toLocaleString()}
                    </p>
                    {o.mrnSystem ? (
                      <p className="mt-1 text-[11px] font-mono text-accent-ink/55 truncate">
                        MRN: {o.mrnSystem}
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
  if (status === "REJECTED") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.12em] font-medium px-2 py-0.5 rounded-full bg-[#fde6e6] text-[#a83232]">
        <XCircle size={10} /> Rejected
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
