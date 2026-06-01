import DocStub from "@/components/shared/DocStub";

export default function Page() {
  return (
    <DocStub
      title="Errors"
      intro="The API returns structured errors with a stable code, a human-readable message, and a request_id for support."
      sections={[
        {
          heading: "Shape",
          body: "Errors are JSON objects: { type, code, message, request_id, details? }. The HTTP status code is always set appropriately.",
        },
        {
          heading: "Common codes",
          body: "validation_error · authentication_failed · permission_denied · resource_not_found · rate_limited · upstream_unavailable.",
        },
      ]}
    />
  );
}
