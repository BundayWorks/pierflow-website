import {
  DocPageHeader,
  H2,
  Body,
  Code,
  PrevNext,
} from "@/components/docs/primitives";
import { neighbors } from "@/components/docs/nav-helpers";

export default function Page() {
  const { prev, next } = neighbors("data-standards/money-time");
  return (
    <article>
      <DocPageHeader
        eyebrow="Data standards"
        title="Money & timestamps"
        description="Two boring details that catch every integration off-guard at least once."
      />

      <H2 id="money">Money</H2>
      <Body>
        Always minor units. NGN is in kobo; <code>1500000</code> means ₦15,000.00.
        Display formatting belongs in your client, not the API.
      </Body>

      <H2 id="timestamps">Timestamps</H2>
      <Body>
        Pure ISO-8601 UTC for stored timestamps. Local-time fields (e.g. an
        appointment in Lagos) include the offset explicitly.
      </Body>
      <Code language="json">
        {`{
  "created_at":       "2026-06-01T12:14:09Z",
  "effective_date":   "2026-06-01",
  "appointment_at":   "2026-06-12T10:00:00+01:00"
}`}
      </Code>

      <PrevNext prev={prev} next={next} />
    </article>
  );
}
