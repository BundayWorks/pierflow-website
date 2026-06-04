"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle, Save, AlertTriangle, Info } from "lucide-react";
import { approveRecord, rejectRecord, saveDraft } from "../actions";

/* ── Types ────────────────────────────────────────────────────── */

type Leaf = {
  value?: unknown;
  _confidence?: number;
  _raw?: string;
};

type ValidationIssue = {
  code: string;
  severity: string;
  message: string;
  path?: string;
};

type Props = {
  recordId: string;
  jobId: string;
  documentType: string;
  imageUrl: string | null;
  extractedJson: unknown;
  avgConfidence: number;
  completenessScore: number;
  confidenceList: string[];
  validationIssues: ValidationIssue[];
  initialNotes: string;
  batchLabel: string;
};

/* ── Helpers ──────────────────────────────────────────────────── */

function isLeaf(node: unknown): node is Leaf {
  return (
    typeof node === "object" &&
    node !== null &&
    !Array.isArray(node) &&
    "value" in node &&
    typeof (node as { value?: unknown }).value !== "object"
  );
}

function confidenceTone(c: number | undefined) {
  if (c == null) return "border-black/[0.08]";
  if (c >= 0.85) return "border-accent-emerald/40";
  if (c >= 0.6) return "border-[#d4a418]/40 bg-[#fffbeb]";
  return "border-[#a83232]/40 bg-[#fde6e6]";
}

function confidenceBadge(c: number | undefined) {
  if (c == null) return null;
  const tone =
    c >= 0.85
      ? "bg-card-mint text-accent-emerald"
      : c >= 0.6
        ? "bg-[#fff4d4] text-[#7a4a00]"
        : "bg-[#fde6e6] text-[#a83232]";
  return (
    <span
      className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${tone}`}
      title="Field confidence"
    >
      {Math.round(c * 100)}
    </span>
  );
}

/** Set a leaf at `path` inside an object tree, immutably. */
function setLeafAt(root: unknown, path: (string | number)[], newValue: unknown): unknown {
  if (path.length === 0) return newValue;
  const [head, ...rest] = path;
  if (typeof head === "number") {
    const arr = Array.isArray(root) ? [...root] : [];
    arr[head] = setLeafAt(arr[head], rest, newValue);
    return arr;
  }
  const obj = (root && typeof root === "object" ? { ...(root as Record<string, unknown>) } : {}) as Record<
    string,
    unknown
  >;
  obj[head] = setLeafAt(obj[head], rest, newValue);
  return obj;
}

/* ── Recursive renderer ───────────────────────────────────────── */

function FieldRenderer({
  node,
  path,
  fieldKey,
  onLeafChange,
}: {
  node: unknown;
  path: (string | number)[];
  fieldKey?: string;
  onLeafChange: (path: (string | number)[], newValue: unknown) => void;
}) {
  if (node == null) return null;

  // Leaf — render input
  if (isLeaf(node)) {
    const leaf = node as Leaf;
    const tone = confidenceTone(leaf._confidence);
    const value = leaf.value;
    const isNumber = typeof value === "number";
    return (
      <div className={`rounded-md border px-3 py-2 ${tone}`}>
        <div className="flex items-center justify-between gap-2 mb-1">
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-accent-ink/65">
            {fieldKey ?? "value"}
          </p>
          {confidenceBadge(leaf._confidence)}
        </div>
        <input
          type={isNumber ? "number" : "text"}
          step={isNumber ? "any" : undefined}
          value={value == null ? "" : String(value)}
          onChange={(e) => {
            const raw = e.target.value;
            const newValue: unknown = isNumber
              ? raw === ""
                ? null
                : Number(raw)
              : raw;
            onLeafChange([...path, "value"], newValue);
          }}
          className="w-full bg-transparent text-[14px] focus:outline-none"
        />
        {leaf._raw && (
          <p className="mt-1 text-[10px] text-accent-ink/45 truncate" title={leaf._raw}>
            raw: {leaf._raw}
          </p>
        )}
      </div>
    );
  }

  // Array
  if (Array.isArray(node)) {
    if (node.length === 0) {
      return (
        <p className="text-[12px] italic text-accent-ink/40 px-2">(empty)</p>
      );
    }
    return (
      <div className="space-y-3">
        {node.map((item, i) => (
          <div
            key={i}
            className="rounded-lg border border-black/[0.06] p-3 bg-bgl-alt/40"
          >
            <p className="text-[10px] uppercase tracking-[0.12em] text-accent-ink/55 mb-2">
              {fieldKey ?? "item"} #{i + 1}
            </p>
            <FieldRenderer
              node={item}
              path={[...path, i]}
              onLeafChange={onLeafChange}
            />
          </div>
        ))}
      </div>
    );
  }

  // Object (not a leaf)
  if (typeof node === "object") {
    const entries = Object.entries(node as Record<string, unknown>).filter(
      ([k]) => !k.startsWith("_"),
    );
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {entries.map(([k, v]) => {
          // If it's a section (nested object/array), give it a full row.
          const isSection =
            typeof v === "object" && v !== null && !isLeaf(v);
          return (
            <div key={k} className={isSection ? "md:col-span-2" : ""}>
              {isSection && (
                <p className="text-[11px] uppercase tracking-[0.14em] text-accent-emerald font-medium mb-1.5">
                  {k}
                </p>
              )}
              <FieldRenderer
                node={v}
                path={[...path, k]}
                fieldKey={k}
                onLeafChange={onLeafChange}
              />
            </div>
          );
        })}
      </div>
    );
  }

  // Primitive at the top level — unusual, render readonly
  return (
    <p className="text-[13px] text-accent-ink/70">{String(node)}</p>
  );
}

/* ── Main component ───────────────────────────────────────────── */

export default function ReviewClient({
  recordId,
  documentType,
  imageUrl,
  extractedJson,
  avgConfidence,
  completenessScore,
  confidenceList,
  validationIssues,
  initialNotes,
  batchLabel,
}: Props) {
  const router = useRouter();
  const [data, setData] = useState<unknown>(extractedJson);
  const [notes, setNotes] = useState(initialNotes);
  const [busy, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);

  const onLeafChange = useCallback(
    (path: (string | number)[], newValue: unknown) => {
      setData((prev: unknown) => setLeafAt(prev, path, newValue));
    },
    [],
  );

  const completenessTone = useMemo(() => {
    if (completenessScore >= 70) return "text-accent-emerald";
    if (completenessScore >= 50) return "text-[#7a4a00]";
    return "text-[#a83232]";
  }, [completenessScore]);

  const errors = validationIssues.filter((i) => i.severity === "ERROR");
  const warns = validationIssues.filter((i) => i.severity === "WARN");

  const handleApprove = () =>
    startTransition(async () => {
      setFeedback(null);
      try {
        await approveRecord({
          recordId,
          data,
          reviewerNotes: notes.trim() || undefined,
        });
        router.push("/portal/review");
        router.refresh();
      } catch (err) {
        setFeedback(err instanceof Error ? err.message : "Approve failed.");
      }
    });

  const handleSave = () =>
    startTransition(async () => {
      setFeedback(null);
      try {
        await saveDraft({
          recordId,
          data,
          reviewerNotes: notes.trim() || undefined,
        });
        setFeedback("Draft saved.");
      } catch (err) {
        setFeedback(err instanceof Error ? err.message : "Save failed.");
      }
    });

  const handleReject = () =>
    startTransition(async () => {
      setFeedback(null);
      if (!notes.trim()) {
        setFeedback("Please add a note explaining the rejection.");
        return;
      }
      try {
        await rejectRecord({ recordId, reviewerNotes: notes.trim() });
        router.push("/portal/review");
        router.refresh();
      } catch (err) {
        setFeedback(err instanceof Error ? err.message : "Reject failed.");
      }
    });

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3 mb-6">
        <div>
          <p className="text-[12px] uppercase tracking-[0.16em] text-accent-emerald">
            {documentType.replace(/_/g, " ").toLowerCase()}
          </p>
          <h1 className="mt-1 font-display text-[24px] md:text-[28px] leading-[1.1] tracking-[-0.01em] text-accent-ink font-medium">
            {batchLabel}
          </h1>
        </div>
        <div className="flex items-center gap-3 text-[12px]">
          <span className="text-accent-ink/55">
            confidence{" "}
            <span className="font-mono text-accent-ink">
              {Math.round((avgConfidence ?? 0) * 100)}
            </span>
          </span>
          <span className="text-accent-ink/55">
            completeness{" "}
            <span className={`font-mono ${completenessTone}`}>
              {completenessScore}/100
            </span>
          </span>
        </div>
      </div>

      {/* Issues summary */}
      {(errors.length > 0 || warns.length > 0) && (
        <div className="rounded-xl border border-black/[0.08] p-4 mb-6 space-y-2">
          {errors.map((e, i) => (
            <div key={`e-${i}`} className="flex gap-2 text-[13px] text-[#a83232]">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              <span>
                <strong>{e.code}</strong>: {e.message}
                {e.path ? ` (${e.path})` : ""}
              </span>
            </div>
          ))}
          {warns.map((w, i) => (
            <div
              key={`w-${i}`}
              className="flex gap-2 text-[13px] text-[#7a4a00]"
            >
              <Info size={14} className="shrink-0 mt-0.5" />
              <span>
                <strong>{w.code}</strong>: {w.message}
                {w.path ? ` (${w.path})` : ""}
              </span>
            </div>
          ))}
          {confidenceList.length > 0 && (
            <p className="text-[12px] text-accent-ink/60 pt-1 border-t border-black/[0.06]">
              Low-confidence fields:{" "}
              <span className="font-mono">{confidenceList.join(", ")}</span>
            </p>
          )}
        </div>
      )}

      {/* Two-pane: image + form */}
      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-6">
        <div className="lg:sticky lg:top-[80px] self-start">
          <div className="rounded-2xl border border-black/[0.08] overflow-hidden bg-bgl-alt">
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageUrl}
                alt="captured page"
                className="w-full h-auto block"
              />
            ) : (
              <div className="aspect-[3/4] grid place-items-center text-accent-ink/40 text-[13px]">
                no source image
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="rounded-2xl border border-black/[0.08] p-5">
            <FieldRenderer
              node={data}
              path={[]}
              onLeafChange={onLeafChange}
            />
          </div>

          <div className="mt-5">
            <label className="block text-[12px] font-medium text-accent-ink/65 mb-1.5">
              Reviewer notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Anything the partner system should know about this record."
              className="w-full rounded-lg border border-black/[0.1] px-3 py-2 text-[14px] focus:outline-none focus:border-accent-emerald"
            />
          </div>
        </div>
      </div>

      {/* Action bar */}
      <div className="sticky bottom-0 mt-8 -mx-4 lg:-mx-6 px-4 lg:px-6 py-4 bg-white border-t border-black/[0.08]">
        <div className="max-w-[1400px] mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="text-[12px] text-accent-ink/55 min-h-[16px]">
            {feedback}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReject}
              disabled={busy}
              className="inline-flex items-center gap-2 text-[13px] font-medium px-4 py-2 rounded-full border border-[#a83232]/30 text-[#a83232] hover:bg-[#fde6e6] disabled:opacity-50"
            >
              <XCircle size={14} />
              Reject
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={busy}
              className="inline-flex items-center gap-2 text-[13px] font-medium px-4 py-2 rounded-full border border-black/[0.15] text-accent-ink hover:bg-bgl-alt disabled:opacity-50"
            >
              <Save size={14} />
              Save draft
            </button>
            <button
              type="button"
              onClick={handleApprove}
              disabled={busy}
              className="inline-flex items-center gap-2 text-[13px] font-medium px-4 py-2 rounded-full bg-accent-ink text-white hover:opacity-95 disabled:opacity-50"
            >
              <CheckCircle2 size={14} />
              Approve
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
