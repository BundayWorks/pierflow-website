import PageHeader from "@/components/shared/PageHeader";

const SERVICES = [
  { name: "API · Production", state: "Operational" },
  { name: "API · Sandbox", state: "Operational" },
  { name: "Webhooks", state: "Operational" },
  { name: "Developer portal", state: "Operational" },
  { name: "AI scoring layer", state: "Operational" },
];

export default function StatusPage() {
  return (
    <>
      <PageHeader
        label="Status"
        title="All systems operational."
        intro="Live status of every Pierflow surface. Historical incidents are recorded for transparency."
      />
      <section className="bg-white">
        <div className="max-w-content mx-auto px-6 py-20">
          <ul className="rounded-lg border border-[#eaeaea] divide-y divide-[#eaeaea]">
            {SERVICES.map((s) => (
              <li
                key={s.name}
                className="flex items-center justify-between px-5 py-4"
              >
                <span className="text-[14px] text-textl-primary">
                  {s.name}
                </span>
                <span className="inline-flex items-center gap-2 text-[12px] text-accent-teal">
                  <span className="w-2 h-2 rounded-full bg-accent-teal" />
                  {s.state}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
