import DocStub from "@/components/shared/DocStub";

export default function Page() {
  return (
    <DocStub
      title="Webhooks"
      intro="Receive durable events for every meaningful state change. At-least-once delivery with idempotent payloads."
      sections={[
        {
          heading: "Subscribing",
          body: "Register a webhook endpoint from the developer portal. Provide an HTTPS URL and the events to subscribe to.",
        },
        {
          heading: "Verification",
          body: "Every payload is signed with a per-endpoint secret. Verify the X-Pierflow-Signature header against the request body.",
        },
        {
          heading: "Retries",
          body: "Failed deliveries retry with exponential backoff for up to 72 hours.",
        },
      ]}
    />
  );
}
