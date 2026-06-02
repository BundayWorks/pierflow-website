import {
  DocPageHeader,
  H2,
  KVTable,
  Code,
  PrevNext,
} from "@/components/docs/primitives";
import { neighbors } from "@/components/docs/nav-helpers";

export default function Page() {
  const { prev, next } = neighbors("api/protocols");
  return (
    <article>
      <DocPageHeader
        eyebrow="API"
        title="Protocols & headers"
        description="HTTPS-only with TLS 1.3, standard methods, and a small set of platform headers you can rely on."
      />

      <H2 id="methods">HTTP methods</H2>
      <KVTable
        headers={["Method", "Use"]}
        rows={[
          ["GET", "Read resources"],
          ["POST", "Create resources, perform actions (always idempotent)"],
          ["PATCH", "Partial update of a resource"],
          ["DELETE", "Cancel or remove a resource"],
        ]}
      />

      <H2 id="headers">Common headers</H2>
      <KVTable
        headers={["Header", "Purpose"]}
        rows={[
          ["Authorization", "Bearer token (API key or OAuth access token)"],
          ["Idempotency-Key", "Safe-retry key on POST writes (24h window)"],
          ["X-Pierflow-Tenant", "Override tenant context for partner-of-partner scenarios"],
          ["X-RateLimit-Limit", "Returned: requests per minute on your tier"],
          ["X-RateLimit-Remaining", "Returned: requests left this minute"],
          ["X-Request-Id", "Returned on every response; quote when filing support tickets"],
        ]}
      />

      <H2 id="example">Example response headers</H2>
      <Code language="http">
        {`HTTP/1.1 200 OK
Content-Type: application/json
X-Request-Id: req_01HX7K2A3B4C5D
X-RateLimit-Limit: 300
X-RateLimit-Remaining: 296`}
      </Code>

      <PrevNext prev={prev} next={next} />
    </article>
  );
}
