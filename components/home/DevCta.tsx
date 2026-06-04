import Link from "next/link";
import { Terminal } from "lucide-react";
import SectionLabel from "@/components/shared/SectionLabel";

export default function DevCta() {
  return (
    <section className="bg-dark-bg border-t border-dark-muted">
      <div className="max-w-[1100px] mx-auto px-6 py-20 grid lg:grid-cols-2 gap-10 items-center">
        <div>
          <SectionLabel>For developers</SectionLabel>
          <h2 className="mt-4 text-[28px] md:text-[30px] font-medium text-white leading-[1.2]">
            Build on the health data layer.
          </h2>
          <p className="mt-4 text-[14px] leading-[1.7] text-[#666] max-w-[480px]">
            The API is AI-native. Every endpoint returns data that has been
            validated, normalised, and scored. Not raw data from a system you
            need to clean yourself.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/docs/quickstart/introduction"
              className="text-[13px] font-medium px-4 py-2.5 rounded-md bg-accent-green text-dark-bg hover:opacity-90"
            >
              Quick start →
            </Link>
            <Link
              href="/get-started"
              className="text-[13px] font-medium px-4 py-2.5 rounded-md border border-white/20 text-white hover:bg-white/5"
            >
              Try sandbox
            </Link>
          </div>
        </div>

        <div className="rounded-lg overflow-hidden border border-dark-border bg-dark-surface">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-dark-border bg-[#0d0d0d]">
            <div className="flex items-center gap-2 text-textd-muted">
              <Terminal size={13} />
              <span className="text-[11px] font-mono">pierflow-node</span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-sm bg-accent-green-dim text-accent-green">
              v1.0
            </span>
          </div>
          <pre className="p-5 text-[12px] leading-[1.7] font-mono overflow-x-auto text-white">
            <code>
              <span className="text-[#C586C0]">import</span>{" "}
              <span className="text-[#7EC8E3]">Pierflow</span>{" "}
              <span className="text-[#C586C0]">from</span>{" "}
              <span className="text-[#A8DDD8]">&apos;@pierflow/node&apos;</span>
              ;{"\n\n"}
              <span className="text-[#C586C0]">const</span>{" "}
              <span className="text-[#7EC8E3]">pf</span> ={" "}
              <span className="text-[#C586C0]">new</span>{" "}
              <span className="text-accent-green">Pierflow</span>({"{ "}
              <span className="text-[#7EC8E3]">apiKey</span>:{" "}
              <span className="text-[#A8DDD8]">process.env.PIERFLOW_KEY</span>
              {" });"}
              {"\n\n"}
              <span className="text-[#C586C0]">const</span> quote ={" "}
              <span className="text-[#C586C0]">await</span> pf.quotes.
              <span className="text-accent-green">create</span>({"{\n  "}
              <span className="text-[#7EC8E3]">budget_ngn</span>:{" "}
              <span className="text-[#F5A623]">120000</span>,{"\n  "}
              <span className="text-[#7EC8E3]">audience</span>:{" "}
              <span className="text-[#A8DDD8]">&apos;individual&apos;</span>
              {"\n});"}
              {"\n\n"}
              <span className="text-[#444]">
                {"// → { plans: [...], value_score, plan_match_score }"}
              </span>
            </code>
          </pre>
        </div>
      </div>
    </section>
  );
}
