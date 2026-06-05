"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  PlayCircle,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Download,
} from "lucide-react";
import {
  runSmokeTest,
  getSmokeTestJob,
  type SmokeTestResult,
} from "./smokeTest";

const POSTMAN_HREF = "/api/pierflow.postman_collection.json";
const POLL_INTERVAL_MS = 2_500;
const POLL_TIMEOUT_MS = 60_000;

type PollState =
  | { kind: "idle" }
  | { kind: "running"; result: Extract<SmokeTestResult, { ok: true }> }
  | {
      kind: "done";
      result: Extract<SmokeTestResult, { ok: true }>;
      job: Awaited<ReturnType<typeof getSmokeTestJob>>;
    }
  | { kind: "timeout"; result: Extract<SmokeTestResult, { ok: true }> };

export default function TryTheApi() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<
    Extract<SmokeTestResult, { ok: true }>["steps"]
  >([]);
  const [poll, setPoll] = useState<PollState>({ kind: "idle" });
  const pollerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef<number | null>(null);

  // Make sure we tear down any running poller if the component unmounts
  // mid-run (e.g. partner navigates away).
  useEffect(() => {
    return () => {
      if (pollerRef.current) clearInterval(pollerRef.current);
    };
  }, []);

  function startPolling(
    runResult: Extract<SmokeTestResult, { ok: true }>,
  ) {
    if (pollerRef.current) clearInterval(pollerRef.current);
    startedAtRef.current = Date.now();
    setPoll({ kind: "running", result: runResult });

    pollerRef.current = setInterval(async () => {
      try {
        const job = await getSmokeTestJob(runResult.jobId);
        const elapsed = Date.now() - (startedAtRef.current ?? Date.now());
        const terminal =
          job.status === "VALIDATED" ||
          job.status === "AWAITING_REVIEW" ||
          job.status === "IMPORTED" ||
          job.status === "FAILED";

        if (terminal) {
          if (pollerRef.current) clearInterval(pollerRef.current);
          setPoll({ kind: "done", result: runResult, job });
          // Refresh the parent server component so the checklist's
          // "first API call" item re-evaluates and ticks green if the
          // job actually used the API key (it didn't — the smoke test
          // bypasses bearer auth — but we still want the partner to
          // see the FHIR / patient appear in the dashboard).
          router.refresh();
        } else if (elapsed > POLL_TIMEOUT_MS) {
          if (pollerRef.current) clearInterval(pollerRef.current);
          setPoll({ kind: "timeout", result: runResult });
        }
      } catch (err) {
        if (pollerRef.current) clearInterval(pollerRef.current);
        setError(
          err instanceof Error
            ? err.message
            : "Couldn't poll the job. The job is still running on the server.",
        );
      }
    }, POLL_INTERVAL_MS);
  }

  function run() {
    setError(null);
    setProgress([]);
    setPoll({ kind: "idle" });
    startTransition(async () => {
      try {
        const result = await runSmokeTest();
        setProgress(result.steps);
        if (!result.ok) {
          setError(result.message);
          return;
        }
        startPolling(result);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Couldn't start the test. Try again, or email pierflowllc@gmail.com.",
        );
      }
    });
  }

  const isRunning = pending || poll.kind === "running";

  return (
    <div className="mt-4 space-y-4">
      <div className="rounded-lg border border-black/[0.08] bg-white p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <PlayCircle
            size={18}
            className="text-accent-emerald mt-0.5 shrink-0"
          />
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-accent-ink">
              Run a one-click smoke test
            </p>
            <p className="mt-1 text-[12px] text-accent-ink/65 leading-[1.6]">
              We&apos;ll create a batch, upload a mock outpatient card, queue
              extraction, and report each step. Same code path your own
              requests will hit — minus the bearer-token unwrap, since we
              already know who you are inside the portal.
            </p>
          </div>
          <button
            type="button"
            onClick={run}
            disabled={isRunning}
            className="text-[12px] font-medium px-4 py-2 rounded-md bg-accent-emerald text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1.5 shrink-0"
          >
            {isRunning ? (
              <>
                <Loader2 size={12} className="animate-spin" />
                Running…
              </>
            ) : (
              "Run"
            )}
          </button>
        </div>

        {progress.length > 0 ? (
          <ol className="mt-4 space-y-1.5">
            {progress.map((s) => (
              <li
                key={s.step}
                className="flex items-start gap-2 text-[12px] text-accent-ink/75"
              >
                <CheckCircle2
                  size={12}
                  className="text-accent-emerald mt-[3px] shrink-0"
                />
                <div className="min-w-0">
                  <span className="font-medium text-accent-ink">
                    {s.label}
                  </span>
                  <span className="text-accent-ink/55">
                    {" "}
                    · <code className="text-[11px] font-mono">{s.detail}</code>
                  </span>
                </div>
              </li>
            ))}
          </ol>
        ) : null}

        {poll.kind === "running" ? (
          <p className="mt-4 text-[12px] text-accent-ink/65 inline-flex items-center gap-2">
            <Loader2 size={12} className="animate-spin text-accent-emerald" />
            Polling job status — extraction usually finishes within 10
            seconds.
          </p>
        ) : null}

        {poll.kind === "done" ? (
          <SmokeResultPanel
            job={poll.job}
            organizationId={poll.result.organizationId}
            organizationName={poll.result.organizationName}
          />
        ) : null}

        {poll.kind === "timeout" ? (
          <p className="mt-4 text-[12px] text-[#7a4a00] inline-flex items-start gap-1.5">
            <AlertCircle size={12} className="mt-0.5 shrink-0" />
            The job is still processing after a minute. That can happen on a
            cold function — refresh the page in a moment to see the final
            state.
          </p>
        ) : null}

        {error ? (
          <p className="mt-4 text-[12px] text-[#7a2222] inline-flex items-start gap-1.5">
            <AlertCircle size={12} className="mt-0.5 shrink-0" />
            {error}
          </p>
        ) : null}
      </div>

      <div className="rounded-lg border border-black/[0.08] bg-white p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <Download size={18} className="text-accent-emerald mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-accent-ink">
              Postman collection
            </p>
            <p className="mt-1 text-[12px] text-accent-ink/65 leading-[1.6]">
              Same end-to-end flow as a Postman collection. Import it,
              paste your API key into the collection variables, and the
              request scripts auto-populate every subsequent variable.
              Useful for offline integration work.
            </p>
          </div>
          <a
            href={POSTMAN_HREF}
            download="pierflow.postman_collection.json"
            className="text-[12px] font-medium px-4 py-2 rounded-md border border-black/[0.12] text-accent-ink hover:border-black/30 shrink-0 inline-flex items-center gap-1.5"
          >
            <Download size={12} />
            Download
          </a>
        </div>
      </div>
    </div>
  );
}

function SmokeResultPanel({
  job,
  organizationId,
  organizationName,
}: {
  job: Awaited<ReturnType<typeof getSmokeTestJob>>;
  organizationId: string;
  organizationName: string;
}) {
  const ok = job.status === "VALIDATED" || job.status === "AWAITING_REVIEW";
  return (
    <div
      className={`mt-4 rounded-md border p-3 ${
        ok
          ? "border-accent-emerald/30 bg-card-mint"
          : "border-[#a83232]/30 bg-[#fde6e6]"
      }`}
    >
      <p
        className={`text-[12px] font-medium inline-flex items-center gap-1.5 ${
          ok ? "text-accent-emerald" : "text-[#7a2222]"
        }`}
      >
        {ok ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
        Job {job.status}
      </p>
      {job.record ? (
        <ul className="mt-2 text-[11.5px] text-accent-ink/75 space-y-0.5">
          <li>
            Document type:{" "}
            <code className="font-mono text-[11px]">
              {job.record.documentType}
            </code>
          </li>
          <li>
            Validation:{" "}
            <code className="font-mono text-[11px]">
              {job.record.validationStatus}
            </code>
          </li>
          {job.record.avgConfidence != null ? (
            <li>
              Avg confidence:{" "}
              <code className="font-mono text-[11px]">
                {job.record.avgConfidence.toFixed(2)}
              </code>
            </li>
          ) : null}
          {job.record.completenessScore != null ? (
            <li>
              Completeness:{" "}
              <code className="font-mono text-[11px]">
                {job.record.completenessScore.toFixed(0)} / 100
              </code>
            </li>
          ) : null}
          {job.record.patientId ? (
            <li className="pt-1">
              View the patient FHIR Bundle at{" "}
              <code className="font-mono text-[11px]">
                /v1/organizations/{organizationId}/patients/
                {job.record.patientId}/fhir
              </code>
            </li>
          ) : null}
        </ul>
      ) : job.errorCode ? (
        <p className="mt-2 text-[12px] text-[#7a2222]">
          {job.errorCode}: {job.errorDetail}
        </p>
      ) : (
        <p className="mt-2 text-[11.5px] text-accent-ink/65">
          The job finished without producing a record — usually means the
          source asset failed to load. Re-run in a moment.
        </p>
      )}
      <p className="mt-2 text-[11px] text-accent-ink/55">
        Organization: {organizationName} ·{" "}
        <code className="font-mono">{organizationId}</code>
      </p>
    </div>
  );
}
