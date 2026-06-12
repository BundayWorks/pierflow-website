"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { createPlanAction, updatePlanAction } from "../actions";

const SCOPES = ["INDIVIDUAL", "FAMILY", "EMPLOYEE_GROUP", "STUDENT", "OTHER"] as const;
const BILLING = ["MONTHLY", "QUARTERLY", "ANNUAL"] as const;
const STATUSES = ["DRAFT", "ACTIVE"] as const;

const BENEFITS = [
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
] as const;

type AgeBand = { min_age: number; max_age: number; monthly_naira: number };
type BenefitItem = {
  enabled: boolean;
  covered: boolean;
  limit_naira: string;
  co_pay_percent: string;
  waiting_period_days: string;
};

function nairaToKobo(naira: string | number): number {
  const n = typeof naira === "string" ? parseFloat(naira) : naira;
  return Math.round(n * 100);
}

function koboToNaira(kobo: number | null | undefined): string {
  if (kobo === null || kobo === undefined) return "";
  return (kobo / 100).toString();
}

type InitialData = {
  id: string;
  externalId: string;
  name: string;
  scope: string;
  status: string;
  billingFrequency: string;
  coverage: Record<string, {
    covered?: boolean;
    limit?: number | null;
    co_pay_percent?: number | null;
    waiting_period_days?: number | null;
  }>;
  pricing: {
    individual_monthly?: number;
    age_bands?: { min_age: number; max_age: number; monthly: number }[];
    family_rate?: number | null;
    employer_discount_percent?: number | null;
  };
  waitingPeriods: { general?: number | null; maternity?: number | null; pre_existing?: number | null } | null;
  exclusions: string[];
};

function initBenefits(coverage?: Record<string, unknown>): Record<string, BenefitItem> {
  const result: Record<string, BenefitItem> = {};
  for (const b of BENEFITS) {
    const existing = (coverage ?? {})[b.key] as {
      covered?: boolean;
      limit?: number | null;
      co_pay_percent?: number | null;
      waiting_period_days?: number | null;
    } | undefined;
    result[b.key] = {
      enabled: !!existing,
      covered: existing?.covered ?? true,
      limit_naira: koboToNaira(existing?.limit),
      co_pay_percent: existing?.co_pay_percent?.toString() ?? "",
      waiting_period_days: existing?.waiting_period_days?.toString() ?? "",
    };
  }
  return result;
}

export default function PlanFormClient({
  mode,
  initial,
}: {
  mode: "create" | "edit";
  initial?: InitialData;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<string[]>([]);

  // Basic info
  const [name, setName] = useState(initial?.name ?? "");
  const [externalId, setExternalId] = useState(initial?.externalId ?? "");
  const [scope, setScope] = useState(initial?.scope ?? "INDIVIDUAL");
  const [status, setStatus] = useState(initial?.status ?? "ACTIVE");
  const [billing, setBilling] = useState(initial?.billingFrequency ?? "MONTHLY");

  // Pricing
  const [monthlyNaira, setMonthlyNaira] = useState(
    koboToNaira(initial?.pricing?.individual_monthly),
  );
  const [familyRateNaira, setFamilyRateNaira] = useState(
    koboToNaira(initial?.pricing?.family_rate),
  );
  const [employerDiscount, setEmployerDiscount] = useState(
    initial?.pricing?.employer_discount_percent?.toString() ?? "",
  );
  const [ageBands, setAgeBands] = useState<AgeBand[]>(
    initial?.pricing?.age_bands?.map((b) => ({
      min_age: b.min_age,
      max_age: b.max_age,
      monthly_naira: b.monthly / 100,
    })) ?? [],
  );

  // Coverage
  const [benefits, setBenefits] = useState<Record<string, BenefitItem>>(
    initBenefits(initial?.coverage as Record<string, unknown>),
  );
  const [expandedBenefits, setExpandedBenefits] = useState<Set<string>>(new Set());

  // Waiting periods
  const [wpGeneral, setWpGeneral] = useState(initial?.waitingPeriods?.general?.toString() ?? "");
  const [wpMaternity, setWpMaternity] = useState(initial?.waitingPeriods?.maternity?.toString() ?? "");
  const [wpPreExisting, setWpPreExisting] = useState(initial?.waitingPeriods?.pre_existing?.toString() ?? "");

  // Exclusions
  const [exclusions, setExclusions] = useState<string[]>(initial?.exclusions ?? []);
  const [newExclusion, setNewExclusion] = useState("");

  function toggleBenefitExpand(key: string) {
    setExpandedBenefits((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function updateBenefit(key: string, field: keyof BenefitItem, value: string | boolean) {
    setBenefits((prev) => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }));
  }

  function addAgeBand() {
    const last = ageBands[ageBands.length - 1];
    setAgeBands([
      ...ageBands,
      { min_age: last ? last.max_age + 1 : 0, max_age: last ? last.max_age + 17 : 17, monthly_naira: 0 },
    ]);
  }

  function removeAgeBand(index: number) {
    setAgeBands(ageBands.filter((_, i) => i !== index));
  }

  function updateAgeBand(index: number, field: keyof AgeBand, value: number) {
    setAgeBands(ageBands.map((b, i) => (i === index ? { ...b, [field]: value } : b)));
  }

  function addExclusion() {
    if (newExclusion.trim()) {
      setExclusions([...exclusions, newExclusion.trim()]);
      setNewExclusion("");
    }
  }

  function buildPayload(): Record<string, unknown> {
    // Build coverage
    const coverageObj: Record<string, unknown> = {};
    for (const b of BENEFITS) {
      const item = benefits[b.key];
      if (!item.enabled) continue;
      coverageObj[b.key] = {
        covered: item.covered,
        ...(item.limit_naira ? { limit: nairaToKobo(item.limit_naira) } : {}),
        ...(item.co_pay_percent ? { co_pay_percent: parseFloat(item.co_pay_percent) } : {}),
        ...(item.waiting_period_days ? { waiting_period_days: parseInt(item.waiting_period_days) } : {}),
      };
    }

    // Build pricing
    const pricingObj: Record<string, unknown> = {
      individual_monthly: nairaToKobo(monthlyNaira || "0"),
    };
    if (ageBands.length > 0) {
      pricingObj.age_bands = ageBands.map((b) => ({
        min_age: b.min_age,
        max_age: b.max_age,
        monthly: nairaToKobo(b.monthly_naira),
      }));
    }
    if (familyRateNaira) pricingObj.family_rate = nairaToKobo(familyRateNaira);
    if (employerDiscount) pricingObj.employer_discount_percent = parseFloat(employerDiscount);

    // Build waiting periods
    const wp: Record<string, unknown> = {};
    if (wpGeneral) wp.general = parseInt(wpGeneral);
    if (wpMaternity) wp.maternity = parseInt(wpMaternity);
    if (wpPreExisting) wp.pre_existing = parseInt(wpPreExisting);

    // Auto-generate external_id for new plans
    const extId =
      externalId.trim() ||
      `portal-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 30)}-${scope.toLowerCase()}`;

    return {
      external_id: extId,
      name: name.trim(),
      scope,
      status,
      billing_frequency: billing,
      coverage: coverageObj,
      pricing: pricingObj,
      ...(Object.keys(wp).length > 0 ? { waiting_periods: wp } : {}),
      ...(exclusions.length > 0 ? { exclusions } : {}),
    };
  }

  function handleSubmit() {
    setError(null);
    setIssues([]);

    if (!name.trim()) {
      setError("Plan name is required.");
      return;
    }
    if (!monthlyNaira || parseFloat(monthlyNaira) <= 0) {
      setError("Individual monthly premium is required.");
      return;
    }

    const payload = buildPayload();
    startTransition(async () => {
      const res =
        mode === "edit" && initial
          ? await updatePlanAction(initial.id, payload)
          : await createPlanAction(payload);

      if (!res.ok) {
        setError(res.reason);
        setIssues(res.issues ?? []);
      } else {
        router.push(`/portal/cover/plans/${res.planId}`);
        router.refresh();
      }
    });
  }

  return (
    <div className="max-w-3xl space-y-8">
      {/* Basic info */}
      <section>
        <h2 className="text-[16px] font-medium text-accent-ink">Basic information</h2>
        <div className="mt-3 space-y-3">
          <Field label="Plan name" required>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Silver Plan"
              className="input-field"
            />
          </Field>
          <Field label="External ID" hint="Auto-generated if blank. Used for API sync.">
            <input
              type="text"
              value={externalId}
              onChange={(e) => setExternalId(e.target.value)}
              placeholder="auto-generated"
              className="input-field font-mono text-[12px]"
              disabled={mode === "edit"}
            />
          </Field>
          <div className="grid sm:grid-cols-3 gap-3">
            <Field label="Scope">
              <select value={scope} onChange={(e) => setScope(e.target.value)} className="input-field">
                {SCOPES.map((s) => (
                  <option key={s} value={s}>{s.replace(/_/g, " ").toLowerCase()}</option>
                ))}
              </select>
            </Field>
            <Field label="Billing frequency">
              <select value={billing} onChange={(e) => setBilling(e.target.value)} className="input-field">
                {BILLING.map((b) => (
                  <option key={b} value={b}>{b.toLowerCase()}</option>
                ))}
              </select>
            </Field>
            <Field label="Status">
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="input-field">
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{s.toLowerCase()}</option>
                ))}
              </select>
            </Field>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section>
        <h2 className="text-[16px] font-medium text-accent-ink">Pricing</h2>
        <p className="text-[12px] text-accent-ink/55 mt-1">
          All amounts in Nigerian Naira (₦). Stored as kobo internally.
        </p>
        <div className="mt-3 space-y-3">
          <div className="grid sm:grid-cols-3 gap-3">
            <Field label="Individual monthly (₦)" required>
              <input
                type="number"
                value={monthlyNaira}
                onChange={(e) => setMonthlyNaira(e.target.value)}
                placeholder="8500"
                min="0"
                step="0.01"
                className="input-field"
              />
            </Field>
            <Field label="Family rate (₦)">
              <input
                type="number"
                value={familyRateNaira}
                onChange={(e) => setFamilyRateNaira(e.target.value)}
                placeholder="optional"
                min="0"
                step="0.01"
                className="input-field"
              />
            </Field>
            <Field label="Employer discount (%)">
              <input
                type="number"
                value={employerDiscount}
                onChange={(e) => setEmployerDiscount(e.target.value)}
                placeholder="optional"
                min="0"
                max="100"
                className="input-field"
              />
            </Field>
          </div>

          {/* Age bands */}
          <div>
            <div className="flex items-center justify-between">
              <p className="text-[12px] text-accent-ink/55 font-medium">Age bands</p>
              <button
                type="button"
                onClick={addAgeBand}
                className="inline-flex items-center gap-1 text-[12px] text-accent-emerald hover:text-accent-emerald/80"
              >
                <Plus size={12} /> Add band
              </button>
            </div>
            {ageBands.length > 0 ? (
              <div className="mt-2 space-y-2">
                {ageBands.map((band, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="number"
                      value={band.min_age}
                      onChange={(e) => updateAgeBand(i, "min_age", parseInt(e.target.value) || 0)}
                      placeholder="Min"
                      min="0"
                      max="120"
                      className="input-field w-20 text-center"
                    />
                    <span className="text-accent-ink/45">–</span>
                    <input
                      type="number"
                      value={band.max_age}
                      onChange={(e) => updateAgeBand(i, "max_age", parseInt(e.target.value) || 0)}
                      placeholder="Max"
                      min="0"
                      max="120"
                      className="input-field w-20 text-center"
                    />
                    <span className="text-[12px] text-accent-ink/45">yrs →</span>
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-accent-ink/45">₦</span>
                      <input
                        type="number"
                        value={band.monthly_naira}
                        onChange={(e) => updateAgeBand(i, "monthly_naira", parseFloat(e.target.value) || 0)}
                        placeholder="Monthly"
                        min="0"
                        step="0.01"
                        className="input-field pl-7"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAgeBand(i)}
                      className="text-accent-ink/35 hover:text-[#a83232]"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-1 text-[11px] text-accent-ink/45">
                No age bands — the individual monthly rate applies to all ages.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Coverage */}
      <section>
        <h2 className="text-[16px] font-medium text-accent-ink">Coverage</h2>
        <p className="text-[12px] text-accent-ink/55 mt-1">
          Toggle benefits on, then configure limits and co-pay.
        </p>
        <div className="mt-3 space-y-1">
          {BENEFITS.map(({ key, label }) => {
            const item = benefits[key];
            const expanded = expandedBenefits.has(key);
            return (
              <div
                key={key}
                className="rounded-lg border border-black/[0.06] overflow-hidden"
              >
                <div className="flex items-center gap-3 px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={item.enabled}
                    onChange={(e) => updateBenefit(key, "enabled", e.target.checked)}
                  />
                  <button
                    type="button"
                    onClick={() => item.enabled && toggleBenefitExpand(key)}
                    className="flex-1 text-left text-[13px] text-accent-ink flex items-center gap-2"
                    disabled={!item.enabled}
                  >
                    {item.enabled && expanded ? (
                      <ChevronDown size={13} className="text-accent-ink/35" />
                    ) : (
                      <ChevronRight size={13} className="text-accent-ink/35" />
                    )}
                    <span className={item.enabled ? "font-medium" : "text-accent-ink/55"}>
                      {label}
                    </span>
                  </button>
                  {item.enabled && (
                    <label className="flex items-center gap-1.5 text-[11px] text-accent-ink/55">
                      <input
                        type="checkbox"
                        checked={item.covered}
                        onChange={(e) => updateBenefit(key, "covered", e.target.checked)}
                      />
                      Covered
                    </label>
                  )}
                </div>
                {item.enabled && expanded ? (
                  <div className="px-3 pb-3 pt-1 bg-black/[0.02] grid sm:grid-cols-3 gap-3">
                    <Field label="Annual limit (₦)">
                      <input
                        type="number"
                        value={item.limit_naira}
                        onChange={(e) => updateBenefit(key, "limit_naira", e.target.value)}
                        placeholder="no limit"
                        min="0"
                        step="0.01"
                        className="input-field"
                      />
                    </Field>
                    <Field label="Co-pay (%)">
                      <input
                        type="number"
                        value={item.co_pay_percent}
                        onChange={(e) => updateBenefit(key, "co_pay_percent", e.target.value)}
                        placeholder="0"
                        min="0"
                        max="100"
                        className="input-field"
                      />
                    </Field>
                    <Field label="Waiting period (days)">
                      <input
                        type="number"
                        value={item.waiting_period_days}
                        onChange={(e) => updateBenefit(key, "waiting_period_days", e.target.value)}
                        placeholder="0"
                        min="0"
                        className="input-field"
                      />
                    </Field>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>

      {/* Waiting periods */}
      <section>
        <h2 className="text-[16px] font-medium text-accent-ink">Waiting periods</h2>
        <p className="text-[12px] text-accent-ink/55 mt-1">
          Plan-level defaults (in days). Per-benefit waiting periods can be set in the coverage section above.
        </p>
        <div className="mt-3 grid sm:grid-cols-3 gap-3">
          <Field label="General (days)">
            <input
              type="number"
              value={wpGeneral}
              onChange={(e) => setWpGeneral(e.target.value)}
              placeholder="30"
              min="0"
              className="input-field"
            />
          </Field>
          <Field label="Maternity (days)">
            <input
              type="number"
              value={wpMaternity}
              onChange={(e) => setWpMaternity(e.target.value)}
              placeholder="270"
              min="0"
              className="input-field"
            />
          </Field>
          <Field label="Pre-existing (days)">
            <input
              type="number"
              value={wpPreExisting}
              onChange={(e) => setWpPreExisting(e.target.value)}
              placeholder="365"
              min="0"
              className="input-field"
            />
          </Field>
        </div>
      </section>

      {/* Exclusions */}
      <section>
        <h2 className="text-[16px] font-medium text-accent-ink">Exclusions</h2>
        <div className="mt-3 space-y-2">
          {exclusions.map((ex, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="flex-1 text-[13px] text-accent-ink">{ex}</span>
              <button
                type="button"
                onClick={() => setExclusions(exclusions.filter((_, j) => j !== i))}
                className="text-accent-ink/35 hover:text-[#a83232]"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newExclusion}
              onChange={(e) => setNewExclusion(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addExclusion())}
              placeholder="e.g. Cosmetic surgery"
              className="input-field flex-1"
            />
            <button
              type="button"
              onClick={addExclusion}
              className="px-3 py-2 rounded-md border border-black/[0.12] text-[13px] text-accent-ink/65 hover:border-black/30"
            >
              Add
            </button>
          </div>
        </div>
      </section>

      {/* Errors */}
      {error ? (
        <div className="rounded-md border border-[#a83232]/30 bg-[#fde6e6] px-4 py-3 text-[13px] text-[#7a2222]">
          <p className="font-medium">{error}</p>
          {issues.length > 0 ? (
            <ul className="mt-2 space-y-0.5 text-[12px] list-disc list-inside">
              {issues.map((issue, i) => (
                <li key={i}>{issue}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {/* Submit */}
      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={handleSubmit}
          disabled={pending}
          className="px-6 py-2.5 rounded-md bg-accent-emerald text-white text-[14px] font-medium hover:bg-accent-emerald/90 disabled:opacity-50"
        >
          {pending
            ? mode === "edit" ? "Saving…" : "Creating…"
            : mode === "edit" ? "Save changes" : "Create plan"}
        </button>
        <button
          onClick={() => router.back()}
          disabled={pending}
          className="px-4 py-2.5 rounded-md border border-black/[0.12] text-[14px] text-accent-ink/65 hover:border-black/30"
        >
          Cancel
        </button>
      </div>

      <style jsx>{`
        .input-field {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid rgba(0, 0, 0, 0.1);
          border-radius: 6px;
          font-size: 13px;
          color: var(--accent-ink, #0a2e24);
          outline: none;
        }
        .input-field:focus {
          border-color: rgba(16, 185, 129, 0.4);
          box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.1);
        }
        .input-field:disabled {
          background: #f5f5f5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[12px] text-accent-ink/65 font-medium mb-1">
        {label}
        {required ? <span className="text-[#a83232] ml-0.5">*</span> : null}
      </label>
      {children}
      {hint ? <p className="text-[11px] text-accent-ink/45 mt-0.5">{hint}</p> : null}
    </div>
  );
}
