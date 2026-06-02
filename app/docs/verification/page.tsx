import {
  DocPageHeader,
  H2,
  Body,
  Lead,
  Endpoint,
  Code,
  Callout,
  PrevNext,
} from "@/components/docs/primitives";
import { neighbors } from "@/components/docs/nav-helpers";

export default function Page() {
  const { prev, next } = neighbors("verification");
  return (
    <article>
      <DocPageHeader
        eyebrow="Resources"
        title="Verification"
        description="Verify member coverage in milliseconds at point of care. Built for clinical workflows where latency is critical."
      />

      <Lead>
        Verification answers a simple question: is this person covered, by
        which plan, in what network, right now?
      </Lead>

      <Endpoint method="POST" path="/v1/verifications" />
      <Code language="json" filename="request">
        {`{
  "policy_id": "pf_pol_01HX...",
  "provider_id": "pf_prov_reddington",
  "service_type": "outpatient_visit"
}`}
      </Code>
      <Code language="json" filename="200 OK">
        {`{
  "verification_id": "pf_vrf_01HX...",
  "coverage": { "state": "active", "in_network": true, "remaining_limit_ngn": 152000 },
  "eligibility_confidence": 0.99,
  "expires_at": "2026-06-01T12:15:00Z"
}`}
      </Code>

      <H2 id="caching">Caching</H2>
      <Body>
        Cache results for up to 60 seconds inside a clinical workflow. Stale
        verifications can be refreshed in the background — never block care
        on a network round-trip you already made seconds ago.
      </Body>

      <Callout kind="tip">
        Read <code>eligibility_confidence</code> alongside{" "}
        <code>coverage.state</code>. Active coverage with low confidence (e.g.
        0.75) typically signals an identity mismatch worth flagging at the
        desk.
      </Callout>

      <PrevNext prev={prev} next={next} />
    </article>
  );
}
