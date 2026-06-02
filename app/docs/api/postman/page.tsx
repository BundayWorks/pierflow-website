import {
  DocPageHeader,
  H2,
  Body,
  Lead,
  Callout,
  PrevNext,
} from "@/components/docs/primitives";
import { neighbors } from "@/components/docs/nav-helpers";

export default function Page() {
  const { prev, next } = neighbors("api/postman");
  return (
    <article>
      <DocPageHeader
        eyebrow="API"
        title="Postman collection"
        description="A maintained Postman workspace with pre-filled requests for every endpoint and event."
      />

      <Lead>
        The fastest way to poke at the API without writing code. Fork the
        collection, paste in your sandbox key, and you&apos;re live.
      </Lead>

      <H2 id="get-it">Get the collection</H2>
      <Body>
        The Pierflow Postman workspace ships with environment variables for
        sandbox and production, plus example bodies for every write endpoint.
      </Body>

      <Callout kind="info" title="Coming with API access">
        The Postman link is included in your onboarding email. Need it now?{" "}
        <a
          href="mailto:pierflowllc@gmail.com"
          className="text-accent-emerald underline"
        >
          pierflowllc@gmail.com
        </a>
        .
      </Callout>

      <PrevNext prev={prev} next={next} />
    </article>
  );
}
