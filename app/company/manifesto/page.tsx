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
      <section className="bg-dark-bg">
        <div className="max-w-content mx-auto px-6 py-20">
          <ol className="space-y-10">
            {MANIFESTO.map((line, i) => (
              <li key={i} className="flex gap-6">
                <span className="font-mono text-[12px] text-accent-green pt-1 w-8 shrink-0">
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
