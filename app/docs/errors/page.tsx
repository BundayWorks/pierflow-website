import {
  DocPageHeader,
  H2,
  Body,
  KVTable,
  Code,
  PrevNext,
} from "@/components/docs/primitives";
import { neighbors } from "@/components/docs/nav-helpers";

export default function Page() {
  const { prev, next } = neighbors("errors");
  return (
    <article>
      <DocPageHeader
        eyebrow="Reference"
        title="Errors"
        description="Every error returns a structured JSON body with a stable code, a human message, and a request_id for support."
      />

      <H2 id="shape">Shape</H2>
      <Code language="json">
        {`{
  "error": "VALIDATION_ERROR",
  "message": "Request validation failed",
  "request_id": "req_01HX7K2A3B4C5D",
  "details": [
    { "field": "member.date_of_birth", "message": "Must be a valid ISO 8601 date" }
  ]
}`}
      </Code>

      <H2 id="codes">Common codes</H2>
      <KVTable
        headers={["Code", "Status", "Meaning"]}
        rows={[
          ["VALIDATION_ERROR", "422", "Request body failed schema validation"],
          ["AUTHENTICATION_FAILED", "401", "Missing or invalid credentials"],
          ["PERMISSION_DENIED", "403", "Authenticated but not permitted"],
          ["RESOURCE_NOT_FOUND", "404", "Resource does not exist or is filtered by tenant"],
          ["IDENTITY_MISMATCH", "422", "NIN/BVN data did not match enrollment"],
          ["IDEMPOTENCY_CONFLICT", "409", "Idempotency key used with a different body"],
          ["RATE_LIMITED", "429", "Tier limit exceeded; honour Retry-After"],
          ["UPSTREAM_UNAVAILABLE", "502", "HMO or payment gateway is unreachable"],
        ]}
      />

      <H2 id="support">When you need help</H2>
      <Body>
        Always quote the <code>request_id</code> when filing a support ticket.
        It lets us replay the exact call without you re-sending the body.
      </Body>

      <PrevNext prev={prev} next={next} />
    </article>
  );
}
