"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { withdrawPlanAction, activatePlanAction } from "../actions";

export default function PlanStatusActions({
  planId,
  status,
}: {
  planId: string;
  status: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleWithdraw() {
    if (!confirm) {
      setConfirm(true);
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await withdrawPlanAction(planId);
      if (!res.ok) setError(res.reason);
      else {
        setConfirm(false);
        router.refresh();
      }
    });
  }

  function handleActivate() {
    setError(null);
    startTransition(async () => {
      const res = await activatePlanAction(planId);
      if (!res.ok) setError(res.reason);
      else router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2">
      {status !== "WITHDRAWN" && status !== "ACTIVE" ? (
        <button
          onClick={handleActivate}
          disabled={pending}
          className="px-3 py-1.5 rounded-md bg-accent-emerald text-white text-[13px] font-medium hover:bg-accent-emerald/90 disabled:opacity-50"
        >
          {pending ? "…" : "Activate"}
        </button>
      ) : null}

      {status === "WITHDRAWN" ? (
        <button
          onClick={handleActivate}
          disabled={pending}
          className="px-3 py-1.5 rounded-md bg-accent-emerald text-white text-[13px] font-medium hover:bg-accent-emerald/90 disabled:opacity-50"
        >
          {pending ? "…" : "Re-activate"}
        </button>
      ) : null}

      {status !== "WITHDRAWN" ? (
        <button
          onClick={handleWithdraw}
          disabled={pending}
          className={`px-3 py-1.5 rounded-md border text-[13px] disabled:opacity-50 ${
            confirm
              ? "border-[#a83232]/40 bg-[#fde6e6] text-[#a83232] font-medium"
              : "border-black/[0.12] text-accent-ink/65 hover:border-black/30"
          }`}
        >
          {pending ? "…" : confirm ? "Confirm withdraw" : "Withdraw"}
        </button>
      ) : null}

      {confirm && !pending ? (
        <button
          onClick={() => setConfirm(false)}
          className="text-[12px] text-accent-ink/55 hover:text-accent-ink"
        >
          Cancel
        </button>
      ) : null}

      {error ? (
        <span className="text-[12px] text-[#a83232]">{error}</span>
      ) : null}
    </div>
  );
}
