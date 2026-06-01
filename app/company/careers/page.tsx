import PageHeader from "@/components/shared/PageHeader";
import ContactBar from "@/components/shared/ContactBar";

const ROLES = [
  {
    title: "Founding backend engineer",
    type: "Full-time · Lagos / Remote",
    body: "Own the canonical data layer and the FHIR R4 mappings powering every HMO connection.",
  },
  {
    title: "Applied ML engineer",
    type: "Full-time · Lagos / Remote",
    body: "Build the scoring layer: fraud, lapse, identity, value. Production-grade, auditable AI.",
  },
  {
    title: "Partnerships, HMO ecosystem",
    type: "Full-time · Lagos",
    body: "Bring every HMO in Nigeria onto the network. Then take it across the continent.",
  },
];

export default function CareersPage() {
  return (
    <>
      <PageHeader
        label="Careers"
        title="Build the layer that moves health in Africa."
        intro="Small team, infrastructure-scale ambition. If you want to work on systems that compound across a continent, we should talk."
      />
      <section className="bg-white">
        <div className="max-w-[1100px] mx-auto px-6 py-20 grid gap-4 md:grid-cols-3">
          {ROLES.map((r) => (
            <div
              key={r.title}
              className="border border-[#eaeaea] rounded-lg p-6"
            >
              <p className="text-[11px] font-medium tracking-[1px] uppercase text-accent-teal">
                {r.type}
              </p>
              <h3 className="mt-2 text-[16px] font-medium text-textl-primary">
                {r.title}
              </h3>
              <p className="mt-2 text-[13px] leading-[1.65] text-textl-secondary">
                {r.body}
              </p>
              <a
                href="mailto:careers@pierflow.com"
                className="mt-4 inline-block text-[13px] text-accent-teal hover:underline"
              >
                Apply →
              </a>
            </div>
          ))}
        </div>
      </section>
      <ContactBar />
    </>
  );
}
