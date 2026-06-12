"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, AlertCircle, Check } from "lucide-react";
import { publishSamplePlanAction } from "../actions";

/**
 * Staff-only "Publish a sample plan" affordance. Calls the same
 * ingest path the EMR-vendor connector uses (native format → active
 * ConnectorMapping → HmoPlan row), so a successful click confirms
 * both that the mapping wizard step worked AND that the catalogue
 * ingest path is wired correctly.
 *
 * Re-runnable: the insert is keyed on (providerId, externalId), so
 * a second click updates the same row in place rather than creating
 * duplicates.
 */
export default function PublishSampleButton({
  providerId,
  slug,
  variant = "primary",
}: {
  providerId: string;
  slug: string;
  variant?: "primary" | "secondary";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<"CREATED" | "UPDATED" | null>(null);

  function run() {
    setError(null);
    setDone(null);
    startTransition(async () => {
      const result = await publishSamplePlanAction({ providerId, slug });
      if (!result.ok) {
        const lead =
          result.reason === "INGEST_FAILED"
            ? "Couldn't publish — usually means there's no active mapping yet."
            : "Validation failed.";
        setError(`${lead} ${result.issues?.join("; ") ?? ""}`.trim());
        return;
      }
      setDone(result.action);
      router.refresh();
    });
  }

  const baseBtn =
    variant === "primary"
      ? "px-4 py-2 rounded-full bg-accent-emerald text-white text-[13px] font-medium hover:opacity-90 disabled:opacity-50"
      : "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-black/[0.12] text-[12px] text-accent-ink/75 hover:text-accent-ink hover:border-accent-ink/40 disabled:opacity-50";

  return (
    <div className={variant === "primary" ? "space-y-2" : ""}>
      <button
        type="button"
        onClick={run}
        disabled={pending}
        className={`${baseBtn} inline-flex items-center gap-1.5`}
        title="Inserts one synthetic Silver Plan via the active mapping. Safe to re-run."
      >
        <Sparkles size={variant === "primary" ? 14 : 12} />
        {pending
          ? "Publishing…"
          : done
            ? done === "CREATED"
              ? "Sample plan created"
              : "Sample plan updated"
            : "Publish a sample plan"}
      </button>
      {done ? (
        <p className="text-[11px] text-accent-emerald inline-flex items-center gap-1.5">
          <Check size={11} /> Refresh the page to see the new plan in the
          list below.
        </p>
      ) : null}
      {error ? (
        <p className="text-[11px] text-[#a83232] inline-flex items-start gap-1.5">
          <AlertCircle size={11} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}
