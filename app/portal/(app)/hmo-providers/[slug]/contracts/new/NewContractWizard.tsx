"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Trash2,
  Plus,
  Check,
  AlertCircle,
  Settings2,
  X,
  ArrowLeft,
} from "lucide-react";
import { createContractAction } from "../actions";

// ─────────────────────────────────────────────────────────────────────
// Types matching the action's PartyInput
// ─────────────────────────────────────────────────────────────────────

const ROLES = [
  "HMO",
  "PIERFLOW",
  "EMR_VENDOR",
  "FINTECH",
  "BROKER",
  "REGULATOR_LEVY",
  "REFERRER",
  "OTHER",
] as const;
type Role = (typeof ROLES)[number];

const TIMING = [
  { value: "BOTH", label: "Both events" },
  { value: "RECURRING_ONLY", label: "Monthly premium only" },
  { value: "ENROLLMENT_ONLY", label: "Enrollment only" },
] as const;

type MarkupMode = "GROSS_SHARE" | "MARKUP_FIXED" | "MARKUP_FROM_SHARES";

type PartyDraft = {
  key: string;
  role: Role;
  displayName: string;
  kind: "FLAT" | "PERCENTAGE";
  timing: "BOTH" | "RECURRING_ONLY" | "ENROLLMENT_ONLY";
  amountFlatNaira: string;
  amountPercent: string;
  minPerCycleNaira: string;
  maxPerCycleNaira: string;
  settlementAccountTag: string;
};

function newKey() {
  return Math.random().toString(36).slice(2, 9);
}

function defaultParty(role: Role): PartyDraft {
  return {
    key: newKey(),
    role,
    displayName: "",
    kind: "PERCENTAGE",
    timing: "BOTH",
    amountFlatNaira: "",
    amountPercent: "",
    minPerCycleNaira: "",
    maxPerCycleNaira: "",
    settlementAccountTag: "",
  };
}

function suggestedParties(mode: MarkupMode): PartyDraft[] {
  if (mode === "GROSS_SHARE") {
    return [
      {
        ...defaultParty("HMO"),
        amountPercent: "82",
        settlementAccountTag: "hmo:default",
      },
      {
        ...defaultParty("PIERFLOW"),
        amountPercent: "6",
        minPerCycleNaira: "100",
        maxPerCycleNaira: "1000",
        settlementAccountTag: "pierflow:platform_fee",
      },
      {
        ...defaultParty("EMR_VENDOR"),
        amountPercent: "3",
        settlementAccountTag: "emr_vendor:default",
      },
      {
        ...defaultParty("FINTECH"),
        amountPercent: "9",
        settlementAccountTag: "fintech:self",
      },
    ];
  }
  if (mode === "MARKUP_FIXED") {
    return [
      {
        ...defaultParty("PIERFLOW"),
        kind: "FLAT",
        amountFlatNaira: "200",
        settlementAccountTag: "pierflow:platform_fee",
      },
      {
        ...defaultParty("EMR_VENDOR"),
        kind: "FLAT",
        amountFlatNaira: "300",
        settlementAccountTag: "emr_vendor:default",
      },
      {
        ...defaultParty("FINTECH"),
        kind: "FLAT",
        amountFlatNaira: "1000",
        settlementAccountTag: "fintech:self",
      },
    ];
  }
  return [
    {
      ...defaultParty("PIERFLOW"),
      amountPercent: "3",
      settlementAccountTag: "pierflow:platform_fee",
    },
    {
      ...defaultParty("EMR_VENDOR"),
      amountPercent: "2",
      settlementAccountTag: "emr_vendor:default",
    },
    {
      ...defaultParty("FINTECH"),
      amountPercent: "12",
      settlementAccountTag: "fintech:self",
    },
  ];
}

function defaultRemainderBearer(mode: MarkupMode): Role {
  return mode === "GROSS_SHARE" ? "HMO" : "FINTECH";
}

function defaultEnrollmentBeneficiary(mode: MarkupMode): Role {
  return mode === "GROSS_SHARE" ? "HMO" : "FINTECH";
}

const MODE_LABELS: Record<MarkupMode, string> = {
  GROSS_SHARE: "Gross share",
  MARKUP_FIXED: "Wholesale + fixed markup",
  MARKUP_FROM_SHARES: "Wholesale + per-party markup",
};

// ─────────────────────────────────────────────────────────────────────
// Wizard
// ─────────────────────────────────────────────────────────────────────

export default function NewContractWizard({ slug }: { slug: string }) {
  const router = useRouter();
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0);
  const [mode, setMode] = useState<MarkupMode>("GROSS_SHARE");
  const [parties, setParties] = useState<PartyDraft[]>(
    suggestedParties("GROSS_SHARE"),
  );
  const [remainderBearer, setRemainderBearer] = useState<Role>("HMO");
  const [enrollmentBeneficiary, setEnrollmentBeneficiary] =
    useState<Role>("HMO");
  const [effectiveFrom, setEffectiveFrom] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [effectiveTo, setEffectiveTo] = useState("");
  const [enrollmentFeeNaira, setEnrollmentFeeNaira] = useState("");
  const [markupFixedNaira, setMarkupFixedNaira] = useState("1500");
  const [wholesaleSampleNaira, setWholesaleSampleNaira] = useState("8500");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();

  function pickMode(next: MarkupMode) {
    setMode(next);
    setParties(suggestedParties(next));
    setRemainderBearer(defaultRemainderBearer(next));
    setEnrollmentBeneficiary(defaultEnrollmentBeneficiary(next));
  }

  // Keep remainder bearer in a present role.
  useEffect(() => {
    if (!parties.some((p) => p.role === remainderBearer)) {
      const fallback = parties[0]?.role;
      if (fallback) setRemainderBearer(fallback);
    }
  }, [parties, remainderBearer]);

  function updateParty(key: string, patch: Partial<PartyDraft>) {
    setParties((rows) =>
      rows.map((r) => (r.key === key ? { ...r, ...patch } : r)),
    );
  }
  function removeParty(key: string) {
    setParties((rows) => rows.filter((r) => r.key !== key));
  }
  function addParty() {
    setParties((rows) => [...rows, defaultParty("OTHER")]);
  }

  const inMarkupMode = mode !== "GROSS_SHARE";

  // ── Live percentage check on recurring lines (gross share only) ──
  const recurringPercentSum = useMemo(
    () =>
      parties
        .filter(
          (p) =>
            p.kind === "PERCENTAGE" &&
            (p.timing === "RECURRING_ONLY" || p.timing === "BOTH"),
        )
        .reduce((acc, p) => acc + (Number(p.amountPercent) || 0), 0),
    [parties],
  );

  const hmoPresent = parties.some((p) => p.role === "HMO");
  const partiesRuleError =
    mode === "GROSS_SHARE" && !hmoPresent
      ? "Gross share contract must include an HMO party."
      : inMarkupMode && hmoPresent
        ? "Markup contracts must not include an HMO party — they receive wholesale directly."
        : null;

  function submit() {
    setErrors([]);
    const payload = {
      slug,
      effectiveFrom,
      effectiveTo: effectiveTo || null,
      markupMode: mode,
      markupFixedNaira:
        mode === "MARKUP_FIXED" && markupFixedNaira
          ? Number(markupFixedNaira)
          : null,
      enrollmentFeeNaira: enrollmentFeeNaira
        ? Number(enrollmentFeeNaira)
        : null,
      enrollmentBeneficiaryRole:
        inMarkupMode && enrollmentFeeNaira ? enrollmentBeneficiary : null,
      remainderBearer,
      notes: notes || null,
      parties: parties.map((p) => ({
        role: p.role,
        displayName: p.displayName.trim() || null,
        partnerId: null,
        kind: p.kind,
        timing: p.timing,
        amountFlatNaira:
          p.kind === "FLAT" && p.amountFlatNaira
            ? Number(p.amountFlatNaira)
            : null,
        amountPercent:
          p.kind === "PERCENTAGE" && p.amountPercent
            ? Number(p.amountPercent)
            : null,
        minPerCycleNaira: p.minPerCycleNaira
          ? Number(p.minPerCycleNaira)
          : null,
        maxPerCycleNaira: p.maxPerCycleNaira
          ? Number(p.maxPerCycleNaira)
          : null,
        settlementAccountTag: p.settlementAccountTag || null,
        notes: null,
      })),
    };

    startTransition(async () => {
      const result = await createContractAction(payload);
      if (!result.ok) {
        setErrors(result.issues ?? [result.reason]);
        setStep(1);
        return;
      }
      router.push(
        `/portal/hmo-providers/${slug}/contracts/${result.contractId}`,
      );
      router.refresh();
    });
  }

  return (
    <div className="mt-8 space-y-8">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <Stepper current={step} />
        {step > 0 ? (
          <ModeChip
            label={MODE_LABELS[mode]}
            onEdit={() => setStep(0)}
          />
        ) : null}
      </div>

      {step === 0 ? (
        <StepMode
          mode={mode}
          pickMode={pickMode}
          onNext={() => setStep(1)}
          slug={slug}
        />
      ) : step === 1 ? (
        <StepParties
          mode={mode}
          parties={parties}
          updateParty={updateParty}
          removeParty={removeParty}
          addParty={addParty}
          recurringPercentSum={recurringPercentSum}
          partiesRuleError={partiesRuleError}
          onBack={() => setStep(0)}
          onNext={() => setStep(2)}
          slug={slug}
        />
      ) : step === 2 ? (
        <StepTerms
          mode={mode}
          effectiveFrom={effectiveFrom}
          setEffectiveFrom={setEffectiveFrom}
          effectiveTo={effectiveTo}
          setEffectiveTo={setEffectiveTo}
          enrollmentFeeNaira={enrollmentFeeNaira}
          setEnrollmentFeeNaira={setEnrollmentFeeNaira}
          markupFixedNaira={markupFixedNaira}
          setMarkupFixedNaira={setMarkupFixedNaira}
          enrollmentBeneficiary={enrollmentBeneficiary}
          setEnrollmentBeneficiary={setEnrollmentBeneficiary}
          remainderBearer={remainderBearer}
          setRemainderBearer={setRemainderBearer}
          notes={notes}
          setNotes={setNotes}
          parties={parties}
          onBack={() => setStep(1)}
          onNext={() => setStep(3)}
          slug={slug}
        />
      ) : (
        <StepReview
          mode={mode}
          parties={parties}
          remainderBearer={remainderBearer}
          enrollmentBeneficiary={enrollmentBeneficiary}
          effectiveFrom={effectiveFrom}
          effectiveTo={effectiveTo}
          enrollmentFeeNaira={enrollmentFeeNaira}
          markupFixedNaira={markupFixedNaira}
          wholesaleSampleNaira={wholesaleSampleNaira}
          setWholesaleSampleNaira={setWholesaleSampleNaira}
          notes={notes}
          errors={errors}
          pending={pending}
          onBack={() => setStep(2)}
          onSubmit={submit}
          slug={slug}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Step 0 — Mode picker
// ─────────────────────────────────────────────────────────────────────

const MODE_CARDS: { mode: MarkupMode; title: string; short: string }[] = [
  {
    mode: "GROSS_SHARE",
    title: "Gross share",
    short: "Split the user's full premium. HMO is a participant.",
  },
  {
    mode: "MARKUP_FIXED",
    title: "Wholesale + fixed markup",
    short: "HMO is paid wholesale. A fixed markup on top is split.",
  },
  {
    mode: "MARKUP_FROM_SHARES",
    title: "Wholesale + per-party markup",
    short: "HMO is paid wholesale. Each party adds a margin on top.",
  },
];

function StepMode({
  mode,
  pickMode,
  onNext,
  slug,
}: {
  mode: MarkupMode;
  pickMode: (m: MarkupMode) => void;
  onNext: () => void;
  slug: string;
}) {
  return (
    <section>
      <h2 className="text-[16px] font-medium text-accent-ink">
        Commercial structure
      </h2>
      <p className="mt-1 text-[13px] text-accent-ink/65 max-w-[720px]">
        How does the user-facing price relate to the HMO&apos;s wholesale
        plan price?
      </p>

      <div className="mt-5 grid lg:grid-cols-3 gap-4">
        {MODE_CARDS.map((card) => {
          const active = card.mode === mode;
          return (
            <button
              key={card.mode}
              type="button"
              onClick={() => pickMode(card.mode)}
              className={`text-left rounded-2xl border p-5 transition ${
                active
                  ? "border-accent-emerald bg-card-mint/40"
                  : "border-black/[0.08] hover:border-black/25"
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`w-4 h-4 rounded-full border-[2px] grid place-items-center shrink-0 ${
                    active
                      ? "border-accent-emerald bg-accent-emerald"
                      : "border-black/25"
                  }`}
                >
                  {active ? (
                    <span className="w-1.5 h-1.5 rounded-full bg-white" />
                  ) : null}
                </span>
                <p className="text-[14px] font-medium text-accent-ink">
                  {card.title}
                </p>
              </div>
              <p className="mt-3 text-[13px] leading-[1.55] text-accent-ink/75">
                {card.short}
              </p>
            </button>
          );
        })}
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button
          type="button"
          onClick={onNext}
          className="px-5 py-2.5 rounded-full bg-accent-ink text-white text-[13px] font-medium"
        >
          Continue
        </button>
        <CancelLink slug={slug} />
        <span className="ml-auto text-[12px] text-accent-ink/45">
          Step 1 of 4 — Mode
        </span>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Step 1 — Parties
// ─────────────────────────────────────────────────────────────────────

function StepParties({
  mode,
  parties,
  updateParty,
  removeParty,
  addParty,
  recurringPercentSum,
  partiesRuleError,
  onBack,
  onNext,
  slug,
}: {
  mode: MarkupMode;
  parties: PartyDraft[];
  updateParty: (key: string, patch: Partial<PartyDraft>) => void;
  removeParty: (key: string) => void;
  addParty: () => void;
  recurringPercentSum: number;
  partiesRuleError: string | null;
  onBack: () => void;
  onNext: () => void;
  slug: string;
}) {
  // GROSS_SHARE percentage-sum check applies to recurring lines.
  // MARKUP_FIXED: recurring split is flat-dominated; percent sum
  //   isn't a constraint, so we don't surface a pill.
  // MARKUP_FROM_SHARES: percentages are *of wholesale*; can exceed
  //   100% in theory (high markup), so we show the value but don't
  //   flag it as an error.
  const recurringOver = mode === "GROSS_SHARE" && recurringPercentSum > 100;
  const blocked =
    parties.length === 0 ||
    recurringOver ||
    !!partiesRuleError ||
    parties.some((p) => {
      if (p.kind === "PERCENTAGE")
        return !p.amountPercent || Number(p.amountPercent) <= 0;
      return !p.amountFlatNaira || Number(p.amountFlatNaira) <= 0;
    });

  // Per-party caps popover state.
  const [openCapsKey, setOpenCapsKey] = useState<string | null>(null);

  return (
    <section>
      <h2 className="text-[16px] font-medium text-accent-ink">Parties</h2>
      <p className="mt-1 text-[13px] text-accent-ink/65 max-w-[720px]">
        {mode === "GROSS_SHARE"
          ? "Who shares in the user's premium, and how much. The HMO participates."
          : "Who shares in the markup. The HMO receives wholesale directly and is not a party here. The enrollment fee, if any, goes to a single party you'll designate on the next step."}
      </p>

      <div className="mt-5 rounded-xl border border-black/[0.08] overflow-x-auto">
        <table className="w-full text-[12px] min-w-[860px]">
          <thead className="bg-black/[0.03] text-accent-ink/55 uppercase tracking-[0.1em] text-[10px]">
            <tr>
              <th className="text-left px-3 py-2.5 font-medium">Role</th>
              <th className="text-left px-3 py-2.5 font-medium">Kind</th>
              <th className="text-left px-3 py-2.5 font-medium">Amount</th>
              <th className="text-left px-3 py-2.5 font-medium">When</th>
              <th className="text-left px-3 py-2.5 font-medium">Caps</th>
              <th className="text-left px-3 py-2.5 font-medium">
                Settlement tag
              </th>
              <th className="px-3 py-2.5 w-8"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/[0.06]">
            {parties.map((p) => {
              const hasCaps = !!(p.minPerCycleNaira || p.maxPerCycleNaira);
              const capsAllowed = p.kind === "PERCENTAGE";
              return (
                <tr key={p.key}>
                  <td className="px-3 py-2 align-middle">
                    <select
                      value={p.role}
                      onChange={(e) =>
                        updateParty(p.key, { role: e.target.value as Role })
                      }
                      className={selectCls}
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                    {p.role === "OTHER" ||
                    p.role === "BROKER" ||
                    p.role === "REFERRER" ? (
                      <input
                        placeholder="Display name"
                        value={p.displayName}
                        onChange={(e) =>
                          updateParty(p.key, { displayName: e.target.value })
                        }
                        className={inputCls + " mt-1.5 w-full"}
                      />
                    ) : null}
                  </td>
                  <td className="px-3 py-2 align-middle">
                    <select
                      value={p.kind}
                      onChange={(e) =>
                        updateParty(p.key, {
                          kind: e.target.value as "FLAT" | "PERCENTAGE",
                          // Clear caps when switching to flat
                          ...(e.target.value === "FLAT"
                            ? { minPerCycleNaira: "", maxPerCycleNaira: "" }
                            : {}),
                        })
                      }
                      className={selectCls}
                    >
                      <option value="PERCENTAGE">
                        {mode === "MARKUP_FROM_SHARES"
                          ? "% of wholesale"
                          : "%"}
                      </option>
                      <option value="FLAT">flat ₦</option>
                    </select>
                  </td>
                  <td className="px-3 py-2 align-middle">
                    {p.kind === "PERCENTAGE" ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={p.amountPercent}
                          onChange={(e) =>
                            updateParty(p.key, {
                              amountPercent: e.target.value,
                            })
                          }
                          className={inputCls + " w-20"}
                        />
                        <span className="text-accent-ink/55">%</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <span className="text-accent-ink/55">₦</span>
                        <input
                          type="number"
                          step="1"
                          min="0"
                          value={p.amountFlatNaira}
                          onChange={(e) =>
                            updateParty(p.key, {
                              amountFlatNaira: e.target.value,
                            })
                          }
                          className={inputCls + " w-24"}
                        />
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 align-middle">
                    <select
                      value={p.timing}
                      onChange={(e) =>
                        updateParty(p.key, {
                          timing: e.target.value as PartyDraft["timing"],
                        })
                      }
                      className={selectCls}
                    >
                      {TIMING.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2 align-middle relative">
                    {capsAllowed ? (
                      <button
                        type="button"
                        onClick={() =>
                          setOpenCapsKey(
                            openCapsKey === p.key ? null : p.key,
                          )
                        }
                        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-[11px] ${
                          hasCaps
                            ? "border-accent-emerald text-accent-emerald bg-card-mint/30"
                            : "border-black/[0.12] text-accent-ink/55 hover:text-accent-ink"
                        }`}
                      >
                        <Settings2 size={11} />
                        {hasCaps
                          ? `min ${p.minPerCycleNaira || "—"} / max ${p.maxPerCycleNaira || "—"}`
                          : "Set caps"}
                      </button>
                    ) : (
                      <span className="text-accent-ink/35 text-[11px]">
                        —
                      </span>
                    )}
                    {openCapsKey === p.key ? (
                      <CapsPopover
                        min={p.minPerCycleNaira}
                        max={p.maxPerCycleNaira}
                        onChange={(patch) => updateParty(p.key, patch)}
                        onClose={() => setOpenCapsKey(null)}
                      />
                    ) : null}
                  </td>
                  <td className="px-3 py-2 align-middle">
                    <input
                      placeholder="pierflow:platform_fee"
                      value={p.settlementAccountTag}
                      onChange={(e) =>
                        updateParty(p.key, {
                          settlementAccountTag: e.target.value,
                        })
                      }
                      className={inputCls + " font-mono w-full min-w-[160px]"}
                    />
                  </td>
                  <td className="px-3 py-2 align-middle">
                    <button
                      type="button"
                      onClick={() => removeParty(p.key)}
                      className="text-accent-ink/45 hover:text-[#a83232]"
                      aria-label="Remove party"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="px-3 py-2.5 border-t border-black/[0.06] flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={addParty}
            className="inline-flex items-center gap-1.5 text-[12px] text-accent-emerald hover:text-accent-ink"
          >
            <Plus size={12} /> Add party
          </button>
          {mode === "GROSS_SHARE" ? (
            <SumPill
              label="Recurring % sum"
              value={recurringPercentSum}
              over={recurringOver}
              ideal={100}
            />
          ) : mode === "MARKUP_FROM_SHARES" ? (
            <SumPill
              label="Markup % of wholesale"
              value={recurringPercentSum}
              over={false}
            />
          ) : null}
          <span className="ml-auto text-[11px] text-accent-ink/45">
            Caps only apply to monthly premiums, not enrollment fees.
          </span>
        </div>
      </div>

      {partiesRuleError ? (
        <p className="mt-3 text-[12px] text-[#a83232] inline-flex items-center gap-1.5">
          <AlertCircle size={12} /> {partiesRuleError}
        </p>
      ) : null}

      {recurringOver ? (
        <p className="mt-3 text-[12px] text-[#a83232] inline-flex items-center gap-1.5">
          <AlertCircle size={12} /> Recurring percentage sum exceeds 100%.
          Adjust shares before continuing.
        </p>
      ) : null}

      <div className="mt-6 flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 rounded-full border border-black/[0.12] text-accent-ink/75 text-[13px] font-medium"
        >
          Back
        </button>
        <button
          type="button"
          disabled={blocked}
          onClick={onNext}
          className="px-5 py-2.5 rounded-full bg-accent-ink text-white text-[13px] font-medium disabled:opacity-40"
        >
          Continue
        </button>
        <CancelLink slug={slug} />
        <span className="ml-auto text-[12px] text-accent-ink/45">
          Step 2 of 4 — Parties
        </span>
      </div>
    </section>
  );
}

function CapsPopover({
  min,
  max,
  onChange,
  onClose,
}: {
  min: string;
  max: string;
  onChange: (patch: Partial<PartyDraft>) => void;
  onClose: () => void;
}) {
  return (
    <div className="absolute z-10 left-0 top-full mt-1 w-64 rounded-lg border border-black/[0.12] bg-white shadow-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] uppercase tracking-[0.12em] text-accent-ink/55 font-medium">
          Caps per cycle
        </p>
        <button
          type="button"
          onClick={onClose}
          className="text-accent-ink/45 hover:text-accent-ink"
        >
          <X size={12} />
        </button>
      </div>
      <p className="text-[11px] text-accent-ink/55 mb-2 leading-[1.4]">
        Floors and ceilings on the monthly premium share. Leave blank for
        no limit.
      </p>
      <div className="space-y-2">
        <label className="block">
          <span className="text-[11px] text-accent-ink/55">Minimum ₦</span>
          <input
            type="number"
            min="0"
            value={min}
            onChange={(e) => onChange({ minPerCycleNaira: e.target.value })}
            className={inputCls + " w-full mt-1"}
            placeholder="0"
          />
        </label>
        <label className="block">
          <span className="text-[11px] text-accent-ink/55">Maximum ₦</span>
          <input
            type="number"
            min="0"
            value={max}
            onChange={(e) => onChange({ maxPerCycleNaira: e.target.value })}
            className={inputCls + " w-full mt-1"}
            placeholder="No cap"
          />
        </label>
      </div>
      <div className="mt-3 flex items-center justify-end gap-2">
        {min || max ? (
          <button
            type="button"
            onClick={() =>
              onChange({ minPerCycleNaira: "", maxPerCycleNaira: "" })
            }
            className="text-[11px] text-accent-ink/55 hover:text-[#a83232]"
          >
            Clear
          </button>
        ) : null}
        <button
          type="button"
          onClick={onClose}
          className="text-[11px] px-2.5 py-1 rounded-full bg-accent-ink text-white"
        >
          Done
        </button>
      </div>
    </div>
  );
}

function SumPill({
  label,
  value,
  over,
  ideal,
}: {
  label: string;
  value: number;
  over: boolean;
  ideal?: number;
}) {
  const isIdeal = ideal !== undefined && value === ideal;
  return (
    <span
      className={`px-2 py-0.5 rounded-full text-[11px] ${
        over
          ? "bg-[#fde6e6] text-[#a83232]"
          : isIdeal
            ? "bg-card-mint text-accent-emerald"
            : "bg-black/[0.05] text-accent-ink/65"
      }`}
    >
      {label}: {value.toFixed(value % 1 === 0 ? 0 : 2)}%
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Step 2 — Terms
// ─────────────────────────────────────────────────────────────────────

function StepTerms({
  mode,
  effectiveFrom,
  setEffectiveFrom,
  effectiveTo,
  setEffectiveTo,
  enrollmentFeeNaira,
  setEnrollmentFeeNaira,
  markupFixedNaira,
  setMarkupFixedNaira,
  enrollmentBeneficiary,
  setEnrollmentBeneficiary,
  remainderBearer,
  setRemainderBearer,
  notes,
  setNotes,
  parties,
  onBack,
  onNext,
  slug,
}: {
  mode: MarkupMode;
  effectiveFrom: string;
  setEffectiveFrom: (v: string) => void;
  effectiveTo: string;
  setEffectiveTo: (v: string) => void;
  enrollmentFeeNaira: string;
  setEnrollmentFeeNaira: (v: string) => void;
  markupFixedNaira: string;
  setMarkupFixedNaira: (v: string) => void;
  enrollmentBeneficiary: Role;
  setEnrollmentBeneficiary: (r: Role) => void;
  remainderBearer: Role;
  setRemainderBearer: (r: Role) => void;
  notes: string;
  setNotes: (v: string) => void;
  parties: PartyDraft[];
  onBack: () => void;
  onNext: () => void;
  slug: string;
}) {
  const rolesInUse = Array.from(new Set(parties.map((p) => p.role)));
  // Markup beneficiary may not be in `parties` (e.g. FINTECH role
  // never declared) — offer the full roster.
  const allowedBeneficiaryRoles = Array.from(
    new Set<Role>([...rolesInUse, "FINTECH", "PIERFLOW", "EMR_VENDOR"]),
  );
  const markupRequired = mode === "MARKUP_FIXED";
  const inMarkupMode = mode !== "GROSS_SHARE";
  const hasEnrollmentFee = Number(enrollmentFeeNaira) > 0;

  const canContinue =
    !!effectiveFrom &&
    (!markupRequired ||
      (markupFixedNaira !== "" && Number(markupFixedNaira) > 0));

  return (
    <section>
      <h2 className="text-[16px] font-medium text-accent-ink">
        Effective dates &amp; fees
      </h2>

      <div className="mt-5 grid sm:grid-cols-2 gap-5 max-w-[640px]">
        <Field label="Effective from" required>
          <input
            type="date"
            value={effectiveFrom}
            onChange={(e) => setEffectiveFrom(e.target.value)}
            className={inputCls + " w-full"}
          />
        </Field>
        <Field label="Effective to (optional)">
          <input
            type="date"
            value={effectiveTo}
            onChange={(e) => setEffectiveTo(e.target.value)}
            className={inputCls + " w-full"}
          />
        </Field>

        {markupRequired ? (
          <Field
            label="Fixed markup (₦)"
            required
            hint="Added on top of every wholesale premium. Platform parties split this."
          >
            <div className="flex items-center gap-1">
              <span className="text-accent-ink/55">₦</span>
              <input
                type="number"
                min="1"
                step="1"
                value={markupFixedNaira}
                onChange={(e) => setMarkupFixedNaira(e.target.value)}
                className={inputCls + " w-full"}
              />
            </div>
          </Field>
        ) : null}

        <Field
          label="Enrollment fee (₦)"
          hint="Optional. Charged once at signup."
        >
          <div className="flex items-center gap-1">
            <span className="text-accent-ink/55">₦</span>
            <input
              type="number"
              min="0"
              step="1"
              value={enrollmentFeeNaira}
              onChange={(e) => setEnrollmentFeeNaira(e.target.value)}
              className={inputCls + " w-full"}
            />
          </div>
        </Field>

        {inMarkupMode && hasEnrollmentFee ? (
          <Field
            label="Enrollment fee goes to"
            required
            hint="The whole enrollment fee is paid to this party. Markup-mode contracts don't split the enrollment fee."
          >
            <select
              value={enrollmentBeneficiary}
              onChange={(e) =>
                setEnrollmentBeneficiary(e.target.value as Role)
              }
              className={selectCls + " w-full"}
            >
              {allowedBeneficiaryRoles.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </Field>
        ) : null}

        <Field
          label="Remainder bearer"
          hint={
            mode === "GROSS_SHARE"
              ? "Absorbs residual kobo after caps/rounding. Usually the HMO."
              : "Absorbs residual kobo in the markup split. Usually the fintech."
          }
        >
          <select
            value={remainderBearer}
            onChange={(e) => setRemainderBearer(e.target.value as Role)}
            className={selectCls + " w-full"}
          >
            {rolesInUse.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field
        label="Notes (internal)"
        hint="Free-form. Visible to staff only."
      >
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className={inputCls + " w-full max-w-[640px]"}
        />
      </Field>

      <div className="mt-6 flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 rounded-full border border-black/[0.12] text-accent-ink/75 text-[13px] font-medium"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!canContinue}
          className="px-5 py-2.5 rounded-full bg-accent-ink text-white text-[13px] font-medium disabled:opacity-40"
        >
          Continue
        </button>
        <CancelLink slug={slug} />
        <span className="ml-auto text-[12px] text-accent-ink/45">
          Step 3 of 4 — Terms
        </span>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Step 3 — Review with wholesale-aware preview
// ─────────────────────────────────────────────────────────────────────

function StepReview({
  mode,
  parties,
  remainderBearer,
  enrollmentBeneficiary,
  effectiveFrom,
  effectiveTo,
  enrollmentFeeNaira,
  markupFixedNaira,
  wholesaleSampleNaira,
  setWholesaleSampleNaira,
  notes,
  errors,
  pending,
  onBack,
  onSubmit,
  slug,
}: {
  mode: MarkupMode;
  parties: PartyDraft[];
  remainderBearer: Role;
  enrollmentBeneficiary: Role;
  effectiveFrom: string;
  effectiveTo: string;
  enrollmentFeeNaira: string;
  markupFixedNaira: string;
  wholesaleSampleNaira: string;
  setWholesaleSampleNaira: (v: string) => void;
  notes: string;
  errors: string[];
  pending: boolean;
  onBack: () => void;
  onSubmit: () => void;
  slug: string;
}) {
  const inMarkupMode = mode !== "GROSS_SHARE";
  const recurring = useMemo(
    () =>
      previewPremiumSplits(
        mode,
        parties,
        remainderBearer,
        Number(wholesaleSampleNaira) || 0,
        Number(markupFixedNaira) || 0,
      ),
    [mode, parties, remainderBearer, wholesaleSampleNaira, markupFixedNaira],
  );

  const enrollmentFee = Number(enrollmentFeeNaira) || 0;
  const enrollment = useMemo(
    () =>
      previewEnrollmentSplits(
        mode,
        parties,
        remainderBearer,
        enrollmentBeneficiary,
        enrollmentFee,
      ),
    [mode, parties, remainderBearer, enrollmentBeneficiary, enrollmentFee],
  );

  return (
    <section>
      <h2 className="text-[16px] font-medium text-accent-ink">
        Review &amp; save
      </h2>

      <div className="mt-5 grid lg:grid-cols-2 gap-4">
        {/* ── Summary ─────────────────────────────────────────────── */}
        <div className="rounded-xl border border-black/[0.08] p-4 space-y-2.5">
          <p className="text-[11px] uppercase tracking-[0.12em] text-accent-ink/45 font-medium">
            Summary
          </p>
          <Row label="Mode" value={MODE_LABELS[mode]} />
          <Row label="Effective from" value={effectiveFrom} />
          {effectiveTo ? <Row label="Effective to" value={effectiveTo} /> : null}
          <Row label="Remainder bearer" value={remainderBearer} />
          {mode === "MARKUP_FIXED" ? (
            <Row
              label="Fixed markup"
              value={`₦${Number(markupFixedNaira).toLocaleString()}`}
            />
          ) : null}
          {enrollmentFee > 0 ? (
            <>
              <Row
                label="Enrollment fee"
                value={`₦${enrollmentFee.toLocaleString()}`}
              />
              {inMarkupMode ? (
                <Row
                  label="Enrollment fee → "
                  value={enrollmentBeneficiary}
                />
              ) : null}
            </>
          ) : (
            <Row label="Enrollment fee" value="—" />
          )}
          <Row label="Parties" value={String(parties.length)} />
          {notes ? (
            <div className="pt-2 border-t border-black/[0.06]">
              <p className="text-[11px] uppercase tracking-[0.12em] text-accent-ink/45">
                Notes
              </p>
              <p className="mt-1 text-[12px] text-accent-ink/75 whitespace-pre-wrap">
                {notes}
              </p>
            </div>
          ) : null}
        </div>

        {/* ── Premium preview ──────────────────────────────────── */}
        <div className="rounded-xl border border-black/[0.08] p-4">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[11px] uppercase tracking-[0.12em] text-accent-ink/45 font-medium">
              {mode === "GROSS_SHARE"
                ? "Recurring premium"
                : "Wholesale + markup"}
            </p>
            <label className="flex items-center gap-1.5 text-[11px] text-accent-ink/55">
              Try a different
              <span className="text-accent-ink/75">
                {mode === "GROSS_SHARE" ? "premium" : "wholesale"}
              </span>
              <span className="text-accent-ink/55">₦</span>
              <input
                type="number"
                min="0"
                value={wholesaleSampleNaira}
                onChange={(e) => setWholesaleSampleNaira(e.target.value)}
                className={inputCls + " w-24"}
              />
            </label>
          </div>
          <PremiumPreviewTable result={recurring} mode={mode} />
        </div>
      </div>

      {/* ── Enrollment fee preview ─────────────────────────────── */}
      {enrollmentFee > 0 ? (
        <div className="mt-4 rounded-xl border border-black/[0.08] p-4">
          <p className="text-[11px] uppercase tracking-[0.12em] text-accent-ink/45 font-medium">
            Enrollment fee ₦{enrollmentFee.toLocaleString()}
            {inMarkupMode ? ` → ${enrollmentBeneficiary}` : ""}
          </p>
          <EnrollmentPreviewTable result={enrollment} />
        </div>
      ) : null}

      {errors.length > 0 ? (
        <div className="mt-4 rounded-lg border border-[#fde6e6] bg-[#fdf3f3] p-3 text-[12px] text-[#7a2727]">
          <p className="font-medium">Couldn’t save</p>
          <ul className="mt-1 list-disc list-inside space-y-0.5">
            {errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-6 flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 rounded-full border border-black/[0.12] text-accent-ink/75 text-[13px] font-medium"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={pending}
          className="px-5 py-2.5 rounded-full bg-accent-ink text-white text-[13px] font-medium disabled:opacity-50 inline-flex items-center gap-1.5"
        >
          <Check size={14} /> {pending ? "Saving…" : "Save as draft"}
        </button>
        <CancelLink slug={slug} />
        <span className="ml-auto text-[12px] text-accent-ink/45">
          Step 4 of 4 — Review
        </span>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Wizard chrome
// ─────────────────────────────────────────────────────────────────────

function Stepper({ current }: { current: 0 | 1 | 2 | 3 }) {
  const steps = ["Mode", "Parties", "Terms", "Review"];
  return (
    <ol className="flex items-center gap-2 text-[12px]">
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={s} className="flex items-center gap-2">
            <span
              className={`w-6 h-6 rounded-full grid place-items-center text-[11px] font-medium ${
                active
                  ? "bg-accent-ink text-white"
                  : done
                    ? "bg-card-mint text-accent-emerald"
                    : "bg-black/[0.06] text-accent-ink/45"
              }`}
            >
              {done ? <Check size={12} /> : i + 1}
            </span>
            <span
              className={
                active
                  ? "text-accent-ink font-medium"
                  : "text-accent-ink/45"
              }
            >
              {s}
            </span>
            {i < steps.length - 1 ? (
              <span className="w-6 h-px bg-black/[0.1] mx-1" />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

function ModeChip({
  label,
  onEdit,
}: {
  label: string;
  onEdit: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onEdit}
      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-black/[0.12] text-[11px] text-accent-ink/75 hover:text-accent-ink"
    >
      <span className="text-accent-ink/45 uppercase tracking-[0.1em]">
        Mode
      </span>
      <span className="text-accent-ink">{label}</span>
      <span className="text-accent-emerald text-[10px]">change</span>
    </button>
  );
}

function CancelLink({ slug }: { slug: string }) {
  return (
    <a
      href={`/portal/hmo-providers/${slug}/contracts`}
      className="inline-flex items-center gap-1 text-[13px] text-accent-ink/55 hover:text-accent-ink"
    >
      <ArrowLeft size={12} /> Cancel
    </a>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Inline preview math
// ─────────────────────────────────────────────────────────────────────

type PreviewLine = {
  role: Role;
  amountNaira: number;
  isRemainder: boolean;
  /** Original (pre-cap) amount when the ceiling clamped down. */
  cappedFrom?: number;
  /** Original (pre-floor) amount when the floor lifted up. */
  flooredFrom?: number;
};

type PremiumPreviewResult =
  | {
      ok: true;
      wholesaleNaira: number;
      markupNaira: number;
      memberPaysNaira: number;
      hmoLineNaira: number;
      lines: PreviewLine[];
    }
  | { ok: false; issues: string[] };

type EnrollmentPreviewResult =
  | { ok: true; lines: PreviewLine[]; totalNaira: number }
  | { ok: false; issues: string[] };

function previewPremiumSplits(
  mode: MarkupMode,
  parties: PartyDraft[],
  remainderBearer: Role,
  wholesaleNaira: number,
  markupFixedNaira: number,
): PremiumPreviewResult {
  if (wholesaleNaira <= 0) {
    return { ok: false, issues: ["Set a wholesale amount > 0."] };
  }
  const eligible = parties.filter(
    (p) => p.timing === "BOTH" || p.timing === "RECURRING_ONLY",
  );
  if (eligible.length === 0) {
    return {
      ok: false,
      issues: ["No parties configured for recurring premium."],
    };
  }

  if (mode === "GROSS_SHARE") {
    const inner = grossSharePreview(
      eligible,
      remainderBearer,
      wholesaleNaira,
      false,
    );
    if (!inner.ok) return { ok: false, issues: inner.issues };
    const hmo = inner.lines.find((l) => l.role === "HMO");
    return {
      ok: true,
      wholesaleNaira,
      markupNaira: 0,
      memberPaysNaira: wholesaleNaira,
      hmoLineNaira: hmo?.amountNaira ?? 0,
      lines: inner.lines,
    };
  }

  if (mode === "MARKUP_FIXED") {
    if (markupFixedNaira <= 0) {
      return {
        ok: false,
        issues: ["Set a fixed markup > 0 on Step 3 to preview."],
      };
    }
    const inner = grossSharePreview(
      eligible,
      remainderBearer,
      markupFixedNaira,
      false,
    );
    if (!inner.ok) return { ok: false, issues: inner.issues };
    return {
      ok: true,
      wholesaleNaira,
      markupNaira: markupFixedNaira,
      memberPaysNaira: wholesaleNaira + markupFixedNaira,
      hmoLineNaira: wholesaleNaira,
      lines: inner.lines,
    };
  }

  // MARKUP_FROM_SHARES — each share is OF wholesale; not re-split.
  const lines: PreviewLine[] = [];
  for (const p of eligible) {
    let amt: number;
    let cappedFrom: number | undefined;
    let flooredFrom: number | undefined;
    if (p.kind === "FLAT") {
      amt = Number(p.amountFlatNaira) || 0;
    } else {
      const pct = Number(p.amountPercent) || 0;
      const raw = (wholesaleNaira * pct) / 100;
      amt = raw;
      const min = p.minPerCycleNaira ? Number(p.minPerCycleNaira) : null;
      const max = p.maxPerCycleNaira ? Number(p.maxPerCycleNaira) : null;
      if (min !== null && amt < min) {
        flooredFrom = amt;
        amt = min;
      }
      if (max !== null && amt > max) {
        cappedFrom = amt;
        amt = max;
      }
    }
    lines.push({
      role: p.role,
      amountNaira: amt,
      isRemainder: false,
      cappedFrom,
      flooredFrom,
    });
  }
  const markup = lines.reduce((a, l) => a + l.amountNaira, 0);
  if (markup <= 0) {
    return {
      ok: false,
      issues: ["Markup is zero — parties' shares contribute nothing."],
    };
  }
  const bearer =
    lines.find((l) => l.role === remainderBearer) ?? lines[0];
  if (bearer) bearer.isRemainder = true;
  return {
    ok: true,
    wholesaleNaira,
    markupNaira: markup,
    memberPaysNaira: wholesaleNaira + markup,
    hmoLineNaira: wholesaleNaira,
    lines,
  };
}

function previewEnrollmentSplits(
  mode: MarkupMode,
  parties: PartyDraft[],
  remainderBearer: Role,
  enrollmentBeneficiary: Role,
  feeNaira: number,
): EnrollmentPreviewResult {
  if (feeNaira <= 0) return { ok: false, issues: ["No enrollment fee."] };

  // Markup modes: single-beneficiary kickback.
  if (mode === "MARKUP_FIXED" || mode === "MARKUP_FROM_SHARES") {
    return {
      ok: true,
      totalNaira: feeNaira,
      lines: [
        {
          role: enrollmentBeneficiary,
          amountNaira: feeNaira,
          isRemainder: true,
        },
      ],
    };
  }

  // Gross share: legacy split but skip caps.
  const eligible = parties.filter(
    (p) => p.timing === "BOTH" || p.timing === "ENROLLMENT_ONLY",
  );
  if (eligible.length === 0) {
    return {
      ok: false,
      issues: ["No parties configured for enrollment events."],
    };
  }
  return grossSharePreview(eligible, remainderBearer, feeNaira, true);
}

function grossSharePreview(
  eligible: PartyDraft[],
  remainderBearer: Role,
  totalNaira: number,
  skipCaps: boolean,
): EnrollmentPreviewResult {
  const lines: PreviewLine[] = [];
  let allocated = 0;

  for (const p of eligible.filter((x) => x.kind === "FLAT")) {
    const amt = Number(p.amountFlatNaira) || 0;
    lines.push({ role: p.role, amountNaira: amt, isRemainder: false });
    allocated += amt;
  }
  if (allocated > totalNaira) {
    return {
      ok: false,
      issues: [
        `Flat fees (₦${allocated.toLocaleString()}) exceed the event total ₦${totalNaira.toLocaleString()}.`,
      ],
    };
  }

  for (const p of eligible.filter((x) => x.kind === "PERCENTAGE")) {
    const pct = Number(p.amountPercent) || 0;
    const raw = (totalNaira * pct) / 100;
    let amt = raw;
    let cappedFrom: number | undefined;
    let flooredFrom: number | undefined;
    if (!skipCaps) {
      const min = p.minPerCycleNaira ? Number(p.minPerCycleNaira) : null;
      const max = p.maxPerCycleNaira ? Number(p.maxPerCycleNaira) : null;
      if (min !== null && amt < min) {
        flooredFrom = amt;
        amt = min;
      }
      if (max !== null && amt > max) {
        cappedFrom = amt;
        amt = max;
      }
    }
    lines.push({
      role: p.role,
      amountNaira: amt,
      isRemainder: false,
      cappedFrom,
      flooredFrom,
    });
    allocated += amt;
  }

  let bearer = lines.find((l) => l.role === remainderBearer);
  if (!bearer) {
    bearer = [...lines].sort((a, b) => b.amountNaira - a.amountNaira)[0];
  }
  const residue = totalNaira - allocated;
  if (bearer) {
    bearer.amountNaira += residue;
    bearer.isRemainder = true;
  }
  if (lines.some((l) => l.amountNaira < 0)) {
    return {
      ok: false,
      issues: ["Contract over-allocates — caps + flats exceed total."],
    };
  }
  return { ok: true, lines, totalNaira };
}

// ─────────────────────────────────────────────────────────────────────
// Preview tables
// ─────────────────────────────────────────────────────────────────────

function PremiumPreviewTable({
  result,
  mode,
}: {
  result: PremiumPreviewResult;
  mode: MarkupMode;
}) {
  if (!result.ok) {
    return (
      <p className="mt-2 text-[12px] text-[#a83232]">
        {result.issues.join(" ")}
      </p>
    );
  }
  return (
    <div className="mt-3">
      {mode !== "GROSS_SHARE" ? (
        <div className="grid grid-cols-3 gap-3 text-[11px] text-accent-ink/55 uppercase tracking-[0.1em] font-medium pb-2 border-b border-black/[0.06]">
          <Stat label="Wholesale" value={result.wholesaleNaira} />
          <Stat label="+ Markup" value={result.markupNaira} />
          <Stat
            label="= Member pays"
            value={result.memberPaysNaira}
            emphasis
          />
        </div>
      ) : null}

      <table className="mt-2 w-full text-[12px]">
        <tbody className="divide-y divide-black/[0.05]">
          {mode !== "GROSS_SHARE" ? (
            <tr className="bg-black/[0.02]">
              <td className="py-1.5 text-accent-ink/75">HMO</td>
              <td className="py-1.5 text-right font-mono text-accent-ink">
                ₦
                {result.hmoLineNaira.toLocaleString(undefined, {
                  maximumFractionDigits: 2,
                })}
              </td>
              <td className="py-1.5 pl-3">
                <Badge tone="muted">wholesale</Badge>
              </td>
            </tr>
          ) : null}
          {result.lines.map((l, i) => (
            <PreviewRow key={i} line={l} />
          ))}
          <tr className="border-t border-black/[0.1]">
            <td className="pt-2 text-accent-ink/55 text-[11px] uppercase tracking-[0.1em]">
              Total
            </td>
            <td className="pt-2 text-right font-mono font-medium text-accent-ink">
              ₦
              {(mode === "GROSS_SHARE"
                ? result.wholesaleNaira
                : result.memberPaysNaira
              ).toLocaleString()}
            </td>
            <td />
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function EnrollmentPreviewTable({
  result,
}: {
  result: EnrollmentPreviewResult;
}) {
  if (!result.ok) {
    return (
      <p className="mt-2 text-[12px] text-[#a83232]">
        {result.issues.join(" ")}
      </p>
    );
  }
  return (
    <table className="mt-2 w-full text-[12px]">
      <tbody className="divide-y divide-black/[0.05]">
        {result.lines.map((l, i) => (
          <PreviewRow key={i} line={l} />
        ))}
        <tr className="border-t border-black/[0.1]">
          <td className="pt-2 text-accent-ink/55 text-[11px] uppercase tracking-[0.1em]">
            Total
          </td>
          <td className="pt-2 text-right font-mono font-medium text-accent-ink">
            ₦{result.totalNaira.toLocaleString()}
          </td>
          <td />
        </tr>
      </tbody>
    </table>
  );
}

function PreviewRow({ line }: { line: PreviewLine }) {
  return (
    <tr>
      <td className="py-1.5 text-accent-ink/75">{line.role}</td>
      <td className="py-1.5 text-right font-mono text-accent-ink">
        ₦
        {line.amountNaira.toLocaleString(undefined, {
          maximumFractionDigits: 2,
        })}
      </td>
      <td className="py-1.5 pl-3 space-x-1.5">
        {line.cappedFrom !== undefined ? (
          <Badge tone="warn">
            capped from ₦{line.cappedFrom.toLocaleString(undefined, {
              maximumFractionDigits: 2,
            })}
          </Badge>
        ) : null}
        {line.flooredFrom !== undefined ? (
          <Badge tone="warn">
            floored up from ₦{line.flooredFrom.toLocaleString(undefined, {
              maximumFractionDigits: 2,
            })}
          </Badge>
        ) : null}
        {line.isRemainder ? <Badge tone="muted">remainder</Badge> : null}
      </td>
    </tr>
  );
}

function Stat({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: number;
  emphasis?: boolean;
}) {
  return (
    <div>
      <p>{label}</p>
      <p
        className={`mt-0.5 text-[14px] font-mono normal-case tracking-normal ${
          emphasis
            ? "text-accent-emerald font-medium"
            : "text-accent-ink"
        }`}
      >
        ₦{value.toLocaleString()}
      </p>
    </div>
  );
}

function Badge({
  tone,
  children,
}: {
  tone: "muted" | "warn";
  children: React.ReactNode;
}) {
  const cls =
    tone === "warn"
      ? "bg-[#fff4d4] text-[#7a4a00]"
      : "bg-black/[0.06] text-accent-ink/55";
  return (
    <span
      className={`inline-flex items-center text-[10px] uppercase tracking-[0.08em] font-medium px-1.5 py-0.5 rounded-full ${cls}`}
    >
      {children}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Common form atoms
// ─────────────────────────────────────────────────────────────────────

const inputCls =
  "rounded-md border border-black/[0.12] px-2 py-1 text-[12px] text-accent-ink placeholder:text-accent-ink/35 focus:outline-none focus:border-accent-emerald focus:ring-2 focus:ring-accent-teal-light";

const selectCls = inputCls;

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-[12px] font-medium text-accent-ink/75">
        {label}
        {required ? <span className="text-[#a83232]"> *</span> : null}
      </span>
      <div className="mt-1.5">{children}</div>
      {hint ? (
        <p className="mt-1 text-[11px] text-accent-ink/45">{hint}</p>
      ) : null}
    </label>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-[12px]">
      <span className="text-accent-ink/55">{label}</span>
      <span className="text-accent-ink">{value}</span>
    </div>
  );
}
