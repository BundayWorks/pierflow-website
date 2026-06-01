import SolutionPage from "@/components/shared/SolutionPage";

export default function Page() {
  return (
    <SolutionPage
      label="Solutions · HR & payroll"
      title="Group benefits for distributed teams."
      intro="Run group enrollment, dependents, and renewals from your HR platform — across any HMO in the network."
      aiField="lapse_risk_score"
      capabilities={[
        {
          title: "Bulk enrollment",
          body: "Onboard hundreds of employees at once. Identity verification, plan binding, and effective-date scheduling happen in the platform.",
        },
        {
          title: "Dependents and life events",
          body: "Add and remove dependents with the right mid-cycle proration, automatically reflected on the carrier side.",
        },
        {
          title: "Renewals",
          body: "Annual renewal flows driven by lapse_risk_score, with member outreach hooks for at-risk employees.",
        },
        {
          title: "Payroll integration",
          body: "Premium deductions reconciled to payroll runs — no spreadsheet handoffs.",
        },
      ]}
      outcomes={[
        {
          metric: "90%",
          body: "less back-and-forth with HMOs at renewal.",
        },
        {
          metric: "All",
          body: "covered employees scored for lapse risk pre-cycle.",
        },
        {
          metric: "1",
          body: "API across every HMO your customers use.",
        },
      ]}
    />
  );
}
