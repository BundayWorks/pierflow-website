import {
  DocPageHeader,
  H2,
  Body,
  Lead,
  Endpoint,
  Code,
  KVTable,
  Callout,
  PrevNext,
} from "@/components/docs/primitives";
import { neighbors } from "@/components/docs/nav-helpers";

export default function Page() {
  const { prev, next } = neighbors("webhooks");
  return (
    <article>
      <DocPageHeader
        eyebrow="Events"
        title="Webhooks"
        description="Durable, signed, at-least-once delivery of every meaningful platform event."
      />

      <Lead>
        Webhooks are how Pierflow tells your system the world has changed —
        without you polling. Every event carries a signature; verify it before
        acting.
      </Lead>

      <H2 id="event-catalogue">Event catalogue</H2>
      <KVTable
        headers={["Event", "When it fires"]}
        rows={[
          ["member.created", "A new member record was created"],
          ["policy.issued", "Policy confirmed and active"],
          ["policy.renewed", "Renewal premium collected"],
          ["policy.lapsed", "Premium collection failed after grace"],
          ["policy.cancelled", "Policy terminated"],
          ["premium.paid", "Successful premium collection"],
          ["premium.failed", "Failed premium collection attempt"],
          ["claim.submitted", "Claim received by platform"],
          ["claim.approved", "Claim approved by HMO"],
          ["claim.rejected", "Claim rejected by HMO"],
          ["commission.credited", "Commission posted to your ledger"],
        ]}
      />

      <H2 id="subscribing">Subscribing</H2>
      <Endpoint method="POST" path="/v1/webhooks/endpoints" />
      <Code language="json">
        {`{
  "url": "https://example.com/webhooks/pierflow",
  "events": ["policy.issued", "premium.paid", "claim.approved"]
}`}
      </Code>

      <H2 id="signature">Signature verification</H2>
      <Body>
        Every delivery includes <code>X-Pierflow-Signature: t=...,v1=...</code>.
        Recompute the signature over <code>{`<timestamp>.<raw-body>`}</code>{" "}
        with your endpoint secret using HMAC-SHA256 and compare in constant
        time.
      </Body>
      <Code language="ts" filename="verify.ts">
        {`import crypto from 'node:crypto';

export function verifyPierflow(rawBody: string, header: string, secret: string) {
  const [tPart, sigPart] = header.split(',');
  const t = tPart.split('=')[1];
  const sig = sigPart.split('=')[1];
  const expected = crypto
    .createHmac('sha256', secret)
    .update(\`\${t}.\${rawBody}\`)
    .digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
}`}
      </Code>

      <H2 id="retries">Retries</H2>
      <Body>
        Pierflow retries failed deliveries with exponential backoff:
        immediate, then 30s, 2m, 10m, 1h, 6h, 24h. After 7 failures the
        webhook is marked dead and an alert email is sent.
      </Body>

      <Callout kind="warn" title="Idempotent processing">
        Webhooks are at-least-once. Always dedupe on{" "}
        <code>event.id</code> before mutating state.
      </Callout>

      <PrevNext prev={prev} next={next} />
    </article>
  );
}
