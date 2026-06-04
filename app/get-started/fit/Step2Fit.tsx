"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ArrowLeft } from "lucide-react";
import Progress from "@/components/onboarding/Progress";
import {
  AUDIENCE_OPTIONS,
  useCasesFor as getUseCasesFor,
  VOLUME_OPTIONS,
  TIMELINE_OPTIONS,
  SESSION_STORAGE_KEY,
  type OnboardingDraft,
} from "@/lib/onboarding";
import type { PartnerType } from "@prisma/client";

export default function Step2Fit() {
  const router = useRouter();
  const [hydrated, setHydrated] = useState(false);
  const [partnerType, setPartnerType] = useState<PartnerType | null>(null);
  const [primaryUseCase, setPrimaryUseCase] = useState("");
  const [expectedVolume, setExpectedVolume] = useState("");
  const [timeline, setTimeline] = useState("");

  // Hydrate from sessionStorage; bounce to Step 1 if no audience picked.
  useEffect(() => {
    let draft: Partial<OnboardingDraft> = {};
    try {
      const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (raw) draft = JSON.parse(raw);
    } catch {}
    if (!draft.partnerType) {
      router.replace("/get-started");
      return;
    }
    setPartnerType(draft.partnerType);
    setPrimaryUseCase(draft.primaryUseCase ?? "");
    setExpectedVolume(draft.expectedVolume ?? "");
    setTimeline(draft.timeline ?? "");
    setHydrated(true);
  }, [router]);

  const useCases = useMemo(
    () => (partnerType ? getUseCasesFor(partnerType) : []),
    [partnerType],
  );

  const audienceLabel = useMemo(
    () =>
      AUDIENCE_OPTIONS.find((o) => o.type === partnerType)?.label ?? null,
    [partnerType],
  );

  if (!hydrated) return null;

  const isValid = Boolean(primaryUseCase && expectedVolume && timeline);

  function handleContinue() {
    if (!isValid || !partnerType) return;
    const draft: OnboardingDraft = {
      partnerType,
      primaryUseCase,
      expectedVolume,
      timeline,
    };
    try {
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(draft));
    } catch {}
    router.push("/get-started/account");
  }

  return (
    <div>
      <Progress step={2} labels={["You", "Fit", "Account"]} />
      <h1 className="font-display text-[36px] md:text-[44px] leading-[1.05] tracking-[-0.02em] text-accent-ink font-medium">
        Tell us about your project.
      </h1>
      <p className="mt-4 text-[15px] leading-[1.7] text-accent-ink/65">
        We&apos;ll point you at the right docs and pre-populate sandbox data
        that matches your use case.
        {audienceLabel ? (
          <>
            {" "}
            Continuing as{" "}
            <strong className="text-accent-ink">{audienceLabel}</strong>.
          </>
        ) : null}
      </p>

      <div className="mt-10 space-y-6">
        <Field label="What are you primarily trying to do?">
          <select
            value={primaryUseCase}
            onChange={(e) => setPrimaryUseCase(e.target.value)}
            className="w-full text-[14px] rounded-md border border-black/[0.12] bg-white px-3 py-2.5 focus:outline-none focus:border-accent-emerald/60"
          >
            <option value="">Select an option</option>
            {useCases.map((uc) => (
              <option key={uc} value={uc}>
                {uc}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Expected monthly volume">
          <div className="grid grid-cols-2 gap-2">
            {VOLUME_OPTIONS.map((v) => (
              <Pill
                key={v}
                value={v}
                selected={expectedVolume === v}
                onClick={() => setExpectedVolume(v)}
              />
            ))}
          </div>
        </Field>

        <Field label="When are you looking to be live?">
          <div className="grid grid-cols-2 gap-2">
            {TIMELINE_OPTIONS.map((t) => (
              <Pill
                key={t}
                value={t}
                selected={timeline === t}
                onClick={() => setTimeline(t)}
              />
            ))}
          </div>
        </Field>
      </div>

      <div className="mt-10 flex justify-between">
        <button
          type="button"
          onClick={() => router.back()}
          className="text-[13px] font-medium px-4 py-2.5 rounded-md text-accent-ink/65 hover:text-accent-ink inline-flex items-center gap-2"
        >
          <ArrowLeft size={14} />
          Back
        </button>
        <button
          type="button"
          disabled={!isValid}
          onClick={handleContinue}
          className="text-[13px] font-medium px-5 py-2.5 rounded-md bg-accent-ink text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-2"
        >
          Continue
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-[13px] font-medium text-accent-ink mb-2">{label}</p>
      {children}
    </div>
  );
}

function Pill({
  value,
  selected,
  onClick,
}: {
  value: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-[13px] text-left px-3 py-2.5 rounded-md border transition-colors ${
        selected
          ? "border-accent-emerald bg-card-mint text-accent-ink font-medium"
          : "border-black/[0.1] bg-white text-accent-ink/75 hover:border-black/25 hover:text-accent-ink"
      }`}
    >
      {value}
    </button>
  );
}
