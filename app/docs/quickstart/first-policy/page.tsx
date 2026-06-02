import {
  DocPageHeader,
  H2,
  Lead,
  Body,
  Code,
  Endpoint,
  Callout,
  PrevNext,
} from "@/components/docs/primitives";
import { neighbors } from "@/components/docs/nav-helpers";

export default function Page() {
  const { prev, next } = neighbors("quickstart/first-policy");
  return (
    <article>
      <DocPageHeader
        eyebrow="Quickstart"
        title="Issue your first policy"
        description="In three calls you go from picking a plan to a live policy and a webhook event in your handler."
      />

      <Lead>
        Pierflow keeps the workflow simple: <code>quote</code> →{" "}
        <code>enroll</code> → observe. Every response carries inline AI
        signals, so you don&apos;t need a second pipeline to assess risk.
      </Lead>

      <H2 id="quote">1. Quote</H2>
      <Endpoint method="POST" path="/v1/quotes" />
      <Body>
        Provide the member&apos;s profile and Pierflow returns a ranked array of
        plans across every HMO you&apos;re permitted to distribute.
      </Body>
      <Code language="ts" filename="quote.ts">
        {`const quote = await pf.quotes.create({
  member: { age: 28, state: 'Lagos' },
  audience: 'individual',
  budget_ngn: 120000,
});

console.log(quote.packages[0]);
// { plan: {...}, pricing: {...}, value_score: 82, coverage_score: 78 }`}
      </Code>

      <H2 id="enroll">2. Enroll</H2>
      <Endpoint method="POST" path="/v1/enrollments" />
      <Body>
        Pass the chosen <code>plan_id</code> with the member&apos;s identity
        document (BVN or NIN). The response includes <code>fraud_score</code>{" "}
        and <code>identity_confidence</code> inline.
      </Body>
      <Code language="ts" filename="enroll.ts">
        {`const policy = await pf.enrollments.create({
  hmo_id: 'pf_hmo_clearline',
  plan_id: quote.packages[0].plan.plan_id,
  member: {
    first_name: 'Amaka',
    last_name: 'Okeke',
    date_of_birth: '1997-09-12',
    bvn: '22********1',
  },
}, { idempotencyKey: 'enrl_2026_amaka_silver' });

// → { policy_id, fraud_score: 4, identity_confidence: 0.97, effective_date }`}
      </Code>

      <Callout kind="tip" title="Always set an idempotency key">
        Network blips and client retries are inevitable. With an idempotency
        key, the second request returns the original response — no double
        enrollments.
      </Callout>

      <H2 id="observe-webhooks">3. Observe webhooks</H2>
      <Body>
        Configure a webhook endpoint in the developer portal. Within seconds of
        the enrollment succeeding, you&apos;ll receive{" "}
        <code>policy.issued</code> and <code>premium.paid</code> events.
      </Body>
      <Code language="ts" filename="webhook-handler.ts">
        {`app.post('/webhooks/pierflow', (req, res) => {
  pf.webhooks.verify(req.body, req.headers['x-pierflow-signature']);

  const event = req.body;
  switch (event.type) {
    case 'policy.issued':
      // update your DB, notify the user
      break;
    case 'claim.approved':
      // disburse, render in the app
      break;
  }
  res.sendStatus(200);
});`}
      </Code>

      <PrevNext prev={prev} next={next} />
    </article>
  );
}
