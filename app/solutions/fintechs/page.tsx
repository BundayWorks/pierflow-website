import SolutionPage from "@/components/shared/SolutionPage";

export default function Page() {
  return (
    <SolutionPage
      label="Solutions · Fintechs"
      title="Embed health insurance in your app."
      intro="Distribute HMO plans to your users with a single API. We handle the carrier integrations, collections, and reconciliation."
      aiField="plan_recommendation"
      capabilities={[
        {
          title: "Plan discovery",
          body: "Surface plans ranked by value_score for each user's budget and household.",
        },
        {
          title: "One-call enrollment",
          body: "POST /v1/enrollments handles identity verification and policy creation across every connected HMO.",
        },
        {
          title: "Collections & reconciliation",
          body: "Recurring premium collection, retry logic, and per-HMO reconciliation are managed for you.",
        },
        {
          title: "Member portal",
          body: "Drop-in components for cards, claims, and provider lookup — or build your own on the API.",
        },
      ]}
      outcomes={[
        {
          metric: "48h",
          body: "From sandbox to live distribution.",
        },
        {
          metric: "7+",
          body: "HMOs available through a single integration.",
        },
        {
          metric: "100%",
          body: "of enrollments scored before they leave your app.",
        },
      ]}
    />
  );
}
