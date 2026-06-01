import DocStub from "@/components/shared/DocStub";

export default function Page() {
  return (
    <DocStub
      title="AI layer"
      intro="Every response carries inline scores produced by the intelligence layer. Scores are stable, auditable, and explainable."
      sections={[
        {
          heading: "fraud_score",
          body: "0–100 score on every enrollment, claim, and payment. Higher means higher risk. Tunable thresholds available per partner.",
        },
        {
          heading: "identity_confidence",
          body: "0–1 confidence on the verified identity of a member. Combines BVN, NIN, biometric, and historical signals.",
        },
        {
          heading: "lapse_risk_score",
          body: "0–1 risk that a policy will lapse during the next collection cycle. Designed for proactive retention.",
        },
        {
          heading: "value_score",
          body: "0–100 plan-quality score. Considers benefit breadth, network depth, and pricing efficiency.",
        },
        {
          heading: "Auditability",
          body: "Every score includes the model version, inputs hash, and decision time. Full traces are queryable from the portal.",
        },
      ]}
    />
  );
}
