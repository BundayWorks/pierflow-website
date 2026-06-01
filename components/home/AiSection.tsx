import {
  Layers,
  ShieldCheck,
  ArrowUpDown,
  TrendingUp,
  Sparkles,
  ScrollText,
  type LucideIcon,
} from "lucide-react";
import SectionLabel from "@/components/shared/SectionLabel";
import AiScoreBadge from "@/components/shared/AiScoreBadge";
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
    <section className="bg-dark-bg border-t border-dark-muted">
      <div className="max-w-[1100px] mx-auto px-6 py-20">
        <div className="max-w-[640px]">
          <SectionLabel>AI-native infrastructure</SectionLabel>
          <h2 className="mt-4 text-[28px] md:text-[34px] font-medium leading-[1.2] text-white">
            The platform thinks.
          </h2>
          <p className="mt-4 text-[15px] leading-[1.7] text-textd-secondary">
            Every connection is powered by an intelligence layer that normalises,
            scores, and learns — invisibly, continuously, on every transaction.
          </p>
        </div>

        <div className="mt-10 bg-[#1a1a1a] rounded-lg overflow-hidden grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px">
          {AI_CELLS.map((cell) => {
            const Icon = ICONS[cell.icon] ?? Layers;
            return (
              <div key={cell.title} className="bg-dark-bg p-7">
                <div className="w-9 h-9 rounded-md bg-accent-green-dim flex items-center justify-center text-accent-green">
                  <Icon size={18} />
                </div>
                <h3 className="mt-4 text-[14px] font-medium text-white">
                  {cell.title}
                </h3>
                <p className="mt-2 text-[12px] leading-[1.65] text-[#666]">
                  {cell.body}
                </p>
                <div className="mt-4">
                  <AiScoreBadge label={cell.badge} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
