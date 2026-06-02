import {
  DocPageHeader,
  H2,
  Body,
  Code,
  Callout,
  PrevNext,
} from "@/components/docs/primitives";
import { neighbors } from "@/components/docs/nav-helpers";

export default function Page() {
  const { prev, next } = neighbors("quickstart/setup");
  return (
    <article>
      <DocPageHeader
        eyebrow="Quickstart"
        title="Quickstart setup"
        description="Install the SDK, authenticate, and make your first request to the Pierflow API in under five minutes."
      />

      <H2 id="install-the-sdk">Install the SDK</H2>
      <Body>
        Pierflow ships an official Node SDK. A Python SDK is on the way; in
        the meantime, every endpoint is callable directly over HTTPS.
      </Body>
      <Code language="bash" filename="terminal">
        {`npm install @pierflow/node`}
      </Code>

      <H2 id="authenticate">Authenticate</H2>
      <Body>
        Set your sandbox secret key as <code>PIERFLOW_KEY</code> in your
        environment. The SDK reads it automatically.
      </Body>
      <Code language="ts" filename="server.ts">
        {`import Pierflow from '@pierflow/node';

const pf = new Pierflow({
  apiKey: process.env.PIERFLOW_KEY,
  environment: 'sandbox', // or 'production'
});`}
      </Code>

      <H2 id="first-call">Make your first call</H2>
      <Body>
        List the plans available in the sandbox. The response includes a{" "}
        <code>value_score</code> on every plan — the platform&apos;s AI ranking
        signal.
      </Body>
      <Code language="ts" filename="list-plans.ts">
        {`const plans = await pf.plans.list({ budget_ngn: 120000 });

console.log(plans[0]);
// {
//   plan_id: 'pf_plan_01HX...',
//   name: 'Silver Plan',
//   value_score: 88,
//   ...
// }`}
      </Code>

      <Callout kind="tip" title="Prefer curl?">
        Every endpoint is plain JSON over HTTPS:
        <Code language="bash">
          {`curl https://sandbox.api.pierflow.com/v1/plans?budget_ngn=120000 \\
  -H "Authorization: Bearer $PIERFLOW_KEY"`}
        </Code>
      </Callout>

      <PrevNext prev={prev} next={next} />
    </article>
  );
}
