import PageHeader from "@/components/shared/PageHeader";
import SectionLabel from "@/components/shared/SectionLabel";
import ContactBar from "@/components/shared/ContactBar";

const MANIFESTO = [
  "Health data is not the property of any system, any insurer, or any government. It belongs to the person it describes.",
  "Infrastructure is neutral. Pierflow does not take sides in the healthcare ecosystem. We make every player more capable.",
  "AI in healthcare should work invisibly — improving decisions, catching errors, and surfacing insight — without ever replacing the human judgment that health demands.",
  "Africa should not have to wait for the rest of the world to build this. We are building it here, for here, first.",
  "If a child in Maiduguri receives worse healthcare than a child in Lagos because her records cannot travel, we have not done our job.",
];

const VALUES = [
  {
    title: "Data sovereignty",
    body: "Members own their health data. Every transaction respects that, by design.",
  },
  {
    title: "Infrastructure neutrality",
    body: "We do not compete with the participants in the ecosystem. We make them stronger.",
  },
  {
    title: "Built for Africa",
    body: "Built here, by people who understand the constraints, ambitions, and realities of African healthcare.",
  },
  {
    title: "Radical transparency",
    body: "Every AI decision is logged and explainable. Every change is visible. No black boxes.",
  },
  {
    title: "Infrastructure thinking",
    body: "We optimise for durability, correctness, and reliability — not novelty.",
  },
  {
    title: "Urgency with care",
    body: "Health systems demand speed and discipline at the same time. We do both.",
  },
];

const TIMELINE = [
  {
    year: "2024",
    body: "Pierflow founded in Lagos to build the connectivity layer for health in Africa.",
  },
  {
    year: "2025",
    body: "First HMOs onboarded. AI-native data exchange in production.",
  },
  {
    year: "2026",
    body: "Public API access opens. Seven HMOs connected. Fintechs and HR platforms embedded.",
  },
  {
    year: "Next",
    body: "Cross-border health data exchange and pan-African expansion.",
  },
];

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

export default function CompanyPage() {
  return (
    <>
      <PageHeader
        label="Company"
        title="Building the connectivity layer for healthcare in Africa."
        intro="Pierflow is health data exchange infrastructure. We connect the systems, organisations, and data that healthcare in Africa depends on — starting where the friction is highest, building toward a continent where health data flows the way it should."
      />

      <section className="bg-white">
        <div className="max-w-content mx-auto px-6 py-20 space-y-6 text-[15px] leading-[1.8] text-textl-secondary">
          <p>
            Pierflow is not a health insurance company. We are the data exchange
            and connectivity infrastructure for healthcare in Africa — the layer
            that makes health data, financial flows, clinical records, and
            coverage move seamlessly between every player in the ecosystem.
          </p>
          <p>
            We built Pierflow AI-native from the start — not because AI is
            fashionable, but because health data is too complex and too variable
            for static rules to handle at scale. The intelligence layer is not
            something we added. It is how the platform was designed.
          </p>
          <p>
            We started with insurance distribution because it is the most
            acute, most visible, and most immediately solvable connectivity
            gap. Every HMO has products. Every fintech, HR platform, bank, and
            cooperative has users who need them — and the infrastructure
            between them doesn&apos;t exist. We are building it, then
            expanding the same connectivity layer into clinical records,
            payments, referrals, and provider exchange.
          </p>
          <p>
            The Records API is the second pillar. Most digital health systems
            in Africa go live empty because decades of patient history sit on
            paper in cabinets. We turn that paper into validated FHIR R4 data
            so EMR and HMS partners can activate hospital clients on day one
            — and every patient whose record passes through Pierflow is
            naturally onboarded into the broader connectivity layer.
          </p>
          <p>
            And we are building it here, for here — by a team that understands
            what it means to navigate healthcare in Nigeria, with the global
            ambition to make every lesson learned here work across the continent.
          </p>
        </div>
      </section>

      <section id="manifesto" className="bg-dark-bg border-y border-dark-muted">
        <div className="max-w-content mx-auto px-6 py-20">
          <SectionLabel>Manifesto</SectionLabel>
          <h2 className="mt-4 text-[28px] md:text-[34px] font-medium leading-[1.2] text-white">
            What we believe.
          </h2>
          <ol className="mt-10 space-y-8 max-w-[760px]">
            {MANIFESTO.map((line, i) => (
              <li
                key={i}
                className="grid grid-cols-[44px_1fr] items-baseline gap-x-4"
              >
                <span className="font-mono text-[12px] text-accent-green leading-[1.6]">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <p className="text-[16px] md:text-[17px] leading-[1.6] text-textd-tealish">
                  {line}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="values" className="bg-bgl-alt">
        <div className="max-w-[1100px] mx-auto px-6 py-20">
          <SectionLabel variant="light">Values</SectionLabel>
          <h2 className="mt-4 text-[28px] md:text-[34px] font-medium leading-[1.2] text-textl-primary">
            How we work.
          </h2>
          <div
            className="mt-10 grid gap-4"
            style={{
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            }}
          >
            {VALUES.map((v) => (
              <div
                key={v.title}
                className="bg-white border border-[#eaeaea] rounded-lg p-5"
              >
                <h3 className="text-[14px] font-medium text-textl-primary">
                  {v.title}
                </h3>
                <p className="mt-2 text-[13px] leading-[1.65] text-textl-secondary">
                  {v.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="story" className="bg-white">
        <div className="max-w-content mx-auto px-6 py-20">
          <SectionLabel variant="light">Story</SectionLabel>
          <h2 className="mt-4 text-[28px] md:text-[34px] font-medium leading-[1.2] text-textl-primary">
            The shortest path to a connected continent.
          </h2>
          <ul className="mt-10 space-y-6">
            {TIMELINE.map((t) => (
              <li key={t.year} className="flex gap-8">
                <span className="font-mono text-[12px] text-accent-teal w-16 pt-1">
                  {t.year}
                </span>
                <p className="text-[15px] leading-[1.7] text-textl-secondary">
                  {t.body}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="careers" className="bg-bgl-alt">
        <div className="max-w-[1100px] mx-auto px-6 py-20">
          <SectionLabel variant="light">Careers</SectionLabel>
          <h2 className="mt-4 text-[28px] md:text-[34px] font-medium leading-[1.2] text-textl-primary">
            Build the layer that moves health in Africa.
          </h2>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {ROLES.map((r) => (
              <div
                key={r.title}
                className="bg-white border border-[#eaeaea] rounded-lg p-5"
              >
                <p className="text-[11px] font-medium tracking-[1px] uppercase text-accent-teal">
                  {r.type}
                </p>
                <h3 className="mt-2 text-[15px] font-medium text-textl-primary">
                  {r.title}
                </h3>
                <p className="mt-2 text-[13px] leading-[1.65] text-textl-secondary">
                  {r.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <ContactBar />
    </>
  );
}
