import PageHeader from "./PageHeader";
import AiScoreBadge from "./AiScoreBadge";
import ContactBar from "./ContactBar";
import SectionLabel from "./SectionLabel";

type Props = {
  label: string;
  title: string;
  intro: string;
  aiField: string;
  capabilities: { title: string; body: string }[];
  outcomes: { metric: string; body: string }[];
};

export default function SolutionPage({
  label,
  title,
  intro,
  aiField,
  capabilities,
  outcomes,
}: Props) {
  return (
    <>
      <PageHeader label={label} title={title} intro={intro} />

      <section className="bg-white">
        <div className="max-w-[1100px] mx-auto px-6 py-20">
          <SectionLabel variant="light">Capabilities</SectionLabel>
          <h2 className="mt-4 text-[28px] md:text-[34px] font-medium text-textl-primary leading-[1.2]">
            What you can do.
          </h2>
          <div
            className="mt-10 grid gap-4"
            style={{
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            }}
          >
            {capabilities.map((c) => (
              <div
                key={c.title}
                className="border border-[#eaeaea] rounded-lg p-5"
              >
                <h3 className="text-[14px] font-medium text-textl-primary">
                  {c.title}
                </h3>
                <p className="mt-2 text-[13px] leading-[1.65] text-textl-secondary">
                  {c.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-bgl-alt">
        <div className="max-w-[1100px] mx-auto px-6 py-20">
          <SectionLabel variant="light">Outcomes</SectionLabel>
          <h2 className="mt-4 text-[28px] md:text-[34px] font-medium text-textl-primary leading-[1.2]">
            What partners get.
          </h2>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {outcomes.map((o) => (
              <div
                key={o.metric}
                className="bg-white border border-[#eaeaea] rounded-lg p-6"
              >
                <p className="text-[28px] font-medium text-accent-teal">
                  {o.metric}
                </p>
                <p className="mt-2 text-[13px] leading-[1.65] text-textl-secondary">
                  {o.body}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-10">
            <p className="text-[12px] font-medium tracking-[1px] uppercase text-textl-secondary mb-2">
              AI field returned
            </p>
            <AiScoreBadge label={aiField} variant="light" />
          </div>
        </div>
      </section>

      <ContactBar />
    </>
  );
}
