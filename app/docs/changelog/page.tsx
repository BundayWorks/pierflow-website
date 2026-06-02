import {
  DocPageHeader,
  H2,
  Body,
  PrevNext,
} from "@/components/docs/primitives";
import { neighbors } from "@/components/docs/nav-helpers";

const ENTRIES = [
  {
    date: "2026-05-30",
    title: "Plaid-style docs experience",
    body:
      "Complete docs rebuild: sticky sidebar with section anchors, cmd-K fuzzy search, signature-verification snippets, AI fields exposed as field cards.",
  },
  {
    date: "2026-05-20",
    title: "Sandbox launches",
    body:
      "Sandbox API access opens with multiple HMO connectors live. AI scoring is on by default.",
  },
  {
    date: "2026-04-08",
    title: "FHIR R4 endpoints",
    body:
      "Every canonical resource is now retrievable as FHIR R4 via /v1/fhir/*.",
  },
  {
    date: "2026-03-15",
    title: "Webhook signing",
    body:
      "Per-endpoint secrets and X-Pierflow-Signature verification are now generally available.",
  },
];

export default function Page() {
  const { prev, next } = neighbors("changelog");
  return (
    <article>
      <DocPageHeader
        eyebrow="Reference"
        title="Changelog"
        description="Notable platform changes, in reverse chronological order. Subscribe via the developer newsletter to get these in your inbox."
      />
      <ul className="divide-y divide-black/[0.06]">
        {ENTRIES.map((e) => (
          <li key={e.date} className="py-6">
            <p className="text-[12px] font-mono text-accent-emerald">{e.date}</p>
            <h3 className="mt-1 text-[18px] text-accent-ink font-medium">
              {e.title}
            </h3>
            <p className="mt-2 text-[14px] leading-[1.7] text-accent-ink/75">
              {e.body}
            </p>
          </li>
        ))}
      </ul>

      <H2 id="how-we-version">How changes are communicated</H2>
      <Body>
        New endpoints, optional fields, and event types are additive and ship
        any week. Breaking changes get a new major version, a deprecation
        window of at least 12 months, and a tagged entry above.
      </Body>

      <PrevNext prev={prev} next={next} />
    </article>
  );
}
