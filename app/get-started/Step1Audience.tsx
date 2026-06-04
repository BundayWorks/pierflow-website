"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check } from "lucide-react";
import Progress from "@/components/onboarding/Progress";
import {
  type AudienceOption,
  type OnboardingDraft,
  SESSION_STORAGE_KEY,
} from "@/lib/onboarding";

export default function Step1Audience({
  options,
}: {
  options: AudienceOption[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);

  // Restore previous selection if the user navigated back.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw) as Partial<OnboardingDraft>;
      if (draft.partnerType) setSelected(draft.partnerType);
    } catch {}
  }, []);

  function handleContinue() {
    if (!selected) return;
    const existing = readDraft();
    writeDraft({ ...existing, partnerType: selected as OnboardingDraft["partnerType"] });
    router.push("/get-started/fit");
  }

  return (
    <div>
      <Progress step={1} labels={["You", "Fit", "Account"]} />
      <h1 className="font-display text-[36px] md:text-[44px] leading-[1.05] tracking-[-0.02em] text-accent-ink font-medium">
        What kind of organisation are you?
      </h1>
      <p className="mt-4 text-[15px] leading-[1.7] text-accent-ink/65">
        Tells us how to tailor the API surface and onboarding so the right
        endpoints, docs, and examples are front-and-centre.
      </p>

      <div className="mt-8 space-y-3">
        {options.map((opt) => {
          const isSelected = selected === opt.type;
          return (
            <button
              key={opt.type}
              type="button"
              onClick={() => setSelected(opt.type)}
              className={`w-full text-left rounded-xl border p-5 transition-colors ${
                isSelected
                  ? "border-accent-emerald bg-card-mint"
                  : "border-black/[0.08] hover:border-black/25 bg-white"
              }`}
            >
              <div className="flex items-start gap-4">
                <span
                  className={`mt-0.5 w-5 h-5 rounded-full grid place-items-center shrink-0 transition-colors ${
                    isSelected
                      ? "bg-accent-emerald text-white"
                      : "border border-black/15"
                  }`}
                >
                  {isSelected ? <Check size={12} /> : null}
                </span>
                <div className="flex-1">
                  <p className="text-[15px] font-medium text-accent-ink">
                    {opt.label}
                  </p>
                  <p className="mt-1 text-[13px] leading-[1.6] text-accent-ink/65">
                    {opt.description}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-10 flex justify-end">
        <button
          type="button"
          disabled={!selected}
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

function readDraft(): Partial<OnboardingDraft> {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Partial<OnboardingDraft>) : {};
  } catch {
    return {};
  }
}

function writeDraft(d: Partial<OnboardingDraft>) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(d));
  } catch {}
}
