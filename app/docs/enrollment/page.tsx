import {
  DocPageHeader,
  H2,
  H3,
  Body,
  Endpoint,
  Code,
  KVTable,
  Callout,
  PrevNext,
} from "@/components/docs/primitives";
import { neighbors } from "@/components/docs/nav-helpers";

export default function Page() {
  const { prev, next } = neighbors("enrollment");
  return (
    <article>
      <DocPageHeader
        eyebrow="Resources"
        title="Enrollment"
        description="Convert a quote into a real HMO policy. Pierflow verifies identity, computes settlement splits, issues the policy through the HMO connector, and ships a settlement instruction back so your ledger can credit each party."
      />

      <Body>
        Enrollment is the binding action: the user is committing to a plan,
        money is about to move, and the HMO is about to take them on as a
        member. Treat the call as the moment of commitment in your UX —
        don&apos;t POST until the user clicks Buy.
      </Body>

      <Callout kind="info">
        Mutations require the <code>insurance:write</code> scope; reads
        require <code>insurance:read</code>. Legacy keys without an
        explicit scope list are granted all scopes for backwards
        compatibility.
      </Callout>

      <H2 id="lifecycle">Lifecycle</H2>
      <Body>
        Enrollments move through up to six states. The transitions are
        deterministic and you can observe each one via webhook (see{" "}
        <a href="/docs/webhooks" className="text-accent-emerald hover:underline">
          Webhooks
        </a>
        ).
      </Body>
      <KVTable
        headers={["State", "Meaning"]}
        rows={[
          [
            "CREATED",
            "Brief intermediate state immediately after POST /v1/enrollments. Transitions to PENDING_PAYMENT in the same request.",
          ],
          [
            "PENDING_PAYMENT",
            "Identity verified; we're waiting for you to debit the user's wallet and call /payment-received.",
          ],
          [
            "PENDING_HMO",
            "Payment confirmed; we're calling the HMO to issue the policy. Usually milliseconds.",
          ],
          [
            "ACTIVE",
            "HMO returned a policy id. The user is covered. hmo_policy_id and hmo_member_id are now populated.",
          ],
          [
            "FAILED",
            "Terminal. The HMO rejected the enrollment. Refund the user from the cancellation flow.",
          ],
          [
            "CANCELLED",
            "Terminal. The user, fintech, or HMO terminated the policy. cancelled_at and cancellation_reason populated.",
          ],
        ]}
      />

      <H2 id="enroll-a-member">Enroll a member</H2>
      <Endpoint method="POST" path="/v1/enrollments" />
      <Body>
        Returns <code>202 Accepted</code> with the enrollment record in
        PENDING_PAYMENT state. Identity verification runs synchronously
        before the response — see <code>identity</code> in the response.
      </Body>

      <H3 id="enrollment-body">Request body</H3>
      <KVTable
        headers={["Field", "Required", "Description"]}
        rows={[
          [
            "plan_id",
            "Yes",
            "Pierflow plan id from GET /v1/plans or a quote.",
          ],
          [
            "quote_id",
            "Conditional",
            "Strongly recommended. When supplied, the frozen wholesale + markup + splits from the quote are used. Without a quote we compute fresh splits at the wholesale price — which may differ from what the user saw.",
          ],
          [
            "fintech_user_ref",
            "Yes",
            "Your own user reference. Round-tripped on every event + webhook.",
          ],
          [
            "idempotency_key",
            "No",
            "Any opaque string. Same key under the same partner returns the existing enrollment for 24 hours — safe to retry.",
          ],
          [
            "identity.nin or identity.bvn",
            "One required",
            "11-digit NIN or BVN. Stored as a SHA-256 hash + last-4; the plaintext is AES-256-GCM encrypted at rest and only ever decrypted by the identity service.",
          ],
          [
            "identity.full_name",
            "Yes",
            "Member's legal name.",
          ],
          [
            "identity.date_of_birth",
            "Yes",
            "ISO date (YYYY-MM-DD).",
          ],
          ["identity.sex", "No", "M | F | U."],
          ["identity.phone", "No", "Display + future SMS notifications."],
          [
            "effective_from",
            "No",
            "ISO datetime. When the policy should start. Defaults to the HMO's response, typically today.",
          ],
        ]}
      />

      <Code language="bash">
        {`curl -X POST https://sandbox.api.pierflow.com/v1/enrollments \\
  -H "Authorization: Bearer $PIERFLOW_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "plan_id": "plan_b3f9c21a",
    "quote_id": "quote_a1b2c3d4",
    "fintech_user_ref": "user_8821",
    "idempotency_key": "enr_user_8821_silver_v1",
    "identity": {
      "nin": "12345678901",
      "full_name": "Adaeze Margaret Nwosu",
      "date_of_birth": "1985-03-14",
      "sex": "F",
      "phone": "+2348012345678"
    }
  }'`}
      </Code>

      <H3 id="enrollment-response">Response</H3>
      <Code language="json" filename="202 Accepted">
        {`{
  "enrollment": {
    "id": "enr_9k3jx2p7",
    "partner_id": "ptr_fintechco",
    "provider_id": "prov_reliance",
    "plan_id": "plan_b3f9c21a",
    "quote_id": "quote_a1b2c3d4",
    "fintech_user_ref": "user_8821",
    "hmo_policy_id": null,
    "hmo_member_id": null,
    "status": "PENDING_PAYMENT",
    "effective_from": null,
    "effective_to": null,
    "wholesale_ngn": "850000",
    "markup_ngn": "150000",
    "member_pays_ngn": "1000000",
    "splits_snapshot": { /* same shape as quote.splits_snapshot */ },
    "contract_version": 1,
    "created_at": "2026-06-08T12:00:00.000Z",
    "updated_at": "2026-06-08T12:00:00.000Z"
  },
  "identity": {
    "status": "AUTO_APPROVED",
    "confidence": 95,
    "provider": "STUB"
  },
  "idempotent_replay": false
}`}
      </Code>

      <Callout kind="info">
        <strong>Sandbox magic names.</strong> In sandbox, the identity stub
        looks at the full name: include <code>TEST_FAIL</code> and identity
        returns REJECTED (the enrollment is refused); include{" "}
        <code>TEST_SOFT</code> and you get SOFT_REVIEW (the enrollment
        proceeds but the identity row is flagged for manual review).
        Anything else returns AUTO_APPROVED at confidence 95.
      </Callout>

      <H2 id="payment-received">Confirm payment received</H2>
      <Endpoint
        method="POST"
        path="/v1/enrollments/:id/payment-received"
      />
      <Body>
        Once you&apos;ve debited the user&apos;s wallet for the full{" "}
        <code>member_pays_ngn</code>, call this endpoint. It moves the
        enrollment PENDING_PAYMENT → PENDING_HMO → ACTIVE by calling the
        HMO connector synchronously. Idempotent — calling twice after the
        enrollment is ACTIVE returns success without re-charging.
      </Body>
      <KVTable
        headers={["Field", "Required", "Description"]}
        rows={[
          [
            "amount_ngn",
            "Yes",
            "Amount debited, in kobo. Must equal member_pays_ngn — we return AMOUNT_MISMATCH otherwise.",
          ],
          [
            "payment_ref",
            "No",
            "Your internal payment reference. Stored on the PAYMENT_RECEIVED event for reconciliation.",
          ],
        ]}
      />
      <Code language="bash">
        {`curl -X POST https://sandbox.api.pierflow.com/v1/enrollments/enr_9k3jx2p7/payment-received \\
  -H "Authorization: Bearer $PIERFLOW_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{ "amount_ngn": "1000000", "payment_ref": "wallet_txn_42" }'`}
      </Code>

      <H2 id="cancel">Cancel an enrollment</H2>
      <Endpoint method="POST" path="/v1/enrollments/:id/cancel" />
      <Body>
        Terminates the policy. If the HMO already issued one we call the
        connector to terminate on their side too. Cannot be undone.
      </Body>
      <Code language="bash">
        {`curl -X POST https://sandbox.api.pierflow.com/v1/enrollments/enr_9k3jx2p7/cancel \\
  -H "Authorization: Bearer $PIERFLOW_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{ "reason": "user_requested" }'`}
      </Code>

      <H2 id="retrieve">Retrieve an enrollment</H2>
      <Endpoint method="GET" path="/v1/enrollments/:id" />
      <Endpoint
        method="GET"
        path="/v1/enrollments?fintech_user_ref=..."
      />
      <Body>
        Returns the same shape as the create response. The list-by-ref
        endpoint is useful for &quot;show this user&apos;s policies&quot;
        surfaces in the fintech app.
      </Body>

      <H2 id="settlement">Settlement instruction</H2>
      <Body>
        Every enrollment carries <code>splits_snapshot</code> — the same
        shape you saw on the quote. Use it to credit each party in your
        ledger:
      </Body>
      <Code language="json">
        {`{
  "mode": "MARKUP_FIXED",
  "wholesale_ngn": "850000",
  "markup_ngn": "150000",
  "member_pays_ngn": "1000000",
  "hmo_line": { "role": "HMO", "amount_ngn": "850000", "settlement_tag": null },
  "lines": [
    { "role": "PIERFLOW", "amount_ngn": "20000", "settlement_tag": "pierflow:platform_fee", "is_remainder": false },
    { "role": "EMR_VENDOR", "amount_ngn": "30000", "settlement_tag": "emr_vendor:default", "is_remainder": false },
    { "role": "FINTECH", "amount_ngn": "100000", "settlement_tag": "fintech:self", "is_remainder": true }
  ]
}`}
      </Code>
      <Body>
        The HMO is paid the wholesale amount directly. The platform parties
        (you, Pierflow, EMR vendor) split the markup. The{" "}
        <code>settlement_tag</code> on each line is your hint about where
        the credit goes in your ledger — agreed during HMO onboarding.
      </Body>

      <H2 id="events">Lifecycle events &amp; webhooks</H2>
      <KVTable
        headers={["Event", "Fires when"]}
        rows={[
          ["hmo_enrollment.created", "POST /v1/enrollments succeeded."],
          [
            "hmo_enrollment.identity_verified",
            "Identity check returned AUTO_APPROVED or SOFT_REVIEW.",
          ],
          [
            "hmo_enrollment.identity_rejected",
            "Identity returned REJECTED. No enrollment row created. enrollment_id is null in the payload.",
          ],
          [
            "hmo_enrollment.payment_received",
            "POST /payment-received succeeded; we're calling the HMO.",
          ],
          [
            "hmo_enrollment.submitted_to_hmo",
            "Same instant — included separately so you can correlate with HMO-side latency.",
          ],
          [
            "hmo_enrollment.activated",
            "HMO confirmed the policy; status flipped to ACTIVE.",
          ],
          [
            "hmo_enrollment.hmo_rejected",
            "HMO refused. Status flips to FAILED; this event is followed by hmo_enrollment.failed.",
          ],
          [
            "hmo_enrollment.failed",
            "Terminal failure event — pair with hmo_enrollment.hmo_rejected.",
          ],
          [
            "hmo_enrollment.cancelled",
            "POST /cancel succeeded.",
          ],
        ]}
      />

      <H2 id="idempotency">Idempotency</H2>
      <Body>
        Pass <code>idempotency_key</code> on POST /v1/enrollments. Repeated
        calls with the same key under the same partner within 24 hours
        return the existing enrollment unchanged — the response carries{" "}
        <code>idempotent_replay: true</code> so you can log it. The key is
        any string ≤200 chars; we recommend including your user reference
        and the plan id to disambiguate.
      </Body>

      <H2 id="quote-binding">Quote binding</H2>
      <Body>
        When you pass <code>quote_id</code>, the enrollment inherits the
        quote&apos;s frozen wholesale + markup + splits exactly. This is
        the safe path: the numbers the user saw at comparison are the
        numbers they pay. If the quote has expired (24h after creation),
        the call returns 404 — re-quote and show the user the new numbers
        before charging.
      </Body>
      <Callout kind="warn">
        Without <code>quote_id</code>, the enrollment is priced fresh from
        the current plan + active contract. The numbers may differ from
        what the user saw if the HMO updated the catalogue or you
        renegotiated the contract.
      </Callout>

      <PrevNext prev={prev} next={next} />
    </article>
  );
}
