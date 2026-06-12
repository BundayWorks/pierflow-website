import {
  DocPageHeader,
  H2,
  H3,
  Body,
  Code,
  KVTable,
  Callout,
  PrevNext,
} from "@/components/docs/primitives";
import { neighbors } from "@/components/docs/nav-helpers";

export default function Page() {
  const { prev, next } = neighbors("verification");
  return (
    <article>
      <DocPageHeader
        eyebrow="Resources"
        title="Identity verification"
        description="How Pierflow verifies member identity at enrollment time, what we store, and how the disposition rules drive policy issuance."
      />

      <Body>
        Identity verification runs inline inside{" "}
        <code>POST /v1/enrollments</code>. You don&apos;t call it directly
        — you submit the member&apos;s NIN or BVN as part of the enrollment
        body and Pierflow returns the verification disposition alongside
        the enrollment record. This page documents how that step works,
        what we store, and how the disposition rules drive what happens
        next.
      </Body>

      <H2 id="what-we-store">What we store</H2>
      <Body>
        We hold the absolute minimum needed to verify and reconcile, and
        we treat the rest as sensitive PII subject to NDPC.
      </Body>
      <KVTable
        headers={["Field", "How it's stored"]}
        rows={[
          [
            "nin / bvn (plaintext)",
            "Never persisted. Used in-memory during the verification call, then discarded.",
          ],
          [
            "nin_hash / bvn_hash",
            "SHA-256(IDENTITY_HASH_SECRET || identifier). Stable across calls for dedup; not trivially reversible.",
          ],
          [
            "nin_last4 / bvn_last4",
            "Last 4 digits for display in the portal.",
          ],
          [
            "encrypted_payload",
            "AES-256-GCM ciphertext of the original identifiers + supplied profile. Keyed by IDENTITY_ENCRYPTION_KEY (env). Decrypted only by the identity service when re-verifying.",
          ],
          [
            "full_name, date_of_birth, sex",
            "Plain columns — needed to display the member in the portal and to compare against future re-verifications.",
          ],
        ]}
      />

      <Callout kind="info">
        The encryption key + hash secret are env-only. Rotate by issuing a
        new key, re-encrypting the column, then revoking the old key. The
        identity service is the only caller permitted to decrypt; route
        handlers never see the plaintext after the initial submission.
      </Callout>

      <H2 id="providers">Verification providers</H2>
      <Body>
        The implementation is provider-pluggable. The active provider is
        selected by the <code>IDENTITY_PROVIDER</code> env var.
      </Body>
      <KVTable
        headers={["Provider", "When to use", "Behaviour"]}
        rows={[
          [
            "stub (default)",
            "Sandbox, dev, early production while NIMC credentials are being procured.",
            "Returns AUTO_APPROVED at confidence 95 for any name. Magic names TEST_FAIL and TEST_SOFT force REJECTED / SOFT_REVIEW respectively — useful for exercising downstream branches.",
          ],
          [
            "partner_declared",
            "When the fintech has already KYC'd the user upstream and you want a trust-but-audit record.",
            "Returns AUTO_APPROVED at confidence 90. We record the verification row so a future dispute can be audited, but we don't re-call NIMC.",
          ],
          [
            "nimc",
            "Production. Calls the real NIMC API.",
            "Not yet wired in this version. Production deployments must implement runNimc() in lib/insurance/identity.ts before going live; the stub throws if selected without an implementation.",
          ],
        ]}
      />

      <H2 id="disposition">Disposition rules</H2>
      <Body>
        Every verification returns a confidence score 0–100. Three
        dispositions follow from it:
      </Body>
      <KVTable
        headers={["Confidence", "Disposition", "Enrollment outcome"]}
        rows={[
          [
            "> 85",
            "AUTO_APPROVED",
            "Enrollment proceeds normally. Policy issues on payment.",
          ],
          [
            "60 – 85",
            "SOFT_REVIEW",
            "Enrollment proceeds. The IdentityVerification row is flagged for ops review. Useful for ops investigation but doesn't block the user.",
          ],
          [
            "< 60",
            "REJECTED",
            "Enrollment is refused. No enrollment row created. The hmo_enrollment.identity_rejected webhook fires so you can prompt the user to fix their data.",
          ],
        ]}
      />

      <H2 id="response-shape">In the enrollment response</H2>
      <Body>
        The identity outcome is surfaced on every enrollment response:
      </Body>
      <Code language="json">
        {`{
  "enrollment": { /* ... */ },
  "identity": {
    "status": "AUTO_APPROVED",   // AUTO_APPROVED | SOFT_REVIEW | REJECTED
    "confidence": 95,             // 0..100
    "provider": "STUB"            // STUB | PARTNER_DECLARED | NIMC
  },
  "idempotent_replay": false
}`}
      </Code>
      <Body>
        SOFT_REVIEW enrollments succeed but you should surface a note in
        your admin tooling — Pierflow staff will reach out if the
        verification ends up needing manual correction.
      </Body>

      <H2 id="dedup">Dedup &amp; cross-tenant rules</H2>
      <Body>
        The SHA-256 hash is stable for a given identifier across all your
        verifications, which means you can answer &quot;have I verified
        this person before?&quot; without ever storing the plaintext. The
        same hash across two different fintech partners is the same
        person, but Pierflow does not cross-link partners — each fintech
        sees only its own verification history.
      </Body>

      <H3 id="dedup-example">Dedup lookup</H3>
      <Body>
        Not currently exposed as a public endpoint. Use your audit logs
        or contact Pierflow support to confirm whether a NIN already has
        a verification on file for your partner.
      </Body>

      <H2 id="encryption">Encryption at rest</H2>
      <Body>
        AES-256-GCM with a 32-byte key. Wire format:{" "}
        <code>[12B nonce][16B authTag][ciphertext]</code>. The key lives
        in <code>IDENTITY_ENCRYPTION_KEY</code> as 64 hex chars (32 raw
        bytes). Generate with{" "}
        <code>openssl rand -hex 32</code>; never commit to source control.
      </Body>

      <Callout kind="warn">
        For sandbox + dev, an env fallback derives a deterministic key
        from a fixed string so the encrypted column can be read back.
        This fallback MUST NOT ship to production. The service throws on
        an absent key if NODE_ENV=production.
      </Callout>

      <H2 id="auditability">Auditability</H2>
      <Body>
        Every verification — including rejections — writes an{" "}
        <code>IdentityVerification</code> row with the disposition,
        provider, confidence, field-level checks, and the raw provider
        response. Combined with the immutable{" "}
        <code>HmoEnrollmentEvent</code> log, this gives Pierflow and the
        fintech a complete trail for any dispute.
      </Body>

      <PrevNext prev={prev} next={next} />
    </article>
  );
}
