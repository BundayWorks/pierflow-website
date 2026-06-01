import DocStub from "@/components/shared/DocStub";

export default function Page() {
  return (
    <DocStub
      title="Enrollment"
      intro="Enroll members into plans. The platform handles identity verification, plan binding with the HMO, and effective-date scheduling."
      sections={[
        {
          heading: "POST /v1/enrollments",
          body: "Submit member identity, selected plan_id, and effective_date. Returns a policy_id plus fraud_score and identity_confidence inline.",
        },
        {
          heading: "Idempotency",
          body: "Send an Idempotency-Key header on every write. Retries within 24 hours return the original result without creating duplicates.",
        },
      ]}
    />
  );
}
