import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Clock,
  CheckCircle2,
  AlertCircle,
  Activity,
  XCircle,
} from "lucide-react";
import { getPlanDetail } from "../../../actions";

export const dynamic = "force-dynamic";

/**
 * Staff plan detail. Renders the full translated Universal Plan
 * Schema so reviewers can verify the AI normalisation produced
 * accurate output — coverage table, age bands, exclusions, waiting
 * periods, and the recent freshness history.
 *
 * The data shown here is exactly what the consumer-side API
 * (`GET /v1/plans/:id`) returns to fintechs, less the wholesale
 * settlement details and internal ids.
 */

type CoverageItem = {
  covered?: boolean;
  limit?: number | null;
  per_visit_limit?: number | null;
  co_pay_percent?: number | null;
  waiting_period_days?: number | null;
  unlimited?: boolean;
  notes?: string | null;
};

const BENEFIT_ORDER: { key: string; label: string }[] = [
  { key: "outpatient", label: "Outpatient" },
  { key: "inpatient", label: "Inpatient" },
  { key: "maternity", label: "Maternity" },
  { key: "dental", label: "Dental" },
  { key: "optical", label: "Optical" },
  { key: "emergency", label: "Emergency" },
  { key: "telemedicine", label: "Telemedicine" },
  { key: "diagnostics", label: "Diagnostics" },
  { key: "pharmacy", label: "Pharmacy" },
  { key: "mental_health", label: "Mental health" },
  { key: "wellness", label: "Wellness" },
];

function formatKobo(kobo: number | null | undefined): string {
  if (kobo === null || kobo === undefined) return "—";
  return `₦${(kobo / 100).toLocaleString()}`;
}

export default async function PlanDetailPage({
  params,
}: {
  params: { slug: string; planId: string };
}) {
  const plan = await getPlanDetail(params.slug, params.planId);
  if (!plan) notFound();

  const pricing = plan.pricing as {
    individual_monthly?: number;
    age_bands?: { min_age: number; max_age: number; monthly: number }[];
    family_rate?: number | null;
    employer_discount_percent?: number | null;
  } | null;
  const coverage = (plan.coverage ?? {}) as Record<string, CoverageItem>;
  const waitingPeriods = plan.waitingPeriods as {
    general?: number | null;
    maternity?: number | null;
    pre_existing?: number | null;
  } | null;
  const exclusions = Array.isArray(plan.exclusions)
    ? (plan.exclusions as string[])
    : [];

  const stale = plan.staleAfter !== null && plan.staleAfter < new Date();

  return (
    <div>
      <Link
        href={`/portal/hmo-providers/${plan.provider.slug}`}
        className="inline-flex items-center gap-1.5 text-[13px] text-accent-ink/55 hover:text-accent-ink"
      >
        <ArrowLeft size={14} /> {plan.provider.displayName}
      </Link>

      <div className="mt-4 flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="font-display text-[28px] md:text-[36px] leading-[1.05] tracking-[-0.02em] text-accent-ink font-medium">
              {plan.name}
            </h1>
            <StatusChip status={plan.status} />
            <span className="text-[10px] uppercase tracking-[0.12em] text-accent-ink/55 font-mono">
              {plan.scope.replace(/_/g, " ").toLowerCase()}
            </span>
            {stale ? (
              <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.12em] font-medium px-2 py-0.5 rounded-full bg-[#fff4d4] text-[#7a4a00]">
                <Clock size={10} /> Stale
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-[13px] text-accent-ink/55">
            ext id <span className="font-mono">{plan.externalId}</span> ·
            billed {plan.billingFrequency.toLowerCase()}
          </p>
        </div>
      </div>

      <div className="mt-8 grid lg:grid-cols-[1fr_320px] gap-8">
        <div className="space-y-8">
          {/* ── Pricing ─────────────────────────────────────────── */}
          <section>
            <h2 className="text-[16px] font-medium text-accent-ink">Pricing</h2>
            <div className="mt-3 rounded-xl border border-black/[0.08] p-4">
              <div className="flex items-baseline gap-2">
                <span className="text-[12px] uppercase tracking-[0.1em] text-accent-ink/55">
                  Wholesale (individual)
                </span>
                <p className="font-mono text-[18px] text-accent-ink">
                  {formatKobo(pricing?.individual_monthly ?? null)}
                </p>
                <span className="text-[12px] text-accent-ink/55">
                  / {plan.billingFrequency.toLowerCase()}
                </span>
              </div>
              {pricing?.family_rate ? (
                <p className="mt-2 text-[13px] text-accent-ink/65">
                  Family rate: {formatKobo(pricing.family_rate)}
                </p>
              ) : null}
              {pricing?.employer_discount_percent ? (
                <p className="mt-1 text-[13px] text-accent-ink/65">
                  Employer discount: {pricing.employer_discount_percent}%
                </p>
              ) : null}
            </div>

            {pricing?.age_bands && pricing.age_bands.length > 0 ? (
              <div className="mt-3">
                <p className="text-[11px] uppercase tracking-[0.12em] text-accent-ink/55 font-medium mb-1.5">
                  Age bands
                </p>
                <div className="rounded-xl border border-black/[0.08] overflow-hidden">
                  <table className="w-full text-[12px]">
                    <thead className="bg-black/[0.03] text-accent-ink/55 uppercase tracking-[0.1em] text-[10px]">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium">
                          Age range
                        </th>
                        <th className="text-right px-3 py-2 font-medium">
                          Monthly
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/[0.06]">
                      {pricing.age_bands.map((band, i) => (
                        <tr key={i}>
                          <td className="px-3 py-2 text-accent-ink">
                            {band.min_age} – {band.max_age}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-accent-ink">
                            {formatKobo(band.monthly)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </section>

          {/* ── Coverage ────────────────────────────────────────── */}
          <section>
            <h2 className="text-[16px] font-medium text-accent-ink">Coverage</h2>
            <p className="mt-1 text-[12px] text-accent-ink/55">
              Benefit limits + co-pay % + per-benefit waiting periods.
              Translated from the HMO&apos;s native format via the active
              ConnectorMapping.
            </p>
            <div className="mt-3 rounded-xl border border-black/[0.08] overflow-hidden">
              <table className="w-full text-[12px]">
                <thead className="bg-black/[0.03] text-accent-ink/55 uppercase tracking-[0.1em] text-[10px]">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Benefit</th>
                    <th className="text-left px-3 py-2 font-medium">Covered</th>
                    <th className="text-right px-3 py-2 font-medium">Limit</th>
                    <th className="text-right px-3 py-2 font-medium">Co-pay</th>
                    <th className="text-right px-3 py-2 font-medium">
                      Waiting
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.06]">
                  {BENEFIT_ORDER.map(({ key, label }) => {
                    const item = coverage[key];
                    if (!item) return null;
                    return (
                      <tr key={key}>
                        <td className="px-3 py-2 text-accent-ink">{label}</td>
                        <td className="px-3 py-2">
                          {item.covered ? (
                            <span className="inline-flex items-center gap-1 text-accent-emerald text-[11px]">
                              <CheckCircle2 size={12} />
                              {item.unlimited ? "unlimited" : "covered"}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-accent-ink/45 text-[11px]">
                              <XCircle size={12} /> not covered
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-accent-ink">
                          {item.unlimited
                            ? "—"
                            : formatKobo(item.limit ?? null)}
                        </td>
                        <td className="px-3 py-2 text-right text-accent-ink">
                          {item.co_pay_percent !== undefined &&
                          item.co_pay_percent !== null
                            ? `${item.co_pay_percent}%`
                            : "—"}
                        </td>
                        <td className="px-3 py-2 text-right text-accent-ink/65">
                          {item.waiting_period_days
                            ? `${item.waiting_period_days}d`
                            : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* ── Waiting periods + exclusions ──────────────────── */}
          <section className="grid sm:grid-cols-2 gap-4">
            {waitingPeriods ? (
              <div className="rounded-xl border border-black/[0.08] p-4">
                <p className="text-[11px] uppercase tracking-[0.12em] text-accent-ink/55 font-medium">
                  Waiting periods
                </p>
                <dl className="mt-2 space-y-1.5 text-[13px]">
                  {waitingPeriods.general !== undefined &&
                  waitingPeriods.general !== null ? (
                    <Row label="General" value={`${waitingPeriods.general}d`} />
                  ) : null}
                  {waitingPeriods.maternity !== undefined &&
                  waitingPeriods.maternity !== null ? (
                    <Row
                      label="Maternity"
                      value={`${waitingPeriods.maternity}d`}
                    />
                  ) : null}
                  {waitingPeriods.pre_existing !== undefined &&
                  waitingPeriods.pre_existing !== null ? (
                    <Row
                      label="Pre-existing"
                      value={`${waitingPeriods.pre_existing}d`}
                    />
                  ) : null}
                </dl>
              </div>
            ) : null}

            {exclusions.length > 0 ? (
              <div className="rounded-xl border border-black/[0.08] p-4">
                <p className="text-[11px] uppercase tracking-[0.12em] text-accent-ink/55 font-medium">
                  Exclusions
                </p>
                <ul className="mt-2 space-y-1 text-[13px] text-accent-ink/75">
                  {exclusions.map((e, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="text-accent-ink/35 mt-0.5">•</span>
                      <span>{e}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>
        </div>

        {/* ── Sidebar ──────────────────────────────────────────── */}
        <aside className="space-y-4 text-[13px]">
          <div className="rounded-xl border border-black/[0.08] p-4">
            <p className="text-[11px] uppercase tracking-[0.12em] text-accent-ink/45 font-medium">
              Freshness
            </p>
            <dl className="mt-3 space-y-2.5">
              <Row
                label="Last synced"
                value={new Date(plan.lastSyncedAt).toLocaleString()}
              />
              <Row
                label="Last verified"
                value={
                  plan.lastVerifiedAt
                    ? new Date(plan.lastVerifiedAt).toLocaleString()
                    : "never"
                }
              />
              <Row
                label="Stale after"
                value={
                  plan.staleAfter
                    ? new Date(plan.staleAfter).toLocaleString()
                    : "—"
                }
              />
            </dl>
          </div>

          {plan.freshnessEvents.length > 0 ? (
            <div className="rounded-xl border border-black/[0.08] p-4">
              <p className="text-[11px] uppercase tracking-[0.12em] text-accent-ink/45 font-medium">
                Recent activity
              </p>
              <ul className="mt-3 space-y-2 text-[11px]">
                {plan.freshnessEvents.map((ev) => (
                  <li key={ev.id} className="flex items-start gap-2">
                    <Activity size={11} className="mt-0.5 text-accent-ink/35" />
                    <div className="flex-1 min-w-0">
                      <p className="text-accent-ink/75">
                        {ev.kind.replace(/_/g, " ").toLowerCase()}
                        {ev.changed ? (
                          <span className="ml-1 text-[#7a4a00]">
                            (changed)
                          </span>
                        ) : null}
                      </p>
                      <p className="text-accent-ink/45">
                        {new Date(ev.occurredAt).toLocaleString()}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="rounded-xl border border-black/[0.08] p-4">
            <p className="text-[11px] uppercase tracking-[0.12em] text-accent-ink/45 font-medium">
              Lifecycle
            </p>
            <dl className="mt-3 space-y-2.5">
              <Row
                label="Created"
                value={new Date(plan.createdAt).toLocaleDateString()}
              />
              <Row
                label="Updated"
                value={new Date(plan.updatedAt).toLocaleDateString()}
              />
              {plan.effectiveFrom ? (
                <Row
                  label="Effective from"
                  value={new Date(plan.effectiveFrom).toLocaleDateString()}
                />
              ) : null}
              {plan.effectiveTo ? (
                <Row
                  label="Effective to"
                  value={new Date(plan.effectiveTo).toLocaleDateString()}
                />
              ) : null}
            </dl>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 text-[12px]">
      <dt className="text-accent-ink/55">{label}</dt>
      <dd className="text-accent-ink text-right">{value}</dd>
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  if (status === "ACTIVE") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.12em] font-medium px-2 py-0.5 rounded-full bg-card-mint text-accent-emerald">
        <CheckCircle2 size={10} /> Active
      </span>
    );
  }
  if (status === "DRAFT") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.12em] font-medium px-2 py-0.5 rounded-full bg-[#eef2ff] text-[#3a3a8a]">
        <Clock size={10} /> Draft
      </span>
    );
  }
  if (status === "WITHDRAWN") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.12em] font-medium px-2 py-0.5 rounded-full bg-black/[0.06] text-accent-ink/55">
        Withdrawn
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.12em] font-medium px-2 py-0.5 rounded-full bg-[#fde6e6] text-[#a83232]">
      <AlertCircle size={10} /> {status}
    </span>
  );
}
