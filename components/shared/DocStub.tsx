type Props = {
  title: string;
  intro: string;
  sections?: { heading: string; body: string }[];
};

export default function DocStub({ title, intro, sections = [] }: Props) {
  return (
    <article>
      <h1 className="text-[34px] font-medium text-textl-primary leading-[1.2]">
        {title}
      </h1>
      <p className="mt-4 text-[15px] leading-[1.7] text-textl-secondary">
        {intro}
      </p>
      {sections.map((s) => (
        <section key={s.heading}>
          <h2 className="mt-10 text-[20px] font-medium text-textl-primary">
            {s.heading}
          </h2>
          <p className="mt-3 text-[14px] leading-[1.8] text-textl-secondary">
            {s.body}
          </p>
        </section>
      ))}
    </article>
  );
}
