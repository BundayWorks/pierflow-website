import SolutionPage from "@/components/shared/SolutionPage";

export default function Page() {
  return (
    <SolutionPage
      label="Solutions · Governments"
      title="Population-level health data exchange."
      intro="A neutral, standards-aligned layer for public health programmes, NHIS-style schemes, and inter-agency data sharing."
      aiField="population_signal"
      capabilities={[
        {
          title: "Programme enrollment",
          body: "Onboard millions of beneficiaries with verified identity and structured data.",
        },
        {
          title: "Cross-agency exchange",
          body: "Share data between ministries and partners with policy-driven access controls.",
        },
        {
          title: "Population analytics",
          body: "Aggregate population_signal scores across geographies and time. Decision-ready data, with auditability built in.",
        },
      ]}
      outcomes={[
        {
          metric: "Standards",
          body: "FHIR R4 aligned by default.",
        },
        {
          metric: "Neutral",
          body: "infrastructure that every partner can build on.",
        },
        {
          metric: "Audit",
          body: "trails on every read and write.",
        },
      ]}
    />
  );
}
