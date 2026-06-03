import Link from "next/link";
import { ArrowRight } from "lucide-react";

const USE_CASES = [
  {
    tag: "Distribution",
    title: "Sell HMO plans inside a fintech, payroll, or super-app.",
    body: "One canonical API to discover, quote, enroll, and renew. Collections and reconciliation handled.",
    href: "/solutions/fintechs",
  },
  {
    tag: "Verification",
    title: "Verify coverage in milliseconds at point of care.",
    body: "Hit /v1/verifications with a policy_id and get coverage state, network status, and eligibility_confidence inline.",
    href: "/docs/verification",
  },
  {
    tag: "Group benefits",
    title: "Onboard distributed teams across multiple HMOs.",
    body: "Bulk enrollment, dependent management, and renewals — driven by lapse_risk_score so coverage stays active.",
    href: "/solutions/hr-platforms",
  },
  {
    tag: "Records API",
    title: "Turn paper records into FHIR bundles your EMR can import.",
    body: "Capture pages on a phone, get FHIR R4 Patient + Encounter + Observation bundles, reviewed and validated, in your next import package.",
    href: "/docs/records/overview",
  },
];

export default function Stories() {
  return (
    <section className="bg-bgl-alt">
      <div className="max-w-[1200px] mx-auto px-6 py-24">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <p className="text-[12px] uppercase tracking-[0.16em] text-accent-emerald">
              What you can build
            </p>
            <h2 className="mt-3 font-display font-medium text-[28px] md:text-[40px] leading-[1.1] tracking-[-0.02em] text-accent-ink max-w-[640px]">
              Four shapes of work, one connectivity layer.
            </h2>
          </div>
          <Link
            href="/solutions"
            className="hidden md:inline-flex items-center gap-2 text-[14px] text-accent-emerald hover:underline"
          >
            All solutions <ArrowRight size={14} />
          </Link>
        </div>

        <div className="mt-10 grid sm:grid-cols-2 gap-5">
          {USE_CASES.map((u) => (
            <Link
              key={u.title}
              href={u.href}
              className="group rounded-[20px] bg-white border border-black/[0.05] p-7 md:p-8 flex flex-col gap-5 hover:border-black/15 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <span className="text-[11px] uppercase tracking-[0.16em] text-accent-emerald">
                  {u.tag}
                </span>
                <span className="shrink-0 w-9 h-9 rounded-full bg-accent-ink text-white grid place-items-center group-hover:scale-105 transition-transform">
                  <ArrowRight size={15} />
                </span>
              </div>
              <h3 className="font-display text-[20px] md:text-[22px] leading-[1.25] tracking-[-0.01em] text-accent-ink font-medium">
                {u.title}
              </h3>
              <p className="text-[14px] leading-[1.6] text-accent-ink/65">
                {u.body}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
