const STATS = [
  { value: "7", accent: "+", label: "HMOs connected" },
  { value: "<48", accent: "h", label: "average integration time" },
  { value: "FHIR ", accent: "R4", label: "data standard" },
  { value: "99", accent: "%", label: "API uptime SLA" },
];

export default function StatsBar() {
  return (
    <section className="bg-white">
      <div className="max-w-[1100px] mx-auto px-6 py-16">
        <div className="rounded-lg border border-[#eaeaea] grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-[#eaeaea]">
          {STATS.map((s) => (
            <div key={s.label} className="p-6 text-center">
              <p className="text-[28px] font-medium text-textl-primary tracking-tight">
                {s.value}
                <span className="text-accent-teal">{s.accent}</span>
              </p>
              <p className="mt-1 text-[12px] text-textl-secondary">
                {s.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
