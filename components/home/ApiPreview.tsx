"use client";

import { useState } from "react";

type Tab = "enrollment" | "plans" | "claims";

const TAB_SAMPLES: Record<Tab, React.ReactNode> = {
  enrollment: (
    <code>
      <span className="text-accent-green">POST</span>{" "}
      <span className="text-white">/v1/enrollments</span>
      {"\n\n{\n  "}
      <span className="text-[#7EC8E3]">&quot;hmo_id&quot;</span>:{" "}
      <span className="text-[#A8DDD8]">&quot;hmo_clearline&quot;</span>,{"\n  "}
      <span className="text-[#7EC8E3]">&quot;plan_id&quot;</span>:{" "}
      <span className="text-[#A8DDD8]">&quot;plan_basic_ind&quot;</span>,{"\n  "}
      <span className="text-[#7EC8E3]">&quot;member&quot;</span>: {"{\n    "}
      <span className="text-[#7EC8E3]">&quot;bvn&quot;</span>:{" "}
      <span className="text-[#A8DDD8]">&quot;22********1&quot;</span>,{"\n    "}
      <span className="text-[#7EC8E3]">&quot;first_name&quot;</span>:{" "}
      <span className="text-[#A8DDD8]">&quot;Amaka&quot;</span>,{"\n    "}
      <span className="text-[#7EC8E3]">&quot;last_name&quot;</span>:{" "}
      <span className="text-[#A8DDD8]">&quot;Okeke&quot;</span>
      {"\n  }\n}"}
      {"\n\n"}
      <span className="text-[#444]">{"// → 201 Created"}</span>
      {"\n{\n  "}
      <span className="text-[#7EC8E3]">&quot;policy_id&quot;</span>:{" "}
      <span className="text-[#A8DDD8]">&quot;pol_01HX...&quot;</span>,{"\n  "}
      <span className="text-[#7EC8E3]">&quot;fraud_score&quot;</span>:{" "}
      <span className="text-[#F5A623]">4</span>,{" "}
      <span className="text-accent-green">{"// AI"}</span>
      {"\n  "}
      <span className="text-[#7EC8E3]">&quot;identity_confidence&quot;</span>:{" "}
      <span className="text-[#F5A623]">0.97</span>,{" "}
      <span className="text-accent-green">{"// AI"}</span>
      {"\n  "}
      <span className="text-[#7EC8E3]">&quot;effective_date&quot;</span>:{" "}
      <span className="text-[#A8DDD8]">&quot;2026-06-01&quot;</span>
      {"\n}"}
    </code>
  ),
  plans: (
    <code>
      <span className="text-accent-green">GET</span>{" "}
      <span className="text-white">/v1/plans?budget=120000</span>
      {"\n\n"}
      <span className="text-[#444]">{"// → 200 OK · sorted by value_score"}</span>
      {"\n[\n  {\n    "}
      <span className="text-[#7EC8E3]">&quot;plan_id&quot;</span>:{" "}
      <span className="text-[#A8DDD8]">&quot;plan_clearline_silver&quot;</span>,
      {"\n    "}
      <span className="text-[#7EC8E3]">&quot;hmo&quot;</span>:{" "}
      <span className="text-[#A8DDD8]">&quot;Clearline HMO&quot;</span>,
      {"\n    "}
      <span className="text-[#7EC8E3]">&quot;premium_ngn&quot;</span>:{" "}
      <span className="text-[#F5A623]">118000</span>,{"\n    "}
      <span className="text-[#7EC8E3]">&quot;value_score&quot;</span>:{" "}
      <span className="text-[#F5A623]">88</span>,{" "}
      <span className="text-accent-green">{"// AI"}</span>
      {"\n  }\n]"}
    </code>
  ),
  claims: (
    <code>
      <span className="text-accent-green">POST</span>{" "}
      <span className="text-white">/v1/claims</span>
      {"\n\n{\n  "}
      <span className="text-[#7EC8E3]">&quot;policy_id&quot;</span>:{" "}
      <span className="text-[#A8DDD8]">&quot;pol_01HX...&quot;</span>,{"\n  "}
      <span className="text-[#7EC8E3]">&quot;provider_id&quot;</span>:{" "}
      <span className="text-[#A8DDD8]">&quot;prv_lagoon_hospital&quot;</span>,
      {"\n  "}
      <span className="text-[#7EC8E3]">&quot;amount_ngn&quot;</span>:{" "}
      <span className="text-[#F5A623]">45000</span>
      {"\n}"}
      {"\n\n"}
      <span className="text-[#444]">{"// → 202 Accepted"}</span>
      {"\n{\n  "}
      <span className="text-[#7EC8E3]">&quot;claim_id&quot;</span>:{" "}
      <span className="text-[#A8DDD8]">&quot;clm_01HX...&quot;</span>,{"\n  "}
      <span className="text-[#7EC8E3]">&quot;fraud_score&quot;</span>:{" "}
      <span className="text-[#F5A623]">12</span>,{" "}
      <span className="text-accent-green">{"// AI"}</span>
      {"\n  "}
      <span className="text-[#7EC8E3]">&quot;eligibility_confidence&quot;</span>
      : <span className="text-[#F5A623]">0.99</span>,{" "}
      <span className="text-accent-green">{"// AI"}</span>
      {"\n}"}
    </code>
  ),
};

const FEATURES = [
  {
    title: "Multi-HMO, one call",
    body: "One canonical API across every connected HMO. No bespoke integrations.",
  },
  {
    title: "AI scores in every response",
    body: "Fraud, identity, lapse, and value scores returned inline with the data.",
  },
  {
    title: "FHIR R4 canonical",
    body: "Universal Health Schema mapped to FHIR R4. Standards-aligned from day one.",
  },
  {
    title: "Idempotent by default",
    body: "Safe retries on every write. Built for collection and clinical workflows.",
  },
];

export default function ApiPreview() {
  const [tab, setTab] = useState<Tab>("enrollment");

  return (
    <div className="grid lg:grid-cols-2 gap-8 items-start">
      <div className="rounded-lg overflow-hidden border border-dark-border bg-dark-surface">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-dark-border bg-[#0d0d0d]">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-[#ff5f57]" />
            <span className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
            <span className="w-3 h-3 rounded-full bg-[#28c940]" />
          </div>
          <div className="flex items-center gap-4">
            {(["enrollment", "plans", "claims"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`text-[11px] font-mono uppercase tracking-wider transition-colors ${
                  tab === t
                    ? "text-accent-green"
                    : "text-textd-muted hover:text-textd-secondary"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <pre className="p-5 text-[12px] leading-[1.7] font-mono overflow-x-auto text-white">
          {TAB_SAMPLES[tab]}
        </pre>
      </div>

      <div className="grid gap-5">
        {FEATURES.map((f) => (
          <div key={f.title} className="border-l-2 border-accent-green pl-4">
            <h3 className="text-[14px] font-medium text-white">{f.title}</h3>
            <p className="mt-1.5 text-[13px] leading-[1.6] text-textd-secondary">
              {f.body}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
