import {
  DocPageHeader,
  H2,
  Body,
  Lead,
  KVTable,
  Callout,
  PrevNext,
} from "@/components/docs/primitives";
import { neighbors } from "@/components/docs/nav-helpers";

export default function Page() {
  const { prev, next } = neighbors("security");
  return (
    <article>
      <DocPageHeader
        eyebrow="Trust"
        title="Security & compliance"
        description="How Pierflow protects health data, financial data, and the systems that touch them."
      />

      <Lead>
        Pierflow is built to handle the kind of data that has to be handled
        the way health data must be handled. Every layer assumes the worst
        and defaults to least privilege.
      </Lead>

      <H2 id="encryption">Encryption</H2>
      <KVTable
        rows={[
          ["At rest", "AES-256 on all PII, PHI, and financial fields"],
          ["In transit", "TLS 1.3 enforced; HSTS; certificate pinning in mobile SDKs"],
          ["Tokens", "Bearer tokens never written to logs; redacted in support tooling"],
        ]}
      />

      <H2 id="rbac">Role-based access</H2>
      <Body>
        Admin operations are governed by least-privilege RBAC. Roles include{" "}
        <code>super_admin</code>, <code>ops_admin</code>,{" "}
        <code>partner_admin</code>, and <code>read_only</code>.
      </Body>

      <H2 id="phi">PHI isolation</H2>
      <Body>
        Health data is held in a separate schema with stricter access
        controls. Bulk endpoints never return PHI fields; you must explicitly
        request a specific record to see them.
      </Body>

      <H2 id="ndpr">NDPR compliance</H2>
      <Body>
        Data residency in Nigeria (AWS af-south-1). Retention policy enforced
        at the storage layer. Data subject rights APIs handle erasure and
        portability requests within the regulatory window.
      </Body>

      <Callout kind="info">
        Pierflow processes data on behalf of its partners under a Data
        Processing Agreement. The partner is the data controller; Pierflow is
        the data processor.
      </Callout>

      <PrevNext prev={prev} next={next} />
    </article>
  );
}
