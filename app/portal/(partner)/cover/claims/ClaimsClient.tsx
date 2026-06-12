"use client";

import { useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import type { ClaimRow } from "../actions";
import { adjudicateAction } from "./actions";

const STATUSES = [
  "ALL",
  "SUBMITTED",
  "PENDING_HMO",
  "UNDER_REVIEW",
  "APPROVED",
  "REJECTED",
  "PAID",
] as const;

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    SUBMITTED: "bg-blue-50 text-blue-700",
    PENDING_HMO: "bg-amber-50 text-amber-700",
    UNDER_REVIEW: "bg-amber-50 text-amber-700",
    APPROVED: "bg-emerald-50 text-emerald-700",
    REJECTED: "bg-red-50 text-red-700",
    PAID: "bg-emerald-50 text-emerald-700",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${
        colors[status] ?? "bg-gray-50 text-gray-600"
      }`}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

function koboToNaira(kobo: string): string {
  return (Number(kobo) / 100).toLocaleString("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
  });
}

export default function ClaimsClient({
  initialItems,
  initialNextCursor,
  initialTotalCount,
  fetchClaims,
}: {
  initialItems: ClaimRow[];
  initialNextCursor: string | null;
  initialTotalCount: number;
  fetchClaims: (opts: {
    search?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    cursor?: string;
  }) => Promise<{ items: ClaimRow[]; nextCursor: string | null; totalCount: number }>;
}) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [totalCount, setTotalCount] = useState(initialTotalCount);
  const [cursorStack, setCursorStack] = useState<string[]>([]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, startTransition] = useTransition();

  const [actionPending, setActionPending] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const reviewable = ["SUBMITTED", "PENDING_HMO", "UNDER_REVIEW"];

  const load = useCallback(
    (opts: {
      search?: string;
      status?: string;
      dateFrom?: string;
      dateTo?: string;
      cursor?: string;
    }) => {
      startTransition(async () => {
        const res = await fetchClaims(opts);
        setItems(res.items);
        setNextCursor(res.nextCursor);
        setTotalCount(res.totalCount);
      });
    },
    [fetchClaims],
  );

  function filterOpts(overrides?: {
    search?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
  }) {
    const s = overrides?.search ?? search;
    const st = overrides?.status ?? statusFilter;
    const df = overrides?.dateFrom ?? dateFrom;
    const dt = overrides?.dateTo ?? dateTo;
    return {
      search: s || undefined,
      status: st !== "ALL" ? st : undefined,
      dateFrom: df || undefined,
      dateTo: dt || undefined,
    };
  }

  function applyFilters(overrides?: {
    search?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
  }) {
    setCursorStack([]);
    load(filterOpts(overrides));
  }

  function goNext() {
    if (!nextCursor) return;
    const prevFirst = items[0]?.id;
    if (prevFirst) setCursorStack((s) => [...s, prevFirst]);
    load({ ...filterOpts(), cursor: nextCursor });
  }

  function goPrev() {
    const stack = [...cursorStack];
    stack.pop();
    setCursorStack(stack);
    const cursor = stack.length > 0 ? stack[stack.length - 1] : undefined;
    load({ ...filterOpts(), cursor });
  }

  async function handleApprove(claimId: string, amountNgn: string) {
    setActionPending(claimId);
    await adjudicateAction(claimId, "APPROVED", amountNgn);
    setActionPending(null);
    router.refresh();
  }

  async function handleReject(claimId: string) {
    setActionPending(claimId);
    await adjudicateAction(claimId, "REJECTED", undefined, rejectReason);
    setActionPending(null);
    setRejectId(null);
    setRejectReason("");
    router.refresh();
  }

  const pageNum = cursorStack.length + 1;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[22px] font-semibold text-accent-ink">Claims</h1>
        <p className="text-[14px] text-accent-ink/55 mt-1">
          Review and adjudicate member claims
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-accent-ink/35"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyFilters()}
            placeholder="Search member, facility, claim ID…"
            className="w-full pl-9 pr-3 py-2 border border-black/10 rounded-md text-[13px] focus:outline-none focus:ring-2 focus:ring-accent-emerald/30"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <label className="text-[11px] text-accent-ink/45">From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              applyFilters({ dateFrom: e.target.value });
            }}
            className="px-2 py-1.5 border border-black/10 rounded-md text-[12px] text-accent-ink/75 focus:outline-none focus:ring-2 focus:ring-accent-emerald/30"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <label className="text-[11px] text-accent-ink/45">To</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              applyFilters({ dateTo: e.target.value });
            }}
            className="px-2 py-1.5 border border-black/10 rounded-md text-[12px] text-accent-ink/75 focus:outline-none focus:ring-2 focus:ring-accent-emerald/30"
          />
        </div>
      </div>

      {/* Status chips */}
      <div className="flex gap-1 flex-wrap">
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => {
              setStatusFilter(s);
              applyFilters({ status: s });
            }}
            className={`px-2.5 py-1 rounded-full text-[11px] font-medium ${
              statusFilter === s
                ? "bg-accent-emerald text-white"
                : "bg-black/[0.04] text-accent-ink/65 hover:text-accent-ink"
            }`}
          >
            {s === "ALL" ? "All" : s.replace(/_/g, " ")}
          </button>
        ))}
      </div>

      <p className="text-[12px] text-accent-ink/45">
        {totalCount} claim{totalCount !== 1 ? "s" : ""} found
        {loading ? " — loading…" : ""}
      </p>

      {/* Table */}
      {items.length === 0 ? (
        <div className="mt-8 text-center text-[14px] text-accent-ink/55">
          {totalCount === 0 && !search && statusFilter === "ALL" && !dateFrom && !dateTo
            ? "No claims yet."
            : "No claims match your filters."}
        </div>
      ) : (
        <div className="rounded-xl border border-black/[0.08] overflow-hidden">
          <table className="w-full text-[13px]">
            <thead className="bg-black/[0.03] text-accent-ink/55 uppercase tracking-[0.1em] text-[10px]">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">Member</th>
                <th className="text-left px-4 py-2.5 font-medium">Service</th>
                <th className="text-left px-4 py-2.5 font-medium">Amount</th>
                <th className="text-left px-4 py-2.5 font-medium">Status</th>
                <th className="text-left px-4 py-2.5 font-medium">Date</th>
                <th className="text-left px-4 py-2.5 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.06]">
              {items.map((c) => (
                <tr key={c.id} className="hover:bg-black/[0.02]">
                  <td className="px-4 py-3 font-medium text-accent-ink">
                    {c.memberName}
                  </td>
                  <td className="px-4 py-3 text-accent-ink/70">
                    {c.serviceType ?? "—"}
                    {c.facilityName ? (
                      <span className="block text-[11px] text-accent-ink/40">
                        {c.facilityName}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 font-mono text-[12px]">
                    {koboToNaira(c.amountNgn)}
                    {c.approvedAmountNgn ? (
                      <span className="block text-[11px] text-emerald-600">
                        Approved: {koboToNaira(c.approvedAmountNgn)}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={c.status} />
                    {c.rejectionReason ? (
                      <span className="block text-[11px] text-red-500 mt-0.5 max-w-[200px] truncate">
                        {c.rejectionReason}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-accent-ink/50 text-[12px]">
                    {new Date(c.serviceDate).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    {reviewable.includes(c.status) ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleApprove(c.id, c.amountNgn)}
                          disabled={actionPending === c.id}
                          className="px-3 py-1 text-[12px] font-medium rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                        >
                          {actionPending === c.id ? "..." : "Approve"}
                        </button>
                        {rejectId === c.id ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              placeholder="Reason"
                              value={rejectReason}
                              onChange={(e) => setRejectReason(e.target.value)}
                              className="px-2 py-1 text-[12px] border rounded w-32"
                            />
                            <button
                              onClick={() => handleReject(c.id)}
                              disabled={actionPending === c.id}
                              className="px-3 py-1 text-[12px] font-medium rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                            >
                              Confirm
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setRejectId(c.id)}
                            className="px-3 py-1 text-[12px] font-medium rounded border border-red-200 text-red-600 hover:bg-red-50"
                          >
                            Reject
                          </button>
                        )}
                      </div>
                    ) : (
                      <span className="text-[12px] text-accent-ink/30">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {(cursorStack.length > 0 || nextCursor) && (
        <div className="flex items-center justify-between pt-1">
          <button
            onClick={goPrev}
            disabled={cursorStack.length === 0 || loading}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-black/[0.12] text-[13px] text-accent-ink/65 hover:border-black/30 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={14} /> Previous
          </button>
          <span className="text-[12px] text-accent-ink/45">Page {pageNum}</span>
          <button
            onClick={goNext}
            disabled={!nextCursor || loading}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-black/[0.12] text-[13px] text-accent-ink/65 hover:border-black/30 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Next <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
