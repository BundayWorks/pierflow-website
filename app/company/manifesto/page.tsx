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
      <section className="bg-[#06251f]">
        <div className="max-w-[760px] mx-auto px-6 py-24">
          <ol className="space-y-10">
            {MANIFESTO.map((line, i) => (
              <li
                key={i}
                className="grid grid-cols-[44px_1fr] items-baseline gap-x-4"
              >
                <span className="font-mono text-[12px] text-accent-green leading-[1.55]">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <p className="text-[18px] md:text-[20px] leading-[1.55] text-textd-tealish">
                  {line}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>
      <ContactBar />
    </>
  );
}
