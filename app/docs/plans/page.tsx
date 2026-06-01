import DocStub from "@/components/shared/DocStub";

export default function Page() {
  return (
    <DocStub
      title="Plans"
      intro="Search and list HMO plans across the network. Results are ranked by value_score (coverage breadth, price efficiency, HMO reliability)."
      sections={[
        {
          heading: "GET /v1/plans",
          body: "Filter by budget_ngn, audience (individual, family, corporate), and benefits. Returns canonical Plan objects with inline value_score and plan_match_score.",
        },
        {
          heading: "GET /v1/plans/:id",
          body: "Retrieve full benefit detail, exclusions, network providers, and pricing tiers for a single plan.",
        },
      ]}
    />
  );
}
