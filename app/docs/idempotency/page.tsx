import {
  DocPageHeader,
  H2,
  Body,
  Lead,
  Code,
  Callout,
  PrevNext,
} from "@/components/docs/primitives";
import { neighbors } from "@/components/docs/nav-helpers";

export default function Page() {
  const { prev, next } = neighbors("idempotency");
  return (
    <article>
      <DocPageHeader
        eyebrow="Auth & access"
        title="Idempotency"
        description="Send an Idempotency-Key on every write to make retries safe."
      />

      <Lead>
        Pierflow keeps each <code>Idempotency-Key</code> for 24 hours. Retries
        within that window return the original response — no duplicate
        enrollments, no double-charges.
      </Lead>

      <H2 id="header">Header</H2>
      <Code language="http">
        {`Idempotency-Key: idem_enrl_20260601_amaka_silver`}
      </Code>

      <H2 id="key-design">Designing keys</H2>
      <Body>
        Make keys deterministic for the request you&apos;re trying to perform.
        A good pattern: <code>{`<purpose>_<date>_<entity>_<intent>`}</code>.
      </Body>

      <Callout kind="warn" title="Don't reuse keys across distinct intents">
        A key is bound to the request body. Sending a different body with the
        same key returns a 409. Use a fresh key for a genuinely new action.
      </Callout>

      <PrevNext prev={prev} next={next} />
    </article>
  );
}
