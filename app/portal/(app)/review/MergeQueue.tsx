"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  GitMerge,
  CheckCircle2,
  AlertCircle,
  Split,
  User,
  Clock,
} from "lucide-react";
import { acceptMerge, keepSeparate } from "./actions";

type Identifier = { system: string; value: string };

type PatientSide = {
  id: string;
  fullName: string;
  dateOfBirth: string | null;
  sex: "M" | "F" | "U";
  createdAt: string;
  identifiers: Identifier[];
  recordCount: number;
};

type Candidate = {
  id: string;
  score: number;
  reasons: unknown;
  detectedAt: string;
  primary: PatientSide;
  candidate: PatientSide;
};

export default function MergeQueue({ candidates }: { candidates: Candidate[] }) {
  if (candidates.length === 0) {
    return (
      <div className="mt-8 rounded-2xl border border-dashed border-black/[0.12] p-10 text-center">
        <GitMerge size={20} className="mx-auto text-accent-ink/35" />
        <p className="mt-3 text-[14px] text-accent-ink/55">
          No merge candidates pending for this org.
        </p>
        <p className="mt-1 text-[12px] text-accent-ink/45">
          The reconciler runs nightly and flags likely duplicates here.
        </p>
      </div>
    );
  }
  return (
    <ul className="mt-8 space-y-4">
      {candidates.map((c) => (
        <li key={c.id}>
          <MergeCard candidate={c} />
        </li>
      ))}
    </ul>
  );
}

function MergeCard({ candidate }: { candidate: Candidate }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

  function doMerge() {
    setError(null);
    startTransition(async () => {
      try {
        await acceptMerge({
          candidateRowId: candidate.id,
          reviewerNotes: notes.trim() || undefined,
        });
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to merge.");
      }
    });
  }
  function doKeep() {
    setError(null);
    startTransition(async () => {
      try {
        await keepSeparate({
          candidateRowId: candidate.id,
          reviewerNotes: notes.trim() || undefined,
        });
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update.");
      }
    });
  }

  const scorePct = Math.round(candidate.score * 100);
  const reasons = formatReasons(candidate.reasons);

  return (
    <div className="rounded-2xl border border-black/[0.08] bg-white p-5">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.12em] font-medium px-2 py-0.5 rounded-full bg-card-mint text-accent-emerald">
          <GitMerge size={10} />
          Score {scorePct}%
        </span>
        {reasons.map((r) => (
          <span
            key={r}
            className="text-[10px] uppercase tracking-[0.12em] font-medium px-2 py-0.5 rounded-full bg-bgl-alt text-accent-ink/65"
          >
            {r}
          </span>
        ))}
        <span className="text-[10px] text-accent-ink/45 inline-flex items-center gap-1 ml-auto">
          <Clock size={10} />
          flagged {new Date(candidate.detectedAt).toLocaleDateString()}
        </span>
      </div>

      <div className="mt-4 grid md:grid-cols-2 gap-4">
        <PatientCard side="Primary (older)" patient={candidate.primary} />
        <PatientCard side="Candidate (likely duplicate)" patient={candidate.candidate} />
      </div>

      <div className="mt-4">
        <textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional note — why you decided this way."
          className="w-full text-[13px] rounded-md border border-black/[0.1] bg-white p-3 focus:outline-none focus:border-accent-emerald/60"
        />
      </div>

      {error ? (
        <div className="mt-3 rounded-md border border-[#a83232]/30 bg-[#fde6e6] px-3 py-2 text-[12px] text-[#7a2222] inline-flex items-start gap-2">
          <AlertCircle size={13} className="mt-0.5 shrink-0" />
          {error}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          onClick={doMerge}
          disabled={pending}
          className="text-[12px] font-medium px-4 py-2 rounded-md bg-accent-emerald text-white hover:opacity-90 disabled:opacity-40 inline-flex items-center gap-2"
        >
          <CheckCircle2 size={13} />
          {pending ? "Working…" : "Merge into primary"}
        </button>
        <button
          onClick={doKeep}
          disabled={pending}
          className="text-[12px] font-medium px-4 py-2 rounded-md border border-black/[0.12] text-accent-ink hover:border-black/30 disabled:opacity-40 inline-flex items-center gap-2"
        >
          <Split size={13} />
          Keep separate
        </button>
        <p className="text-[11px] text-accent-ink/55 ml-auto">
          Merging re-parents every extracted record from candidate to
          primary. This action is recorded but not undoable from the UI.
        </p>
      </div>
    </div>
  );
}

function PatientCard({
  side,
  patient,
}: {
  side: string;
  patient: PatientSide;
}) {
  return (
    <div className="rounded-xl border border-black/[0.08] p-4">
      <p className="text-[10px] uppercase tracking-[0.12em] text-accent-ink/55 font-medium mb-2">
        {side}
      </p>
      <div className="flex items-center gap-2">
        <span className="w-8 h-8 rounded-md bg-accent-teal-light text-accent-emerald grid place-items-center shrink-0">
          <User size={14} />
        </span>
        <p className="text-[14px] font-medium text-accent-ink truncate">
          {patient.fullName}
        </p>
      </div>
      <ul className="mt-3 space-y-1 text-[12px] text-accent-ink/75">
        <li>
          <span className="text-accent-ink/45">DOB:</span>{" "}
          {patient.dateOfBirth
            ? new Date(patient.dateOfBirth).toLocaleDateString()
            : "—"}
        </li>
        <li>
          <span className="text-accent-ink/45">Sex:</span> {patient.sex}
        </li>
        <li>
          <span className="text-accent-ink/45">Records:</span>{" "}
          {patient.recordCount}
        </li>
        <li>
          <span className="text-accent-ink/45">First seen:</span>{" "}
          {new Date(patient.createdAt).toLocaleDateString()}
        </li>
      </ul>
      {patient.identifiers.length > 0 ? (
        <ul className="mt-3 space-y-0.5">
          {patient.identifiers.map((i, idx) => (
            <li
              key={idx}
              className="text-[11px] font-mono text-accent-ink/65 truncate"
            >
              <span className="text-accent-ink/40">{shortSystem(i.system)}:</span>{" "}
              {i.value}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function formatReasons(raw: unknown): string[] {
  if (!raw || typeof raw !== "object") return [];
  const data = raw as Record<string, unknown>;
  const out: string[] = [];
  if (data.type === "MRN_MATCH") out.push("MRN match");
  if (data.type === "NAME_DOB") {
    out.push("Name match");
    if (data.dob_match === true) out.push("DOB match");
    if (data.sex_match === true) out.push("Sex match");
  }
  return out;
}

function shortSystem(system: string): string {
  try {
    const u = new URL(system);
    return (u.host + u.pathname).replace(/\/$/, "");
  } catch {
    return system;
  }
}
