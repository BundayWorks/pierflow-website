import DocStub from "@/components/shared/DocStub";

export default function Page() {
  return (
    <DocStub
      title="Verification"
      intro="Verify member identity and coverage in real time at point of care. Designed for millisecond-scale latency."
      sections={[
        {
          heading: "POST /v1/verifications",
          body: "Provide a policy_id or member identifier plus the provider context. Returns coverage state, network status, and eligibility_confidence.",
        },
        {
          heading: "Caching",
          body: "Cache results for up to 60 seconds per member when running verification inside a clinical workflow. Stale verifications can be refreshed in the background.",
        },
      ]}
    />
  );
}
