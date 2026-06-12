import Link from "next/link";
import { Receipt, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { listDiscrepanciesAction } from "./actions";
import DiscrepancyRow from "./DiscrepancyRow";

export const dynamic = "force-dynamic";

const TABS = [
  { label: "Open", value: "OPEN" as const },
  { label: "Acknowledged", value: "ACKNOWLEDGED" as const },
  { label: "Resolved", value: "RESOLVED" as const },
  { label: "Written off", value: "WRITTEN_OFF" as const },
  { label: "All", value: "ALL" as const },
];

function formatSignedNaira(kobo: bigint): string {
  const abs = kobo < BigInt(0) ? -kobo : kobo;
  const sign = kobo < BigInt(0) ? "−" : "+";
  return `${sign}₦${(Number(abs) / 100).toLocaleString()}`;
}

export default async function ReconciliationPage({
  searchParams,
}: {
  searchParams?: { status?: string };
}) {
  const filter = TABS.map((t) => t.value as string).includes(
    searchParams?.status ?? "",
  )
    ? (searchParams?.status as (typeof TABS)[number]["value"])
    : "OPEN";
  const items = await listDiscrepanciesAction(filter);

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.16em] text-accent-emerald">
        Insurance
      </p>
      <h1 className="mt-2 font-display text-[32px] md:text-[40px] leading-[1.05] tracking-[-0.02em] text-accent-ink font-medium">
        Settlement reconciliation
      </h1>
      <p className="mt-3 text-[15px] leading-[1.7] text-accent-ink/65 max-w-[640px]">
        Compares the settlement instructions Pierflow issued against
        what fintechs reported as actually credited. Non-zero deltas
        land here for review.
      </p>

      <div className="mt-6 flex items-center gap-2 text-[12px] flex-wrap">
        {TABS.map((tab) => {
          const active = tab.value === filter;
          return (
            <Link
              key={tab.value}
              href={`/portal/reconciliation?status=${tab.value}`}
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

      {items.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-black/[0.12] p-10 text-center">
          <p className="text-[14px] text-accent-ink/55">
            Nothing in this queue. Every recent enrollment is balanced
            (or hasn&apos;t been reported yet).
          </p>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {items.map((d) => (
            <li
              key={d.id}
              className="rounded-xl border border-black/[0.08] p-4"
            >
              <div className="flex items-center gap-3 flex-wrap">
                <span className="w-8 h-8 rounded-lg bg-accent-teal-light text-accent-emerald grid place-items-center shrink-0">
                  <Receipt size={14} />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-[13px] font-medium text-accent-ink">
                      {d.enrollment?.fintechUserRef ?? "(unknown user)"}
                    </p>
                    <StatusChip status={d.status} />
                    <span className="text-[10px] uppercase tracking-[0.12em] text-accent-ink/55">
                      enrollment {d.enrollmentId?.slice(0, 8) ?? "—"}…
                    </span>
                  </div>
                  <p className="mt-1 text-[12px] text-accent-ink/55">
                    Detected {new Date(d.detectedAt).toLocaleString()} ·
                    delta{" "}
                    <span
                      className={`font-mono ${
                        d.deltaNgn > BigInt(0)
                          ? "text-[#a83232]"
                          : d.deltaNgn < BigInt(0)
                            ? "text-[#7a4a00]"
                            : "text-accent-ink/55"
                      }`}
                    >
                      {formatSignedNaira(d.deltaNgn)}
                    </span>
                  </p>
                </div>
              </div>
              <DiscrepancyRow
                discrepancyId={d.id}
                enrollmentId={d.enrollmentId ?? null}
                status={d.status}
                breakdown={d.breakdown as unknown[]}
                notes={d.reviewerNotes ?? ""}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  if (status === "OPEN") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.12em] font-medium px-2 py-0.5 rounded-full bg-[#fde6e6] text-[#a83232]">
        <AlertCircle size={10} /> Open
      </span>
    );
  }
  if (status === "ACKNOWLEDGED") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.12em] font-medium px-2 py-0.5 rounded-full bg-[#fff4d4] text-[#7a4a00]">
        <Clock size={10} /> Acknowledged
      </span>
    );
  }
  if (status === "RESOLVED") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.12em] font-medium px-2 py-0.5 rounded-full bg-card-mint text-accent-emerald">
        <CheckCircle2 size={10} /> Resolved
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.12em] font-medium px-2 py-0.5 rounded-full bg-black/[0.06] text-accent-ink/55">
      {status.replace(/_/g, " ").toLowerCase()}
    </span>
  );
}
