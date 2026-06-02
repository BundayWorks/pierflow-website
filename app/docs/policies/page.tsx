import {
  DocPageHeader,
  H2,
  Body,
  Endpoint,
  Code,
  Callout,
  PrevNext,
} from "@/components/docs/primitives";
import { neighbors } from "@/components/docs/nav-helpers";

export default function Page() {
  const { prev, next } = neighbors("policies");
  return (
    <article>
      <DocPageHeader
        eyebrow="Resources"
        title="Policies"
        description="Look up an active policy, manage renewals, and process cancellations."
      />

      <H2 id="retrieve-a-policy">Retrieve a policy</H2>
      <Endpoint method="GET" path="/v1/policies/:id" />
      <Code language="json" filename="200 OK">
        {`{
  "policy_id": "pf_pol_01HX...",
  "status": "active",
  "member": { "member_id": "pf_mem_01HX...", "name": "Amaka Okeke" },
  "plan": { "plan_id": "pf_plan_silver_ind", "name": "Silver Plan" },
  "effective_date": "2026-06-01",
  "renewal_date":  "2027-06-01",
  "lapse_risk_score": 0.12,
  "premium": { "amount": 9350, "frequency": "monthly", "next_due": "2026-07-01" }
}`}
      </Code>

      <H2 id="renewals">Renewals</H2>
      <Body>
        A daily job identifies policies expiring within 30 days. With
        auto-renew enabled, collection runs 3 days before expiry. Successful
        renewals fire <code>policy.renewed</code>; failures enter the grace
        period and fire <code>premium.failed</code>.
      </Body>

      <H2 id="cancellations">Cancellations</H2>
      <Endpoint method="DELETE" path="/v1/policies/:id" />
      <Body>
        Termination is end-of-billing-period by default; pass{" "}
        <code>{`{ "effective": "immediate" }`}</code> to terminate immediately.
        Unused premium is refunded when applicable.
      </Body>

      <Callout kind="warn" title="Commission clawback">
        If a policy is cancelled within 90 days of issue, the corresponding
        commission entry is reversed automatically. Your ledger will reflect
        this on the next settlement cycle.
      </Callout>

      <PrevNext prev={prev} next={next} />
    </article>
  );
}
