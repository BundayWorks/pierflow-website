import SolutionPage from "@/components/shared/SolutionPage";

export default function Page() {
  return (
    <SolutionPage
      label="Solutions · Hospitals"
      title="Verify coverage, exchange records, get paid faster."
      intro="One integration to every HMO and partner in the network. Verification in milliseconds, claim submission with structured payloads, FHIR record exchange."
      aiField="eligibility_confidence"
      capabilities={[
        {
          title: "Real-time verification",
          body: "Check coverage and network status at point of care with eligibility_confidence in every response.",
        },
        {
          title: "Structured claim submission",
          body: "Submit claims in canonical form. Reduce rejections from formatting and missing fields.",
        },
        {
          title: "Record exchange",
          body: "Send and receive FHIR-canonical clinical records securely with referring providers.",
        },
      ]}
      outcomes={[
        {
          metric: "ms",
          body: "verification latency at point of care.",
        },
        {
          metric: "↓",
          body: "claim rejection rates from structured intake.",
        },
        {
          metric: "1",
          body: "integration covering every HMO you accept.",
        },
      ]}
    />
  );
}
