import PageHeader from "./PageHeader";
import ContactBar from "./ContactBar";
import SectionLabel from "./SectionLabel";

type Props = {
  label: string;
  title: string;
  intro: string;
  features: { title: string; body: string }[];
};

export default function ModulePage({ label, title, intro, features }: Props) {
  return (
    <>
      <PageHeader label={label} title={title} intro={intro} />
      <section className="bg-white">
        <div className="max-w-[1100px] mx-auto px-6 py-20">
          <SectionLabel variant="light">What it does</SectionLabel>
          <div
            className="mt-8 grid gap-4"
            style={{
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            }}
          >
            {features.map((f) => (
              <div
                key={f.title}
                className="border border-[#eaeaea] rounded-lg p-5"
              >
                <h3 className="text-[14px] font-medium text-textl-primary">
                  {f.title}
                </h3>
                <p className="mt-2 text-[13px] leading-[1.65] text-textl-secondary">
                  {f.body}
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
