import SolutionPage from "@/components/shared/SolutionPage";

export default function Page() {
  return (
    <SolutionPage
      label="Solutions · HMOs"
      title="Modern infrastructure for distribution, claims, and ops."
      intro="Plug into the connectivity layer. Reach new distribution partners, automate ops, and get AI scoring on every claim."
      aiField="fraud_score"
      capabilities={[
        {
          title: "Distribution",
          body: "Every fintech, HR platform, and partner integrated to Pierflow becomes a distribution channel for your plans.",
        },
        {
          title: "Claims intake",
          body: "Receive structured claims with fraud_score and eligibility_confidence inline. Cut investigation time on every adjudication.",
        },
        {
          title: "Member operations",
          body: "Verification, dependents, renewals, and member updates flow through canonical endpoints.",
        },
        {
          title: "FHIR R4 exchange",
          body: "Become standards-aligned overnight without re-platforming.",
        },
      ]}
      outcomes={[
        {
          metric: "<48h",
          body: "to onboard a new distribution partner.",
        },
        {
          metric: "100%",
          body: "of inbound claims scored at intake.",
        },
        {
          metric: "1",
          body: "canonical surface — fewer bespoke integrations to maintain.",
        },
      ]}
    />
  );
}
