"use client";

import { useState, useTransition, useCallback } from "react";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import type { MemberRow, PlanOption } from "../actions";

const STATUSES = [
  "ALL",
  "ACTIVE",
  "CREATED",
  "PENDING_PAYMENT",
  "PENDING_HMO",
  "FAILED",
  "LAPSED",
  "CANCELLED",
] as const;

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    ACTIVE: "bg-emerald-50 text-emerald-700",
    CREATED: "bg-blue-50 text-blue-700",
    PENDING_PAYMENT: "bg-amber-50 text-amber-700",
    PENDING_HMO: "bg-amber-50 text-amber-700",
    FAILED: "bg-red-50 text-red-700",
    LAPSED: "bg-red-50 text-red-700",
    CANCELLED: "bg-gray-50 text-gray-600",
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

export default function MembersClient({
  initialItems,
  initialNextCursor,
  initialTotalCount,
  plans,
  fetchMembers,
}: {
  initialItems: MemberRow[];
  initialNextCursor: string | null;
  initialTotalCount: number;
  plans: PlanOption[];
  fetchMembers: (opts: {
    search?: string;
    status?: string;
    planId?: string;
    cursor?: string;
  }) => Promise<{ items: MemberRow[]; nextCursor: string | null; totalCount: number }>;
}) {
  const [items, setItems] = useState(initialItems);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [totalCount, setTotalCount] = useState(initialTotalCount);
  const [cursorStack, setCursorStack] = useState<string[]>([]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [planFilter, setPlanFilter] = useState("");
  const [pending, startTransition] = useTransition();

  const load = useCallback(
    (opts: { search?: string; status?: string; planId?: string; cursor?: string }) => {
      startTransition(async () => {
        const res = await fetchMembers(opts);
        setItems(res.items);
        setNextCursor(res.nextCursor);
        setTotalCount(res.totalCount);
      });
    },
    [fetchMembers],
  );

  function applyFilters(overrides?: { search?: string; status?: string; planId?: string }) {
    const s = overrides?.search ?? search;
    const st = overrides?.status ?? statusFilter;
    const p = overrides?.planId ?? planFilter;
    setCursorStack([]);
    load({
      search: s || undefined,
      status: st !== "ALL" ? st : undefined,
      planId: p || undefined,
    });
  }

  function goNext() {
    if (!nextCursor) return;
    const prevFirst = items[0]?.id;
    if (prevFirst) setCursorStack((s) => [...s, prevFirst]);
    load({
      search: search || undefined,
      status: statusFilter !== "ALL" ? statusFilter : undefined,
      planId: planFilter || undefined,
      cursor: nextCursor,
    });
  }

  function goPrev() {
    const stack = [...cursorStack];
    stack.pop();
    setCursorStack(stack);
    const cursor = stack.length > 0 ? stack[stack.length - 1] : undefined;
    load({
      search: search || undefined,
      status: statusFilter !== "ALL" ? statusFilter : undefined,
      planId: planFilter || undefined,
      cursor,
    });
  }

  const pageNum = cursorStack.length + 1;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[22px] font-semibold text-accent-ink">Members</h1>
        <p className="text-[14px] text-accent-ink/55 mt-1">
          Enrolled members across all plans
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
            placeholder="Search name, member ID, ref…"
            className="w-full pl-9 pr-3 py-2 border border-black/10 rounded-md text-[13px] focus:outline-none focus:ring-2 focus:ring-accent-emerald/30"
          />
        </div>

        <select
          value={planFilter}
          onChange={(e) => {
            setPlanFilter(e.target.value);
            applyFilters({ planId: e.target.value });
          }}
          className="px-3 py-2 border border-black/10 rounded-md text-[13px] text-accent-ink/75 focus:outline-none focus:ring-2 focus:ring-accent-emerald/30"
        >
          <option value="">All plans</option>
          {plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
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
        {totalCount} member{totalCount !== 1 ? "s" : ""} found
        {pending ? " — loading…" : ""}
      </p>

      {/* Table */}
      {items.length === 0 ? (
        <div className="mt-8 text-center text-[14px] text-accent-ink/55">
          {totalCount === 0 && !search && statusFilter === "ALL" && !planFilter
            ? "No members yet."
            : "No members match your filters."}
        </div>
      ) : (
        <div className="rounded-xl border border-black/[0.08] overflow-hidden">
          <table className="w-full text-[13px]">
            <thead className="bg-black/[0.03] text-accent-ink/55 uppercase tracking-[0.1em] text-[10px]">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">Name</th>
                <th className="text-left px-4 py-2.5 font-medium">Plan</th>
                <th className="text-left px-4 py-2.5 font-medium">Status</th>
                <th className="text-left px-4 py-2.5 font-medium">Member ID</th>
                <th className="text-left px-4 py-2.5 font-medium">Effective</th>
                <th className="text-left px-4 py-2.5 font-medium">Enrolled</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.06]">
              {items.map((m) => (
                <tr key={m.id} className="hover:bg-black/[0.02]">
                  <td className="px-4 py-3">
                    <span className="font-medium text-accent-ink">
                      {m.fullName}
                    </span>
                    <p className="text-[11px] text-accent-ink/45 font-mono mt-0.5">
                      {m.fintechUserRef}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-accent-ink/75">{m.planName}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={m.status} />
                  </td>
                  <td className="px-4 py-3 text-accent-ink/50 font-mono text-[12px]">
                    {m.hmoMemberId ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-accent-ink/50 text-[12px]">
                    {m.effectiveFrom
                      ? new Date(m.effectiveFrom).toLocaleDateString()
                      : "—"}
                    {m.effectiveTo
                      ? ` → ${new Date(m.effectiveTo).toLocaleDateString()}`
                      : ""}
                  </td>
                  <td className="px-4 py-3 text-accent-ink/50 text-[12px]">
                    {new Date(m.createdAt).toLocaleDateString()}
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
            disabled={cursorStack.length === 0 || pending}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-black/[0.12] text-[13px] text-accent-ink/65 hover:border-black/30 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={14} /> Previous
          </button>
          <span className="text-[12px] text-accent-ink/45">Page {pageNum}</span>
          <button
            onClick={goNext}
            disabled={!nextCursor || pending}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-black/[0.12] text-[13px] text-accent-ink/65 hover:border-black/30 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Next <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
