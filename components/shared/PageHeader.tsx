type Props = {
  label: string;
  title: string;
  intro?: string;
};

export default function PageHeader({ label, title, intro }: Props) {
  return (
    <section className="px-2 md:px-4 pt-2">
      <div
        className="mx-auto max-w-[1200px] rounded-[28px] wave-bg overflow-hidden"
        style={{
          backgroundImage:
            "linear-gradient(135deg, #042520 0%, #063A33 25%, #0A7C6E 60%, #0DCE9A 90%, #7AE7C7 100%)",
        }}
      >
        <div className="px-6 md:px-10 pt-28 pb-24 md:pt-36 md:pb-32">
          <p className="text-[12px] uppercase tracking-[0.18em] text-white/70">
            {label}
          </p>
          <h1 className="mt-5 font-display font-medium text-[40px] md:text-[60px] leading-[1.05] tracking-[-0.02em] max-w-[860px]">
            <span className="text-white">{title}</span>
          </h1>
          {intro && (
            <p className="mt-6 text-[16px] md:text-[17px] leading-[1.55] text-white/80 max-w-[640px]">
              {intro}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
