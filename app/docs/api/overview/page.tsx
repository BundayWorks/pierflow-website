import {
  DocPageHeader,
  H2,
  Lead,
  Body,
  KVTable,
  Code,
  PrevNext,
} from "@/components/docs/primitives";
import { neighbors } from "@/components/docs/nav-helpers";

export default function Page() {
  const { prev, next } = neighbors("api/overview");
  return (
    <article>
      <DocPageHeader
        eyebrow="API"
        title="API overview"
        description="The Pierflow API is a JSON, HTTPS-only, REST surface — one canonical interface across every HMO, provider, and partner in the network."
      />

      <H2 id="base-urls">Base URLs</H2>
      <KVTable
        headers={["Environment", "Base URL"]}
        rows={[
          ["Sandbox", "https://sandbox.api.pierflow.com/v1/"],
          ["Production", "https://api.pierflow.com/v1/"],
        ]}
      />

      <H2 id="conventions">Conventions</H2>
      <Lead>
        A handful of platform-wide rules apply to every endpoint. Internalise
        these once and the rest of the API behaves predictably.
      </Lead>
      <ul className="list-disc pl-5 text-[15px] leading-[1.85] text-accent-ink/80 space-y-1.5">
        <li>All requests and responses are JSON.</li>
        <li>Timestamps are ISO-8601 in UTC (e.g. <code>2026-06-01T09:30:00Z</code>).</li>
        <li>Money is in minor units of the currency (kobo for NGN).</li>
        <li>Writes are idempotent — set <code>Idempotency-Key</code> on every POST.</li>
        <li>AI fields (e.g. <code>fraud_score</code>) are stable across versions.</li>
        <li>Errors return a structured body with <code>type</code>, <code>code</code>, and <code>request_id</code>.</li>
      </ul>

      <H2 id="example">Example request</H2>
      <Body>Authenticate with a bearer token and call any endpoint.</Body>
      <Code language="bash">
        {`curl https://sandbox.api.pierflow.com/v1/plans?budget_ngn=120000 \\
  -H "Authorization: Bearer $PIERFLOW_KEY"`}
      </Code>

      <PrevNext prev={prev} next={next} />
    </article>
  );
}
