import {
  DocPageHeader,
  H2,
  Body,
  Lead,
  KVTable,
  Code,
  Callout,
  PrevNext,
} from "@/components/docs/primitives";
import { neighbors } from "@/components/docs/nav-helpers";

export default function Page() {
  const { prev, next } = neighbors("rate-limiting");
  return (
    <article>
      <DocPageHeader
        eyebrow="Auth & access"
        title="Rate limiting"
        description="Per-tier request quotas, burst handling, and the headers your client should respect."
      />

      <H2 id="tiers">Tiers</H2>
      <Lead>
        Quotas scale with your plan. Burst limits absorb short spikes (1–2
        seconds) before the steady-state limit kicks in.
      </Lead>
      <KVTable
        headers={["Tier", "Requests / minute", "Burst"]}
        rows={[
          ["Sandbox", "60", "100"],
          ["Starter (0–1,000 policies)", "300", "500"],
          ["Growth (1,000–10,000 policies)", "1,000", "2,000"],
          ["Enterprise (10,000+ policies)", "Custom SLA", "Custom"],
        ]}
      />

      <H2 id="headers">Response headers</H2>
      <Body>Every response carries the rate-limit window state.</Body>
      <Code language="http">
        {`X-RateLimit-Limit: 300
X-RateLimit-Remaining: 296
X-RateLimit-Reset: 1717248720`}
      </Code>

      <H2 id="when-throttled">When throttled</H2>
      <Body>
        At the limit you&apos;ll receive <code>429 Too Many Requests</code> with
        a <code>Retry-After</code> header. Honour it.
      </Body>
      <Callout kind="tip" title="Backoff strategy">
        Use exponential backoff with jitter. The platform never punishes
        polite retries; it does throttle tight loops.
      </Callout>

      <PrevNext prev={prev} next={next} />
    </article>
  );
}
