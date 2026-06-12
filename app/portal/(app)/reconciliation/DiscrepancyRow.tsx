"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp } from "lucide-react";
import {
  updateDiscrepancyStatusAction,
  reReconcileEnrollmentAction,
} from "./actions";

type BreakdownRow = {
  account_id: string;
  display_name: string;
  role: string;
  settlement_tag: string | null;
  instructed: string;
  executed: string;
  delta: string;
};

export default function DiscrepancyRow({
  discrepancyId,
  enrollmentId,
  status,
  breakdown,
  notes: initialNotes,
}: {
  discrepancyId: string;
  enrollmentId: string | null;
  status: string;
  breakdown: unknown[];
  notes: string;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState(initialNotes);
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<string[]>([]);

  function setStatus(next: "ACKNOWLEDGED" | "RESOLVED" | "WRITTEN_OFF") {
    setErrors([]);
    startTransition(async () => {
      const r = await updateDiscrepancyStatusAction({
        discrepancyId,
        status: next,
        notes: notes || null,
      });
      if (!r.ok) {
        setErrors(r.issues);
        return;
      }
      router.refresh();
    });
  }

  function rerun() {
    if (!enrollmentId) return;
    startTransition(async () => {
      await reReconcileEnrollmentAction(enrollmentId);
      router.refresh();
    });
  }

  const rows = breakdown as BreakdownRow[];
  const formatNaira = (s: string) => {
    const kobo = BigInt(s);
    const abs = kobo < BigInt(0) ? -kobo : kobo;
    const sign = kobo < BigInt(0) ? "−" : "";
    return `${sign}₦${(Number(abs) / 100).toLocaleString()}`;
  };

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="inline-flex items-center gap-1.5 text-[11px] text-accent-ink/55 hover:text-accent-ink"
      >
        {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        Per-account breakdown ({rows.length})
      </button>

      {expanded ? (
        <div className="mt-3 space-y-3">
          <div className="rounded-lg border border-black/[0.06] overflow-hidden">
            <table className="w-full text-[12px]">
              <thead className="bg-black/[0.03] text-accent-ink/55 uppercase tracking-[0.1em] text-[10px]">
                <tr>
                  <th className="text-left px-3 py-1.5 font-medium">Account</th>
                  <th className="text-right px-3 py-1.5 font-medium">
                    Instructed
                  </th>
                  <th className="text-right px-3 py-1.5 font-medium">
                    Executed
                  </th>
                  <th className="text-right px-3 py-1.5 font-medium">Delta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.06]">
                {rows.map((r) => (
                  <tr key={r.account_id}>
                    <td className="px-3 py-1.5 text-accent-ink">
                      {r.display_name}
                      <span className="ml-1.5 text-[10px] text-accent-ink/45 uppercase tracking-[0.1em]">
                        {r.role.toLowerCase()}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono text-accent-ink/75">
                      {formatNaira(r.instructed)}
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono text-accent-ink/75">
                      {formatNaira(r.executed)}
                    </td>
                    <td
                      className={`px-3 py-1.5 text-right font-mono ${
                        BigInt(r.delta) !== BigInt(0)
                          ? "text-[#a83232]"
                          : "text-accent-ink/55"
                      }`}
                    >
                      {formatNaira(r.delta)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {status === "OPEN" || status === "ACKNOWLEDGED" ? (
            <>
              <label className="block text-[12px]">
                <span className="text-accent-ink/55">Reviewer notes</span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="What's the situation? e.g. fintech credited late, will sweep tomorrow."
                  className="mt-1 w-full rounded-md border border-black/[0.12] px-2 py-1 text-[12px] focus:outline-none focus:border-accent-emerald focus:ring-2 focus:ring-accent-teal-light"
                />
              </label>

              {errors.length > 0 ? (
                <p className="text-[11px] text-[#a83232]">
                  {errors.join(" ")}
                </p>
              ) : null}

              <div className="flex items-center gap-2 flex-wrap">
                {status === "OPEN" ? (
                  <button
                    type="button"
                    onClick={() => setStatus("ACKNOWLEDGED")}
                    disabled={pending}
                    className="px-3 py-1 rounded-full border border-black/[0.12] text-[11px] text-accent-ink/75 hover:text-accent-ink disabled:opacity-50"
                  >
                    Acknowledge
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setStatus("RESOLVED")}
                  disabled={pending}
                  className="px-3 py-1 rounded-full bg-accent-ink text-white text-[11px] font-medium disabled:opacity-50"
                >
                  Mark resolved
                </button>
                <button
                  type="button"
                  onClick={() => setStatus("WRITTEN_OFF")}
                  disabled={pending}
                  className="px-3 py-1 rounded-full border border-[#fde6e6] text-[#a83232] text-[11px] hover:bg-[#fdf3f3] disabled:opacity-50"
                >
                  Write off
                </button>
                {enrollmentId ? (
                  <button
                    type="button"
                    onClick={rerun}
                    disabled={pending}
                    className="ml-auto px-3 py-1 rounded-full border border-black/[0.12] text-[11px] text-accent-ink/55 hover:text-accent-ink disabled:opacity-50"
                  >
                    Re-reconcile
                  </button>
                ) : null}
              </div>
            </>
          ) : initialNotes ? (
            <p className="text-[12px] text-accent-ink/65 italic">
              &ldquo;{initialNotes}&rdquo;
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
