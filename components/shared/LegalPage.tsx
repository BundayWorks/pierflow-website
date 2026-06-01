import PageHeader from "./PageHeader";

type Props = {
  label: string;
  title: string;
  updated: string;
  body: { heading: string; text: string }[];
};

export default function LegalPage({ label, title, updated, body }: Props) {
  return (
    <>
      <PageHeader
        label={label}
        title={title}
        intro={`Last updated ${updated}`}
      />
      <section className="bg-white">
        <div className="max-w-content mx-auto px-6 py-20 space-y-8">
          {body.map((b) => (
            <div key={b.heading}>
              <h2 className="text-[20px] font-medium text-textl-primary">
                {b.heading}
              </h2>
              <p className="mt-3 text-[14px] leading-[1.8] text-textl-secondary">
                {b.text}
              </p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
