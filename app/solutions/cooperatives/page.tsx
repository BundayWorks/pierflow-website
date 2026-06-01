import SolutionPage from "@/components/shared/SolutionPage";

export default function Page() {
  return (
    <SolutionPage
      label="Solutions · Cooperatives"
      title="Health coverage for member networks."
      intro="Stand up group health plans for cooperative members. Plan matching, enrollment, and renewal — all on a single API."
      aiField="plan_match_score"
      capabilities={[
        {
          title: "Plan matching",
          body: "Match plans to member demographics, budgets, and household structures using plan_match_score.",
        },
        {
          title: "Group enrollment",
          body: "Onboard cohorts of members efficiently, with the right HMO bound per region.",
        },
        {
          title: "Sustained engagement",
          body: "Lapse-risk-driven outreach keeps coverage active for the people who depend on it.",
        },
      ]}
      outcomes={[
        {
          metric: "↑",
          body: "active coverage across cooperative members.",
        },
        {
          metric: "All",
          body: "renewals scored before they fall due.",
        },
        {
          metric: "1",
          body: "platform across every regional HMO.",
        },
      ]}
    />
  );
}
