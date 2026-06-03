import Link from "next/link";
import {
  Smartphone,
  Building2,
  HeartPulse,
  Hospital,
  Globe,
  Users,
  Database,
  ArrowUpRight,
  type LucideIcon,
} from "lucide-react";
import SectionLabel from "@/components/shared/SectionLabel";
import AiScoreBadge from "@/components/shared/AiScoreBadge";
import { SOLUTIONS } from "@/lib/constants";

const ICONS: Record<string, LucideIcon> = {
  Smartphone,
  Building2,
  HeartPulse,
  Hospital,
  Globe,
  Users,
  Database,
};

export default function SolutionsGrid() {
  return (
    <section className="bg-bgl-alt">
      <div className="max-w-[1100px] mx-auto px-6 py-20">
        <div className="max-w-[640px]">
          <SectionLabel variant="light">Who we work with</SectionLabel>
          <h2 className="mt-4 text-[28px] md:text-[34px] font-medium leading-[1.2] text-textl-primary">
            If health data needs to move, we build the pipe.
          </h2>
          <p className="mt-4 text-[15px] leading-[1.7] text-textl-secondary">
            HMOs, hospitals, pharmacies, fintechs, governments — every
            organisation in healthcare has data that needs to connect to
            something else. Pierflow is the layer between them, starting with
            extending HMO products into new distribution channels.
          </p>
        </div>

        <div
          className="mt-10 grid gap-4"
          style={{
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          }}
        >
          {SOLUTIONS.map((s) => {
            const Icon = ICONS[s.icon] ?? Smartphone;
            return (
              <Link
                key={s.slug}
                href={`/solutions/${s.slug}`}
                className="group bg-white rounded-lg p-5 border border-[#eaeaea] hover:border-[#bbb] transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="w-9 h-9 rounded-md bg-accent-teal-light flex items-center justify-center text-accent-teal">
                    <Icon size={18} />
                  </div>
                  <ArrowUpRight
                    size={16}
                    className="text-[#bbb] group-hover:text-textl-primary"
                  />
                </div>
                <h3 className="mt-4 text-[14px] font-medium text-textl-primary">
                  {s.title}
                </h3>
                <p className="mt-1.5 text-[12px] leading-[1.55] text-textl-secondary">
                  {s.sub}
                </p>
                <div className="mt-3">
                  <AiScoreBadge label={s.aiField} variant="light" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
