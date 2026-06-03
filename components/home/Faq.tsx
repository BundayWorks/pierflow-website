"use client";

import { useState } from "react";
import { Plus, Minus } from "lucide-react";

const FAQS = [
  {
    q: "What does Pierflow actually do?",
    a: "Pierflow is the connectivity layer for healthcare in Africa — one API across HMOs, hospitals, pharmacies, fintechs, HR platforms, and government programmes. We move coverage, records, payments, and referrals between every player in the ecosystem.",
  },
  {
    q: "Are you a health insurance company?",
    a: "No. Pierflow is infrastructure. We don't underwrite plans or take sides — we make every participant more capable, starting with extending HMO distribution into channels that didn't have it before.",
  },
  {
    q: "Why start with insurance distribution?",
    a: "It's the most acute, most visible, and most immediately solvable connectivity gap. Every HMO has products; every fintech, HR platform, and bank has users who need them. Pierflow connects the two — then expands into clinical records, payments, and referrals.",
  },
  {
    q: "What does 'AI-native' mean in practice?",
    a: "Every API response is scored at the boundary. Fraud, identity, lapse, eligibility, value — inline with the data, auditable, and explainable. The platform doesn't just move data, it understands it.",
  },
  {
    q: "How long does integration take?",
    a: "Under 48 hours from sandbox to first production transaction for a typical partner.",
  },
  {
    q: "Is the data FHIR-aligned?",
    a: "Yes. Every canonical resource is bidirectionally mapped to FHIR R4. You write one integration, regardless of how the underlying HMO or hospital structures its data.",
  },
  {
    q: "What is the Records API?",
    a: "It turns paper-based patient records — outpatient cards, lab slips, prescriptions, antenatal registers, immunisation cards, discharge summaries — into validated, FHIR R4-compliant bundles your EMR, HMS, or partner system can import in one call. Mobile capture for the MVP; scanner and MFP integrations on the roadmap. Low-confidence records are routed to human review before they ever reach your importer.",
  },
];

export default function Faq() {
  const [open, setOpen] = useState(0);

  return (
    <section className="px-2 md:px-4 py-4 md:py-6">
      <div className="mx-auto max-w-[1200px] rounded-[28px] bg-[#06251f] wave-bg overflow-hidden">
        <div className="grid lg:grid-cols-[1fr_1.4fr] gap-10 px-6 md:px-10 py-20">
          <div>
            <h2 className="font-display font-medium text-white text-[36px] md:text-[48px] leading-[1.05] tracking-[-0.02em]">
              Your questions,
              <br />
              answered
            </h2>
            <p className="mt-4 text-white/70 text-[15px]">
              Reach out if we didn&apos;t answer yours.
            </p>
            <div className="mt-8 relative h-[200px] hidden lg:block opacity-80">
              <svg viewBox="0 0 280 200" className="w-full h-full">
                <defs>
                  <linearGradient id="faqRing" x1="0%" x2="100%">
                    <stop offset="0%" stopColor="#7AE7C7" />
                    <stop offset="100%" stopColor="#0DCE9A" />
                  </linearGradient>
                </defs>
                {[40, 70, 100].map((r) => (
                  <circle
                    key={r}
                    cx="140"
                    cy="100"
                    r={r}
                    fill="none"
                    stroke="url(#faqRing)"
                    strokeOpacity="0.35"
                  />
                ))}
                <circle cx="140" cy="100" r="14" fill="#0DCE9A" />
              </svg>
            </div>
          </div>

          <div className="divide-y divide-white/10">
            {FAQS.map((f, i) => {
              const isOpen = i === open;
              return (
                <button
                  key={f.q}
                  onClick={() => setOpen(isOpen ? -1 : i)}
                  className="w-full text-left py-5 flex items-start gap-4 group"
                >
                  <span className="flex-1">
                    <span className="block text-white text-[16px] md:text-[17px] font-medium">
                      {f.q}
                    </span>
                    {isOpen && (
                      <span className="mt-3 block text-white/70 text-[14px] leading-[1.65] max-w-[640px]">
                        {f.a}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 mt-1 text-white/70 group-hover:text-white">
                    {isOpen ? <Minus size={18} /> : <Plus size={18} />}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
