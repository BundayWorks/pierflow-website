import Link from "next/link";
import { listReviewQueue } from "./actions";
import { AlertTriangle, ArrowRight, FileText } from "lucide-react";

export const dynamic = "force-dynamic";

const DOC_LABELS: Record<string, string> = {
  AUTO: "Auto-classified",
  OUTPATIENT_CARD: "Outpatient card",
  REGISTRATION: "Patient registration",
  LAB_RESULT: "Lab result",
  PRESCRIPTION: "Prescription",
  ANTENATAL: "Antenatal",
  IMMUNISATION: "Immunisation",
  DISCHARGE_SUMMARY: "Discharge summary",
  XRAY_REPORT: "X-ray report",
  ULTRASOUND_REPORT: "Ultrasound report",
  OPERATION_NOTE: "Operation note",
  REFERRAL_LETTER: "Referral letter",
  OTHER: "Other",
};

export default async function ReviewQueuePage() {
  const queue = await listReviewQueue();

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.16em] text-accent-emerald">
        Review
      </p>
      <h1 className="mt-2 font-display text-[32px] md:text-[40px] leading-[1.05] tracking-[-0.02em] text-accent-ink font-medium">
        Review queue
      </h1>
      <p className="mt-3 text-[15px] leading-[1.7] text-accent-ink/65 max-w-[640px]">
        Records the platform extracted but couldn&apos;t auto-approve. Open
        each one to check the original page, correct anything wrong, and
        approve it into the next Import Package.
      </p>

      {queue.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-black/[0.12] p-10 text-center">
          <p className="text-[14px] text-accent-ink/55">
            Nothing awaiting review right now. Captured records that pass
            confidence checks land straight in Validated.
          </p>
          <Link
            href="/portal/capture"
            className="mt-5 inline-flex items-center gap-2 text-[13px] font-medium px-4 py-2 rounded-full bg-accent-ink text-white"
          >
            Capture records
          </Link>
        </div>
      ) : (
        <ul className="mt-8 space-y-3">
          {queue.map((j) => {
            const record = j.extractedRecords[0];
            const tone =
              j.priority === "URGENT"
                ? "bg-[#fff4d4] text-[#7a4a00]"
                : "bg-bgl-alt text-accent-ink/65";
            const completeness = record?.completenessScore ?? null;
            const completenessTone =
              completeness == null
                ? "bg-bgl-alt text-accent-ink/55"
                : completeness >= 70
                  ? "bg-card-mint text-accent-emerald"
                  : completeness >= 50
                    ? "bg-[#fff4d4] text-[#7a4a00]"
                    : "bg-[#fde6e6] text-[#a83232]";

            return (
              <li key={j.id}>
                <Link
                  href={`/portal/review/${j.id}`}
                  className="block rounded-xl border border-black/[0.08] p-4 hover:border-black/25 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <span className="w-9 h-9 rounded-xl bg-accent-teal-light text-accent-emerald grid place-items-center shrink-0">
                      <FileText size={16} />
                    </span>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-[14px] font-medium text-accent-ink truncate">
                          {DOC_LABELS[j.recordTypeHint] ?? j.recordTypeHint}
                        </p>
                        <span
                          className={`text-[10px] uppercase tracking-[0.12em] font-medium px-2 py-0.5 rounded-full ${tone}`}
                        >
                          {j.priority}
                        </span>
                        {completeness != null && (
                          <span
                            className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${completenessTone}`}
                            title="Completeness score"
                          >
                            {completeness}/100
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-[12px] text-accent-ink/55">
                        {j.batch.label ?? "Untitled batch"} ·{" "}
                        {new Date(j.createdAt).toLocaleString()}
                      </p>
                    </div>

                    {completeness != null && completeness < 50 && (
                      <AlertTriangle
                        size={16}
                        className="text-[#a83232] shrink-0"
                      />
                    )}
                    <ArrowRight
                      size={16}
                      className="text-accent-ink/30 shrink-0"
                    />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
