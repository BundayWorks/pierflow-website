import {
  DocPageHeader,
  H2,
  Lead,
  Callout,
  PrevNext,
} from "@/components/docs/primitives";
import { neighbors } from "@/components/docs/nav-helpers";

export default function Page() {
  const { prev, next } = neighbors("api/versioning");
  return (
    <article>
      <DocPageHeader
        eyebrow="API"
        title="API versioning"
        description="Path-based versioning, additive change policy, and how we communicate every breaking shift."
      />

      <Lead>
        The current version is <code>v1</code>. Non-breaking changes (new
        endpoints, new optional fields, new enum values) are introduced within{" "}
        <code>v1</code>. Breaking changes get a new major version with at least
        12 months of overlap.
      </Lead>

      <H2 id="what-counts-as-breaking">What we consider breaking</H2>
      <ul className="list-disc pl-5 text-[15px] leading-[1.85] text-accent-ink/80 space-y-1.5">
        <li>Removing or renaming a field</li>
        <li>Changing the type of an existing field</li>
        <li>Making an optional field required</li>
        <li>Changing the meaning of an existing enum value</li>
      </ul>

      <H2 id="what-is-additive">What we consider additive (non-breaking)</H2>
      <ul className="list-disc pl-5 text-[15px] leading-[1.85] text-accent-ink/80 space-y-1.5">
        <li>New endpoints</li>
        <li>New optional fields in responses or requests</li>
        <li>New event types</li>
        <li>New enum values in existing fields</li>
      </ul>

      <Callout kind="tip">
        Build your enum handling defensively — treat unknown values as
        unrecognised and surface them gracefully rather than crashing.
      </Callout>

      <PrevNext prev={prev} next={next} />
    </article>
  );
}
