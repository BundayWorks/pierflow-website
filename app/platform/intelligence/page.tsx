import ModulePage from "@/components/shared/ModulePage";

export default function Page() {
  return (
    <ModulePage
      label="Platform · Intelligence"
      title="AI as health data infrastructure."
      intro="Scoring on every response. Fraud, lapse, value, identity, population_signal — inline and auditable."
      features={[
        {
          title: "Inline scoring",
          body: "Scores are returned alongside the data — no separate model calls to manage.",
        },
        {
          title: "Auditable",
          body: "Every score includes the model version, inputs hash, and decision time.",
        },
        {
          title: "Continuously learning",
          body: "Every confirmed identity, approved claim, and renewed policy improves the next prediction.",
        },
      ]}
    />
  );
}
