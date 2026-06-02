import {
  DocPageHeader,
  H2,
  Body,
  Lead,
  Endpoint,
  Code,
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
        description="Enroll a member into a plan. Identity verification, plan binding with the carrier, and the first premium collection happen in a single request."
      />

      <Lead>
        The enrollment endpoint is the heart of the platform. One POST turns
        into NIMC verification, HMO submission, premium collection, ledger
        entry, and a webhook to your handler.
      </Lead>

      <H2 id="enroll-a-member">Enroll a member</H2>
      <Endpoint method="POST" path="/v1/enrollments" />
      <Code language="json" filename="request">
        {`{
  "hmo_id": "pf_hmo_clearline",
  "plan_id": "pf_plan_silver_ind",
  "member": {
    "first_name": "Amaka",
    "last_name":  "Okeke",
    "date_of_birth": "1997-09-12",
    "bvn": "22********1",
    "phone": "+2348012345678",
    "email": "amaka@example.com"
  },
  "effective_date": "2026-06-01",
  "payment": { "method": "card", "token": "pf_card_tok_..." }
}`}
      </Code>
      <Code language="json" filename="201 Created">
        {`{
  "policy_id": "pf_pol_01HX...",
  "member_id": "pf_mem_01HX...",
  "hmo_native_member_id": "CL-9981273",
  "effective_date": "2026-06-01",
  "fraud_score": 4,
  "identity_confidence": 0.97,
  "premium": { "amount": 9350, "frequency": "monthly", "status": "paid" }
}`}
      </Code>

      <H2 id="idempotency">Idempotency</H2>
      <Body>
        Always send <code>Idempotency-Key</code>. A safe pattern:{" "}
        <code>{`enrl_<date>_<member-hash>_<plan>`}</code>.
      </Body>

      <H2 id="household">Household enrollment</H2>
      <Body>
        For family plans, pass <code>dependants</code>. Each dependant inherits
        the primary&apos;s verification status but receives its own pricing
        and coverage.
      </Body>

      <H2 id="events">Lifecycle events</H2>
      <Body>
        After a successful enrollment, expect these events in your handler:{" "}
        <code>member.created</code>, <code>policy.issued</code>,{" "}
        <code>premium.paid</code>.
      </Body>

      <Callout kind="warn" title="If verification is soft">
        When <code>identity_confidence</code> falls between 0.60 and 0.85, the
        policy is issued with status <code>pending_verification</code>. Surface
        this state to your user so they can complete additional KYC.
      </Callout>

      <PrevNext prev={prev} next={next} />
    </article>
  );
}
