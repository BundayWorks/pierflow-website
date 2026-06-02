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
  const { prev, next } = neighbors("api/field-formats");
  return (
    <article>
      <DocPageHeader
        eyebrow="API"
        title="Field formats"
        description="The shape and types you can rely on across every endpoint."
      />

      <H2 id="strings">String formats</H2>
      <KVTable
        headers={["Field family", "Format"]}
        rows={[
          ["Identifiers", "pf_<resource>_<ulid>, e.g. pf_plan_01HX7K…"],
          ["Names", "UTF-8, trimmed of leading/trailing whitespace"],
          ["Phone", "E.164 (e.g. +2348012345678)"],
          ["Email", "RFC 5322 with case-insensitive local-part comparison"],
        ]}
      />

      <H2 id="dates">Dates and timestamps</H2>
      <Body>All times are UTC ISO-8601. Local-time fields use an explicit timezone offset.</Body>
      <Code language="json">{`{
  "effective_date": "2026-06-01",
  "created_at": "2026-05-30T12:14:09Z",
  "appointment_at": "2026-06-12T10:00:00+01:00"
}`}</Code>

      <H2 id="money">Money</H2>
      <Body>
        Money is always in minor units. <code>1500000</code> NGN means ₦15,000.00.
      </Body>

      <H2 id="enums">Enums</H2>
      <Body>
        Enum values are SCREAMING_SNAKE_CASE. New values may be added without
        a major version bump — treat unknown values defensively.
      </Body>

      <PrevNext prev={prev} next={next} />
    </article>
  );
}
