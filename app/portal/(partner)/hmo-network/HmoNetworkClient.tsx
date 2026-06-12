"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Circle, ShieldCheck, AlertCircle, Loader2 } from "lucide-react";
import { optInAction, optOutAction } from "./actions";
import type { HmoRateCard } from "@/lib/insurance/hmo-access";

function StatusBadge({ status }: { status: HmoRateCard["access_status"] }) {
  if (status === "ACTIVE") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-medium">
        <CheckCircle2 size={11} />
        Enabled
      </span>
    );
  }
  if (status === "PENDING_ACCEPTANCE") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[11px] font-medium">
        <Circle size={11} />
        Pending
      </span>
    );
  }
  if (status === "SUSPENDED") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 text-red-700 text-[11px] font-medium">
        <AlertCircle size={11} />
        Suspended
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/5 text-accent-ink/55 text-[11px]">
      Not enabled
    </span>
  );
}

function HmoCard({
  hmo,
  onOptIn,
  onOptOut,
}: {
  hmo: HmoRateCard;
  onOptIn: () => void;
  onOptOut: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const isActive = hmo.access_status === "ACTIVE";
  const isSuspended = hmo.access_status === "SUSPENDED";

  function handleToggle() {
    startTransition(async () => {
      if (isActive) {
        await optOutAction(hmo.provider_slug);
        onOptOut();
      } else {
        await optInAction(hmo.provider_slug);
        onOptIn();
      }
    });
  }

  return (
    <div
      className={`rounded-xl border p-5 transition-colors ${
        isActive
          ? "border-emerald-200 bg-emerald-50/30"
          : "border-black/[0.08] bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck
              size={15}
              className={isActive ? "text-emerald-600" : "text-accent-ink/30"}
            />
            <span className="text-[14px] font-semibold text-accent-ink truncate">
              {hmo.provider_name}
            </span>
            <StatusBadge status={hmo.access_status} />
          </div>

          <p className="text-[12px] text-accent-ink/55 mb-3">
            {hmo.plan_count} active plan{hmo.plan_count !== 1 ? "s" : ""}
          </p>

          {hmo.lines && hmo.lines.length > 0 ? (
            <div className="rounded-lg bg-black/[0.03] px-3 py-2.5">
              <p className="text-[11px] text-accent-ink/55 mb-1 uppercase tracking-[0.04em] font-medium">
                Your earnings
              </p>
              {hmo.summary ? (
                <p className="text-[13px] font-medium text-accent-ink">
                  {hmo.summary}
                </p>
              ) : null}
              <div className="mt-1.5 space-y-0.5">
                {hmo.lines.map((line, i) => {
                  const rate =
                    line.kind === "PERCENTAGE"
                      ? `${((line.amount_bps ?? 0) / 100).toFixed(1).replace(".0", "")}%`
                      : `₦${(Number(line.amount_flat_ngn ?? "0") / 100).toLocaleString()} flat`;
                  const timing =
                    line.timing === "ENROLLMENT_ONLY"
                      ? "enrollment fee only"
                      : line.timing === "RECURRING_ONLY"
                        ? "per billing cycle"
                        : "enrollment + recurring";
                  return (
                    <p key={i} className="text-[11px] text-accent-ink/55">
                      {rate} — {timing}
                    </p>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="rounded-lg bg-black/[0.03] px-3 py-2.5">
              <p className="text-[12px] text-accent-ink/45">
                No active contract yet — rate card coming soon.
              </p>
            </div>
          )}
        </div>

        <div className="shrink-0">
          {isSuspended ? (
            <span className="text-[12px] text-red-600">
              Contact support
            </span>
          ) : hmo.lines && hmo.lines.length > 0 ? (
            <button
              onClick={handleToggle}
              disabled={pending}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${
                isActive
                  ? "bg-white border border-black/[0.08] text-accent-ink/75 hover:bg-red-50 hover:text-red-700 hover:border-red-200"
                  : "bg-accent-emerald text-white hover:bg-accent-emerald/90"
              } disabled:opacity-50`}
            >
              {pending ? (
                <Loader2 size={12} className="animate-spin" />
              ) : isActive ? (
                "Disable"
              ) : (
                "Enable"
              )}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function HmoNetworkClient({
  initialHmos,
}: {
  initialHmos: HmoRateCard[];
}) {
  const router = useRouter();
  const hmos = initialHmos;

  const enabled = hmos.filter((h) => h.access_status === "ACTIVE").length;

  function refresh() {
    // The opt-in/out server action already called revalidatePath; a
    // router refresh re-runs the page's server component so the cards
    // reflect the new status without a full page reload.
    router.refresh();
  }

  if (hmos.length === 0) {
    return (
      <div className="py-16 text-center">
        <ShieldCheck size={32} className="mx-auto text-accent-ink/20 mb-3" />
        <p className="text-[14px] text-accent-ink/55">
          No HMO integrations are live yet. Check back soon.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <p className="text-[13px] text-accent-ink/55">
          {enabled} of {hmos.length} HMO{hmos.length !== 1 ? "s" : ""} enabled
        </p>
        {enabled === 0 && (
          <p className="text-[12px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
            Enable at least one HMO to see plans in GET /v1/plans
          </p>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {hmos.map((hmo) => (
          <HmoCard
            key={hmo.provider_slug}
            hmo={hmo}
            onOptIn={refresh}
            onOptOut={refresh}
          />
        ))}
      </div>
    </div>
  );
}
