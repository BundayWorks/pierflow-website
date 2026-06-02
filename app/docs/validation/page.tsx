import {
  DocPageHeader,
  H2,
  Body,
  Lead,
  Code,
  PrevNext,
} from "@/components/docs/primitives";
import { neighbors } from "@/components/docs/nav-helpers";

export default function Page() {
  const { prev, next } = neighbors("validation");
  return (
    <article>
      <DocPageHeader
        eyebrow="Auth & access"
        title="Request validation"
        description="Inputs are validated against JSON Schema at the gateway, before any business logic runs."
      />

      <Lead>
        Validation errors return <code>422 Unprocessable Entity</code> with a
        structured body listing every failed field. Fix all of them in one
        round-trip.
      </Lead>

      <H2 id="example">Example</H2>
      <Code language="json" filename="422 Unprocessable Entity">
        {`{
  "error": "VALIDATION_ERROR",
  "message": "Request validation failed",
  "request_id": "req_01HX7K2A3B4C5D",
  "details": [
    { "field": "member.date_of_birth", "message": "Must be a valid ISO 8601 date" },
    { "field": "plan_id", "message": "Required field missing" }
  ]
}`}
      </Code>

      <H2 id="strict-types">Strict types</H2>
      <Body>
        Pierflow rejects unknown fields by default. If you&apos;re sending an
        extra property, you&apos;ll see a <code>UNKNOWN_FIELD</code> error —
        useful for catching typos early.
      </Body>

      <PrevNext prev={prev} next={next} />
    </article>
  );
}
