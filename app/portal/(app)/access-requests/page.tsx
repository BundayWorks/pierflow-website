import Link from "next/link";
import { listAccessRequests } from "./actions";
import { ArrowRight, Building2, CheckCircle2, Clock, XCircle } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AccessRequestsPage({
  searchParams,
}: {
  searchParams?: { status?: string };
}) {
  const showAll = searchParams?.status === "all";
  const requests = await listAccessRequests({
    status: showAll ? "ALL" : "PENDING",
  });

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.16em] text-accent-emerald">
        Inbox
      </p>
      <h1 className="mt-2 font-display text-[32px] md:text-[40px] leading-[1.05] tracking-[-0.02em] text-accent-ink font-medium">
        Access requests
      </h1>
      <p className="mt-3 text-[15px] leading-[1.7] text-accent-ink/65 max-w-[640px]">
        Submissions from{" "}
        <code className="text-[13px]">pierflow.com/developers/request-access</code>.
        Open each one to review, approve and issue an API key, or reject with a
        note. The requester is notified by email automatically.
      </p>

      <div className="mt-6 flex items-center gap-2 text-[12px]">
        <Link
          href="/portal/access-requests"
          className={`px-3 py-1.5 rounded-full ${
            !showAll
              ? "bg-accent-ink text-white"
              : "border border-black/[0.1] text-accent-ink/65 hover:text-accent-ink"
          }`}
        >
          Pending
        </Link>
        <Link
          href="/portal/access-requests?status=all"
          className={`px-3 py-1.5 rounded-full ${
            showAll
              ? "bg-accent-ink text-white"
              : "border border-black/[0.1] text-accent-ink/65 hover:text-accent-ink"
          }`}
        >
          All
        </Link>
      </div>

      {requests.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-black/[0.12] p-10 text-center">
          <p className="text-[14px] text-accent-ink/55">
            {showAll
              ? "No access requests yet."
              : "No pending requests. New submissions will show up here."}
          </p>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {requests.map((r) => (
            <li key={r.id}>
              <Link
                href={`/portal/access-requests/${r.id}`}
                className="block rounded-xl border border-black/[0.08] p-4 hover:border-black/25 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <span className="w-9 h-9 rounded-xl bg-accent-teal-light text-accent-emerald grid place-items-center shrink-0">
                    <Building2 size={16} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-[14px] font-medium text-accent-ink truncate">
                        {r.company}
                      </p>
                      <StatusChip status={r.status} />
                      <span className="text-[10px] uppercase tracking-[0.12em] text-accent-ink/55 font-medium">
                        {r.partnerType.replace(/_/g, " ").toLowerCase()}
                      </span>
                    </div>
                    <p className="mt-1 text-[12px] text-accent-ink/55 truncate">
                      {r.name} · {r.email} ·{" "}
                      {new Date(r.createdAt).toLocaleString()}
                    </p>
                    <p className="mt-1.5 text-[12px] text-accent-ink/65 line-clamp-2">
                      {r.useCase}
                    </p>
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
  if (status === "PENDING") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.12em] font-medium px-2 py-0.5 rounded-full bg-[#fff4d4] text-[#7a4a00]">
        <Clock size={10} />
        Pending
      </span>
    );
  }
  if (status === "APPROVED") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.12em] font-medium px-2 py-0.5 rounded-full bg-card-mint text-accent-emerald">
        <CheckCircle2 size={10} />
        Approved
      </span>
    );
  }
  if (status === "REJECTED") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.12em] font-medium px-2 py-0.5 rounded-full bg-[#fde6e6] text-[#a83232]">
        <XCircle size={10} />
        Rejected
      </span>
    );
  }
  return (
    <span className="text-[10px] uppercase tracking-[0.12em] font-medium px-2 py-0.5 rounded-full bg-bgl-alt text-accent-ink/55">
      {status}
    </span>
  );
}
