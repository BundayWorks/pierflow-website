import DocStub from "@/components/shared/DocStub";

export default function Page() {
  return (
    <DocStub
      title="Claims"
      intro="Submit, track, and reconcile claims across HMOs and providers. Each claim is scored at intake."
      sections={[
        {
          heading: "POST /v1/claims",
          body: "Submit a claim with policy_id, provider_id, encounter details, and amount. Returns claim_id, fraud_score, and eligibility_confidence.",
        },
        {
          heading: "Adjudication updates",
          body: "Listen for claim.adjudicated and claim.paid via webhooks. Status transitions are idempotent and replayable.",
        },
      ]}
    />
  );
}
