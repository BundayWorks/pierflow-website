import DocStub from "@/components/shared/DocStub";

export default function Page() {
  return (
    <DocStub
      title="Authentication"
      intro="All requests require a bearer token. Tokens are scoped per environment (sandbox or production) and rotate without downtime."
      sections={[
        {
          heading: "Bearer tokens",
          body: "Set the Authorization header to `Bearer <token>` on every request. Tokens are never returned by the API after creation — copy them at creation time.",
        },
        {
          heading: "Rotation",
          body: "Rotate tokens from the developer portal. New tokens are active immediately. Old tokens remain valid for 24 hours unless explicitly revoked.",
        },
        {
          heading: "Scopes",
          body: "Tokens can be scoped per resource: plans:read, enrollments:write, claims:read, and so on. Use least privilege.",
        },
      ]}
    />
  );
}
