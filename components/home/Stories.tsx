import Link from "next/link";
import { ArrowRight } from "lucide-react";

const STORIES = [
  {
    partner: "Clearline HMO",
    title: "Clearline reaches members through every fintech in the network.",
    tag: "Distribution",
  },
  {
    partner: "SeamlessHR",
    title: "SeamlessHR enrolls distributed teams across multiple HMOs in one flow.",
    tag: "HR",
  },
  {
    partner: "Workpay",
    title: "Workpay activates health benefits as part of payroll.",
    tag: "Payroll",
  },
  {
    partner: "Reliance HMO",
    title: "Reliance pipes claims with AI scoring inline.",
    tag: "Claims",
  },
];

export default function Stories() {
  return (
    <section className="bg-bgl-alt">
      <div className="max-w-[1200px] mx-auto px-6 py-24">
        <div className="flex items-end justify-between gap-4">
          <h2 className="font-display font-medium text-[28px] md:text-[40px] leading-[1.1] tracking-[-0.02em] text-accent-ink">
            See what&apos;s possible with Pierflow
          </h2>
          <Link
            href="/company/blog"
            className="hidden md:inline-flex items-center gap-2 text-[14px] text-accent-emerald hover:underline"
          >
            All stories <ArrowRight size={14} />
          </Link>
        </div>

        <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {STORIES.map((s) => (
            <article
              key={s.partner}
              className="rounded-[18px] bg-white border border-black/[0.05] overflow-hidden flex flex-col"
            >
              <div className="aspect-[16/11] bg-gradient-to-br from-accent-emerald to-accent-deep relative">
                <div className="absolute inset-0 wave-bg opacity-40" />
                <div className="absolute bottom-3 left-3 right-3 rounded-md bg-white/95 px-3 py-2 flex items-center justify-between">
                  <span className="text-[11px] font-medium text-accent-ink">
                    {s.partner}
                  </span>
                  <span className="text-[10px] uppercase tracking-[0.12em] text-accent-emerald">
                    {s.tag}
                  </span>
                </div>
              </div>
              <div className="p-5 flex-1 flex flex-col">
                <p className="text-[14px] leading-[1.55] text-accent-ink">
                  {s.title}
                </p>
                <Link
                  href="/company/blog"
                  className="mt-4 inline-flex items-center gap-2 text-[13px] text-accent-emerald hover:underline"
                >
                  <span className="w-5 h-5 rounded-full border border-accent-emerald grid place-items-center">
                    <ArrowRight size={11} />
                  </span>
                  Read the story
                </Link>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
