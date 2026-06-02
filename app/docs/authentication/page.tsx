import {
  DocPageHeader,
  H2,
  Body,
  Lead,
  Code,
  Callout,
  FieldCardList,
  FieldCard,
  PrevNext,
} from "@/components/docs/primitives";
import { neighbors } from "@/components/docs/nav-helpers";

export default function Page() {
  const { prev, next } = neighbors("authentication");
  return (
    <article>
      <DocPageHeader
        eyebrow="Auth & access"
        title="Authentication"
        description="Two mechanisms: OAuth 2.0 for partner applications and bearer API keys for server-to-server calls."
      />

      <H2 id="oauth-2">OAuth 2.0</H2>
      <Lead>
        Used by partners building consumer-facing applications on top of the
        Pierflow API. Standard client-credentials grant.
      </Lead>
      <Code language="bash" filename="token.request">
        {`POST /auth/v1/token
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials
&client_id=pf_live_cid_xxxxx
&client_secret=pf_live_cs_xxxxx
&scope=enrollment plans pricing claims`}
      </Code>
      <Code language="json" filename="200 OK">
        {`{
  "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "scope": "enrollment plans pricing claims"
}`}
      </Code>

      <H2 id="api-keys">API keys</H2>
      <Body>
        For pure machine-to-machine calls, an API key in the{" "}
        <code>Authorization</code> header is enough.
      </Body>
      <Code language="http">
        {`Authorization: Bearer pf_live_sk_xxxxxxxxxxxxxxxxxxxxxxxx`}
      </Code>

      <H2 id="key-format">Key format</H2>
      <FieldCardList>
        <FieldCard
          name="pf_test_sk_… / pf_live_sk_…"
          type="secret key"
          description="Server-side only. Pattern: pf_{environment}_{type}_{random}. sk = secret, pk = public."
        />
        <FieldCard
          name="pf_test_pk_… / pf_live_pk_…"
          type="public key"
          description="Safe to embed in front-end builds. Limited to read-only scopes."
        />
        <FieldCard
          name="pf_test_cid_… / pf_test_cs_…"
          type="OAuth credentials"
          description="Used with the /auth/v1/token endpoint to exchange for access tokens."
        />
      </FieldCardList>

      <H2 id="rotation">Rotation</H2>
      <Body>
        Rotate any credential from the developer portal. New keys activate
        immediately; old keys remain valid for 24 hours unless explicitly
        revoked.
      </Body>
      <Callout kind="warn" title="If a key is ever exposed">
        Revoke immediately from the portal. Pierflow will not invalidate the
        old key without your explicit action — even if traffic patterns look
        suspicious — so prefer manual revocation over silent rotation.
      </Callout>

      <PrevNext prev={prev} next={next} />
    </article>
  );
}
