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
  const { prev, next } = neighbors("quickstart/introduction");
  return (
    <article>
      <DocPageHeader
        eyebrow="Quickstart"
        title="Introduction"
        description="Pierflow is the connectivity layer for healthcare in Africa — distribution rails for insurance products, and a Records API that turns paper records into FHIR R4 data your EMR or HMS can import."
      />

      <H2 id="who-its-for">Who Pierflow is for</H2>
      <Body>
        You&apos;re probably here because you&apos;re building one of these:
      </Body>
      <KVTable
        headers={["You are…", "What Pierflow gives you"]}
        rows={[
          ["A fintech or super-app", "Embedded HMO plans, savings, benefits"],
          ["An HR or payroll platform", "Group enrollment across multiple HMOs"],
          ["A hospital or clinic", "Verification, claims, FHIR record exchange"],
          ["An EMR / HMS vendor", "Records API — pull historical patient data as FHIR R4 bundles"],
          ["A diagnostic lab", "Verification, claims, archive digitisation"],
          ["An HMO software vendor", "Distribution rails + AI scoring layer"],
          ["A government programme", "Population data exchange + analytics"],
        ]}
      />

      <H2 id="two-environments">Two environments</H2>
      <Body>
        You&apos;ll have two sets of API keys — one for each environment. Start
        in sandbox; move to production when you&apos;re ready.
      </Body>
      <KVTable
        headers={["Environment", "Use it for"]}
        rows={[
          [
            "Sandbox",
            "Synthetic plans, mock HMO connectors, test card numbers. Safe to break things.",
          ],
          [
            "Production",
            "Real HMOs, real members, real money. Unlocked after a short review.",
          ],
        ]}
      />

      <H2 id="your-api-keys">Your API keys</H2>
      <Body>
        Once provisioned, your keys appear in the Pierflow developer portal.
        All keys follow the pattern{" "}
        <code>pf_&#123;environment&#125;_&#123;type&#125;_&#123;random&#125;</code>.
      </Body>
      <Callout kind="warn" title="Keep secrets out of front-end code">
        Anything starting with <code>pf_*_sk_</code> is a secret key. Treat it
        like a password. Use the public <code>client_id</code> in front-end
        builds.
      </Callout>

      <PrevNext prev={prev} next={next} />
    </article>
  );
}
