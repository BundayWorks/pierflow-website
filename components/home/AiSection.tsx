import {
  Layers,
  ShieldCheck,
  ArrowUpDown,
  TrendingUp,
  Sparkles,
  ScrollText,
  type LucideIcon,
} from "lucide-react";
import { AI_CELLS } from "@/lib/constants";

const ICONS: Record<string, LucideIcon> = {
  Layers,
  ShieldCheck,
  ArrowUpDown,
  TrendingUp,
  Sparkles,
  ScrollText,
};

export default function AiSection() {
  return (
    <section className="bg-white">
      <div className="max-w-[1200px] mx-auto px-6 py-24">
        <div className="max-w-[820px]">
          <p className="text-[12px] uppercase tracking-[0.16em] text-accent-emerald">
            AI-native infrastructure
          </p>
          <h2 className="mt-3 font-display font-medium text-[32px] md:text-[48px] leading-[1.05] tracking-[-0.02em] text-accent-ink">
            The platform thinks.
          </h2>
          <p className="mt-5 text-[16px] leading-[1.65] text-accent-ink/65 max-w-[640px]">
            Every connection is powered by an intelligence layer that
            normalises, scores, and learns — invisibly, continuously, on every
            transaction.
          </p>
        </div>

        <div className="mt-12 grid lg:grid-cols-[1fr_1.4fr] gap-6">
          {/* Hero panel: live score card */}
          <div
            className="relative overflow-hidden rounded-[24px] p-8 flex flex-col justify-between min-h-[440px]"
            style={{
              backgroundImage:
                "linear-gradient(135deg, #042520 0%, #063A33 35%, #0A7C6E 100%)",
            }}
          >
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-accent-mint">
                Inline on every response
              </p>
              <h3 className="mt-3 font-display text-[26px] md:text-[30px] leading-[1.15] text-white font-medium max-w-[280px]">
                Scored at the boundary. Auditable end-to-end.
              </h3>
            </div>

            <div className="rounded-2xl bg-white/95 backdrop-blur p-5">
              <div className="flex items-center justify-between">
                <p className="text-[11px] uppercase tracking-[0.18em] text-accent-emerald">
                  Pierflow score
                </p>
                <span className="text-[10px] font-mono text-accent-emerald bg-accent-teal-light px-2 py-0.5 rounded-full">
                  live
                </span>
              </div>
              <div className="mt-3 flex items-end gap-3">
                <p className="font-display text-[56px] leading-none text-accent-ink font-medium">
                  92
                </p>
                <p className="text-[12px] text-accent-ink/55 pb-2">out of 99</p>
              </div>
              <div className="mt-4 space-y-2">
                {[
                  ["fraud_score", "4 / 100"],
                  ["identity_confidence", "0.97"],
                  ["lapse_risk_score", "0.12"],
                ].map(([k, v]) => (
                  <div
                    key={k}
                    className="flex items-center justify-between text-[12px] font-mono"
                  >
                    <span className="text-accent-ink/55">{k}</span>
                    <span className="text-accent-emerald">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Capabilities list */}
          <ul className="divide-y divide-black/[0.06] rounded-[24px] border border-black/[0.06] bg-bgl-alt">
            {AI_CELLS.map((cell) => {
              const Icon = ICONS[cell.icon] ?? Layers;
              return (
                <li key={cell.title} className="flex items-start gap-5 p-6">
                  <span className="shrink-0 w-11 h-11 rounded-xl bg-accent-teal-light flex items-center justify-center text-accent-emerald">
                    <Icon size={20} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-4 flex-wrap">
                      <h3 className="text-[16px] font-medium text-accent-ink">
                        {cell.title}
                      </h3>
                      <span className="inline-block font-mono text-[10px] px-2 py-1 rounded-full bg-accent-teal-light text-accent-emerald">
                        {cell.badge}
                      </span>
                    </div>
                    <p className="mt-1.5 text-[13px] leading-[1.6] text-accent-ink/65">
                      {cell.body}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
