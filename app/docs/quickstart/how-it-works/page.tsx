import {
  DocPageHeader,
  H2,
  Body,
  KVTable,
  Callout,
  PrevNext,
} from "@/components/docs/primitives";
import { neighbors } from "@/components/docs/nav-helpers";

export default function Page() {
  const { prev, next } = neighbors("quickstart/how-it-works");
  return (
    <article>
      <DocPageHeader
        eyebrow="Quickstart"
        title="How it works"
        description="A mental model of the platform — layered, canonical, and standards-aligned. The same architecture powers connectivity for distribution, claims, verification, and the Records API."
      />

      <H2 id="five-layer-model">Five-layer model</H2>
      <Body>
        Inbound requests flow top-down; events and notifications flow
        bottom-up. Each layer hides the next from your code.
      </Body>
      <KVTable
        headers={["Layer", "Name", "Responsibility"]}
        rows={[
          ["L1", "Partner channel", "Accepts API requests from your application."],
          [
            "L2",
            "API gateway & security",
            "Authentication, rate limiting, tenant resolution, validation.",
          ],
          [
            "L3",
            "Core orchestration",
            "Business logic: enrollment, policy, pricing, claims, ledger.",
          ],
          [
            "L4",
            "HMO connectors",
            "One adapter per HMO vendor — normalises every difference.",
          ],
          [
            "L5",
            "Intelligence",
            "AI normalisation, fraud scoring, plan ranking, pricing.",
          ],
        ]}
      />

      <H2 id="request-lifecycle">Request lifecycle</H2>
      <Body>
        A typical enrollment touches every layer. From your POST to the policy
        being live in the HMO&apos;s system, the journey is:
      </Body>
      <ol className="list-decimal pl-5 text-[15px] leading-[1.75] text-accent-ink/80 space-y-2">
        <li>Gateway validates auth, schema, idempotency key.</li>
        <li>Identity service verifies BVN/NIN.</li>
        <li>Duplicate detection checks for existing policies.</li>
        <li>Policy engine applies plan rules and waiting periods.</li>
        <li>Premium router initiates the first collection.</li>
        <li>HMO connector posts the enrollment to the HMO&apos;s system.</li>
        <li>Pierflow stores the canonical policy record.</li>
        <li>Commission engine posts the ledger entry.</li>
        <li>Webhooks fire to your endpoint.</li>
      </ol>

      <Callout kind="tip">
        You only need to think about steps 1 and 9 — the gateway and the
        events. Everything between is handled for you.
      </Callout>

      <PrevNext prev={prev} next={next} />
    </article>
  );
}
