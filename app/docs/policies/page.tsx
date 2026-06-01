import DocStub from "@/components/shared/DocStub";

export default function Page() {
  return (
    <DocStub
      title="Policies"
      intro="Look up an active policy, retrieve coverage details, and subscribe to lifecycle events (renewal, lapse, cancellation)."
      sections={[
        {
          heading: "GET /v1/policies/:id",
          body: "Returns the canonical Policy object including the member, plan, effective dates, and inline lapse_risk_score.",
        },
        {
          heading: "Lifecycle events",
          body: "Subscribe to policy.created, policy.renewed, policy.lapsed, and policy.cancelled via webhooks.",
        },
      ]}
    />
  );
}
