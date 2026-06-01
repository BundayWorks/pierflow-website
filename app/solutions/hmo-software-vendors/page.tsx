import SolutionPage from "@/components/shared/SolutionPage";

export default function Page() {
  return (
    <SolutionPage
      label="Solutions · HMO software vendors"
      title="Make every HMO product you ship more connected."
      intro="Resell the connectivity layer with your platform. Your HMO customers get distribution, AI scoring, and FHIR exchange built in."
      aiField="fraud_score"
      capabilities={[
        {
          title: "White-label connectivity",
          body: "Embed the canonical API inside your platform. Your customers see one consistent integration surface.",
        },
        {
          title: "Co-built integrations",
          body: "We onboard new HMOs alongside you, with engineering support throughout.",
        },
        {
          title: "AI scoring layer",
          body: "Every record passing through your platform is scored — fraud, lapse, identity — without you owning the models.",
        },
      ]}
      outcomes={[
        {
          metric: "1",
          body: "platform across every customer HMO.",
        },
        {
          metric: "All",
          body: "claims and enrollments AI-scored by default.",
        },
        {
          metric: "FHIR",
          body: "R4 compliance shipped on day one.",
        },
      ]}
    />
  );
}
