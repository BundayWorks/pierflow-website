"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import {
  proposeMappingAction,
  activateMappingAction,
  getMappingDetail,
} from "./actions";

type MappingRow = {
  id: string;
  version: number;
  status: "DRAFT" | "ACTIVE" | "SUPERSEDED" | "ARCHIVED";
  averageConfidence: number | null;
  lowConfidenceFields: number;
  createdAt: string;
  activatedAt: string | null;
};

type FieldNode =
  | {
      jsonPath: string;
      confidence: number;
      justification: string;
      transform?: string;
    }
  | {
      each: {
        jsonPath: string;
        fields: Record<string, {
          jsonPath: string;
          confidence: number;
          justification: string;
          transform?: string;
        }>;
      };
    };

type ProposalShape = {
  proposedPlan: Record<string, unknown>;
  fields: Record<string, FieldNode>;
  notes?: string;
};

const LOW = 0.7;

export default function MappingWizardClient({
  slug,
  mappings,
}: {
  providerId: string;
  slug: string;
  mappings: MappingRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [sampleJson, setSampleJson] = useState(EXAMPLE_SAMPLE);
  const [proposeError, setProposeError] = useState<string | null>(null);
  const [openMappingId, setOpenMappingId] = useState<string | null>(null);
  const [openDetail, setOpenDetail] = useState<{
    sample: unknown;
    proposal: ProposalShape;
    template: unknown;
    status: MappingRow["status"];
    version: number;
  } | null>(null);

  function runPropose() {
    setProposeError(null);
    startTransition(async () => {
      const r = await proposeMappingAction({ slug, sampleJson });
      if (!r.ok) {
        setProposeError(
          r.reason === "INVALID_JSON"
            ? `That's not valid JSON: ${r.detail ?? ""}`
            : r.reason === "MODEL_ERROR"
              ? `Model error: ${r.detail ?? "unknown"}`
              : r.issues?.join("\n") ?? r.reason,
        );
        return;
      }
      router.refresh();
      // Auto-open the new draft
      await openMapping(r.mappingId);
    });
  }

  async function openMapping(id: string) {
    const detail = await getMappingDetail(id);
    if (!detail) return;
    setOpenMappingId(id);
    setOpenDetail({
      sample: detail.sample,
      proposal: detail.proposal as unknown as ProposalShape,
      template: detail.template,
      status: detail.status as MappingRow["status"],
      version: detail.version,
    });
  }

  function activate(id: string) {
    startTransition(async () => {
      await activateMappingAction(id, slug);
      router.refresh();
      await openMapping(id);
    });
  }

  return (
    <div className="mt-8 space-y-10">
      {/* ── Step 1: paste sample ─────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-accent-emerald font-medium">
          <Sparkles size={12} /> Step 1 — Paste a native plan
        </div>
        <p className="mt-2 text-[13px] text-accent-ink/65 max-w-[640px]">
          One plan, as JSON. Haiku reads it once and proposes a translation.
          You don&apos;t need to map the whole catalogue — one well-chosen
          example is enough for the whole HMO.
        </p>
        <textarea
          value={sampleJson}
          onChange={(e) => setSampleJson(e.target.value)}
          rows={14}
          className="mt-3 w-full rounded-xl border border-black/[0.12] px-3 py-2.5 text-[13px] font-mono text-accent-ink focus:outline-none focus:border-accent-emerald focus:ring-2 focus:ring-accent-teal-light"
          placeholder='{ "plan_id": "...", "name": "...", "monthly_premium_naira": 8500, ... }'
        />
        {proposeError ? (
          <div className="mt-3 rounded-lg border border-[#fde6e6] bg-[#fdf3f3] p-3 text-[12px] text-[#7a2727] whitespace-pre-wrap">
            {proposeError}
          </div>
        ) : null}
        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            disabled={pending || sampleJson.trim().length < 2}
            onClick={runPropose}
            className="px-5 py-2.5 rounded-full bg-accent-ink text-white text-[13px] font-medium disabled:opacity-50"
          >
            {pending ? "Asking Haiku…" : "Propose mapping"}
          </button>
          <p className="text-[12px] text-accent-ink/45">
            Uses{" "}
            <span className="font-mono">claude-haiku-4-5</span> — typically
            ~3 seconds, ~$0.002 per proposal.
          </p>
        </div>
      </section>

      {/* ── Step 2: existing proposals ───────────────────────────── */}
      <section>
        <div className="flex items-baseline justify-between">
          <h2 className="text-[16px] font-medium text-accent-ink">
            Proposals & versions{" "}
            <span className="text-accent-ink/45">({mappings.length})</span>
          </h2>
        </div>
        {mappings.length === 0 ? (
          <p className="mt-3 text-[13px] text-accent-ink/55">
            No mappings yet. Run Step 1 to create the first proposal.
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {mappings.map((m) => (
              <li
                key={m.id}
                className={`rounded-xl border p-4 transition ${
                  openMappingId === m.id
                    ? "border-accent-emerald"
                    : "border-black/[0.08] hover:border-black/25"
                }`}
              >
                <button
                  type="button"
                  onClick={() => openMapping(m.id)}
                  className="w-full text-left"
                >
                  <div className="flex items-center gap-3 flex-wrap">
                    <p className="text-[13px] font-medium text-accent-ink">
                      v{m.version}
                    </p>
                    <StatusChip status={m.status} />
                    {m.averageConfidence !== null ? (
                      <ConfidenceBadge value={m.averageConfidence} />
                    ) : null}
                    {m.lowConfidenceFields > 0 ? (
                      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.12em] font-medium px-2 py-0.5 rounded-full bg-[#fff4d4] text-[#7a4a00]">
                        {m.lowConfidenceFields} need review
                      </span>
                    ) : null}
                    <span className="ml-auto text-[11px] text-accent-ink/45">
                      {new Date(m.createdAt).toLocaleString()}
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Step 3: detail / review ─────────────────────────────── */}
      {openDetail ? (
        <section className="space-y-4">
          <div className="flex items-baseline gap-3">
            <h2 className="text-[16px] font-medium text-accent-ink">
              Review v{openDetail.version}
            </h2>
            <StatusChip status={openDetail.status} />
          </div>

          {openDetail.proposal.notes ? (
            <div className="rounded-xl border border-black/[0.08] bg-[#fafafa] p-4 text-[13px] leading-[1.6] text-accent-ink/75 whitespace-pre-wrap">
              <p className="text-[11px] uppercase tracking-[0.12em] font-medium text-accent-ink/45 mb-1">
                Notes from Haiku
              </p>
              {openDetail.proposal.notes}
            </div>
          ) : null}

          <div className="grid lg:grid-cols-2 gap-4">
            <div className="rounded-xl border border-black/[0.08] p-4">
              <p className="text-[11px] uppercase tracking-[0.12em] text-accent-ink/45 font-medium">
                Native sample
              </p>
              <pre className="mt-2 text-[11px] font-mono text-accent-ink/75 whitespace-pre-wrap break-all max-h-[420px] overflow-y-auto">
                {JSON.stringify(openDetail.sample, null, 2)}
              </pre>
            </div>
            <div className="rounded-xl border border-black/[0.08] p-4">
              <p className="text-[11px] uppercase tracking-[0.12em] text-accent-ink/45 font-medium">
                Proposed plan (Universal Plan Schema)
              </p>
              <pre className="mt-2 text-[11px] font-mono text-accent-ink/75 whitespace-pre-wrap break-all max-h-[420px] overflow-y-auto">
                {JSON.stringify(openDetail.proposal.proposedPlan, null, 2)}
              </pre>
            </div>
          </div>

          {/* Per-field mapping rationale */}
          <div className="rounded-xl border border-black/[0.08] p-4">
            <p className="text-[11px] uppercase tracking-[0.12em] text-accent-ink/45 font-medium">
              Per-field mapping
            </p>
            <ul className="mt-3 divide-y divide-black/[0.06]">
              {Object.entries(openDetail.proposal.fields).map(([path, node]) =>
                "each" in node ? (
                  <FieldArrayRow key={path} path={path} node={node} />
                ) : (
                  <FieldRow key={path} path={path} node={node} />
                ),
              )}
            </ul>
          </div>

          {openDetail.status === "DRAFT" ? (
            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={pending}
                onClick={() => activate(openMappingId!)}
                className="px-5 py-2.5 rounded-full bg-accent-ink text-white text-[13px] font-medium disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                <ArrowRight size={14} />
                {pending ? "Activating…" : "Activate this mapping"}
              </button>
              <p className="text-[12px] text-accent-ink/55 max-w-[480px]">
                Activating supersedes any other ACTIVE mapping for this
                provider. The catalogue API immediately starts using this
                template for native pushes.
              </p>
            </div>
          ) : openDetail.status === "ACTIVE" ? (
            <div className="rounded-lg border border-card-mint bg-[#f3fbf7] p-3 text-[13px] text-accent-emerald inline-flex items-center gap-2">
              <CheckCircle2 size={14} /> This is the active mapping. Native
              catalogue pushes use this template.
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function FieldRow({
  path,
  node,
}: {
  path: string;
  node: Extract<FieldNode, { jsonPath: string }>;
}) {
  const low = node.confidence < LOW;
  return (
    <li className="py-2.5 grid grid-cols-[1fr_1fr_auto] gap-3 items-start">
      <div>
        <p className="text-[12px] font-mono text-accent-ink">{path}</p>
        <p className="text-[11px] text-accent-ink/55 mt-0.5">
          {node.justification}
        </p>
      </div>
      <div>
        <p className="text-[12px] font-mono text-accent-ink/75">
          ← {node.jsonPath}
        </p>
        {node.transform ? (
          <p className="text-[10px] uppercase tracking-[0.12em] text-accent-ink/55 mt-0.5">
            {node.transform.replace(/_/g, " ")}
          </p>
        ) : null}
      </div>
      <ConfidencePill value={node.confidence} low={low} />
    </li>
  );
}

function FieldArrayRow({
  path,
  node,
}: {
  path: string;
  node: Extract<FieldNode, { each: unknown }>;
}) {
  return (
    <li className="py-2.5">
      <div className="grid grid-cols-[1fr_1fr] gap-3">
        <div>
          <p className="text-[12px] font-mono text-accent-ink">{path}</p>
          <p className="text-[11px] text-accent-ink/55 mt-0.5">
            (array of objects)
          </p>
        </div>
        <p className="text-[12px] font-mono text-accent-ink/75">
          ← {node.each.jsonPath} (each)
        </p>
      </div>
      <ul className="mt-2 ml-4 divide-y divide-black/[0.04]">
        {Object.entries(node.each.fields).map(([sub, subNode]) => (
          <FieldRow key={sub} path={sub} node={subNode} />
        ))}
      </ul>
    </li>
  );
}

function StatusChip({ status }: { status: string }) {
  if (status === "DRAFT") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.12em] font-medium px-2 py-0.5 rounded-full bg-[#eef2ff] text-[#3a3a8a]">
        <Clock size={10} /> Draft
      </span>
    );
  }
  if (status === "ACTIVE") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.12em] font-medium px-2 py-0.5 rounded-full bg-card-mint text-accent-emerald">
        <CheckCircle2 size={10} /> Active
      </span>
    );
  }
  if (status === "SUPERSEDED") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.12em] font-medium px-2 py-0.5 rounded-full bg-black/[0.06] text-accent-ink/55">
        Superseded
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.12em] font-medium px-2 py-0.5 rounded-full bg-[#fde6e6] text-[#a83232]">
      <AlertCircle size={10} /> {status}
    </span>
  );
}

function ConfidenceBadge({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const tone =
    value >= 0.85
      ? "bg-card-mint text-accent-emerald"
      : value >= 0.7
        ? "bg-[#eef2ff] text-[#3a3a8a]"
        : "bg-[#fff4d4] text-[#7a4a00]";
  return (
    <span className={`text-[10px] uppercase tracking-[0.12em] font-medium px-2 py-0.5 rounded-full ${tone}`}>
      avg {pct}%
    </span>
  );
}

function ConfidencePill({ value, low }: { value: number; low: boolean }) {
  const pct = Math.round(value * 100);
  return (
    <span
      className={`shrink-0 text-[11px] font-mono px-2 py-0.5 rounded-full ${
        low
          ? "bg-[#fff4d4] text-[#7a4a00]"
          : "bg-card-mint text-accent-emerald"
      }`}
    >
      {pct}%
    </span>
  );
}

const EXAMPLE_SAMPLE = `{
  "plan_id": "REL-SILVER-IND",
  "name": "Silver Plan",
  "scope": "individual",
  "billing": "monthly",
  "monthly_premium_naira": 8500,
  "age_bands": [
    { "min_age": 0, "max_age": 17, "monthly_naira": 6000 },
    { "min_age": 18, "max_age": 35, "monthly_naira": 8500 },
    { "min_age": 36, "max_age": 50, "monthly_naira": 11000 },
    { "min_age": 51, "max_age": 65, "monthly_naira": 16000 }
  ],
  "annual_limit_naira": 1500000,
  "coverage": {
    "outpatient":   { "covered": true,  "annual_limit_naira": 200000, "co_pay_percent": 0  },
    "inpatient":    { "covered": true,  "annual_limit_naira": 1000000, "co_pay_percent": 10 },
    "maternity":    { "covered": true,  "annual_limit_naira": 300000, "waiting_period_days": 270 },
    "dental":       { "covered": false },
    "optical":      { "covered": true,  "annual_limit_naira": 30000 },
    "emergency":    { "covered": true,  "annual_limit_naira": 500000 },
    "telemedicine": { "covered": true,  "unlimited": true }
  },
  "exclusions": ["HIV/AIDS treatment", "Cosmetic surgery", "Pre-existing conditions"],
  "waiting_periods": { "general_days": 30, "maternity_days": 270, "pre_existing_days": 365 }
}`;
