import PageHeader from "@/components/shared/PageHeader";
import ContactBar from "@/components/shared/ContactBar";

const MANIFESTO = [
  "Health data is not the property of any system, any insurer, or any government. It belongs to the person it describes.",
  "Infrastructure is neutral. Pierflow does not take sides in the healthcare ecosystem. We make every player more capable.",
  "AI in healthcare should work invisibly — improving decisions, catching errors, and surfacing insight — without ever replacing the human judgment that health demands.",
  "Africa should not have to wait for the rest of the world to build this. We are building it here, for here, first.",
  "If a child in Maiduguri receives worse healthcare than a child in Lagos because her records cannot travel, we have not done our job.",
];

export default function ManifestoPage() {
  return (
    <>
      <PageHeader
        label="Manifesto"
        title="What we believe about health data, AI, and Africa."
      />

      <section className="bg-white px-2 md:px-4 py-12 md:py-16">
        <div
          className="mx-auto max-w-[1200px] rounded-[28px] overflow-hidden"
          style={{ backgroundColor: "#06251f" }}
        >
          <div className="grid lg:grid-cols-[1.1fr_1.6fr] gap-10 px-6 md:px-10 py-16 md:py-20">
            <div className="lg:sticky lg:top-28 self-start">
              <p className="text-[12px] uppercase tracking-[0.18em] text-accent-mint">
                Five beliefs
              </p>
              <h2 className="mt-4 font-display font-medium text-white text-[28px] md:text-[36px] leading-[1.1] tracking-[-0.02em]">
                What we believe.
              </h2>
              <p className="mt-5 text-[14px] leading-[1.65] text-white/65 max-w-[320px]">
                A short statement of the principles that shape every decision
                we make about the connectivity layer.
              </p>
            </div>

            <ol className="divide-y divide-white/10">
              {MANIFESTO.map((line, i) => (
                <li
                  key={i}
                  className="grid grid-cols-[44px_1fr] items-baseline gap-x-5 py-6 first:pt-0 last:pb-0"
                >
                  <span className="font-mono text-[12px] text-accent-mint leading-[1.55]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <p className="text-[17px] md:text-[19px] leading-[1.55] text-white">
                    {line}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <ContactBar />
    </>
  );
}
