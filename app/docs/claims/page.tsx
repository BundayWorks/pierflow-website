import {
  DocPageHeader,
  H2,
  Lead,
  Endpoint,
  Code,
  KVTable,
  PrevNext,
} from "@/components/docs/primitives";
import { neighbors } from "@/components/docs/nav-helpers";

export default function Page() {
  const { prev, next } = neighbors("claims");
  return (
    <article>
      <DocPageHeader
        eyebrow="Resources"
        title="Claims"
        description="Submit claims with structured intake, track status, and receive AI scoring inline."
      />

      <Lead>
        Pierflow handles claim submission and status tracking. Full
        auto-adjudication is on the roadmap (Phase 2); for MVP, you submit and
        observe.
      </Lead>

      <H2 id="submit-a-claim">Submit a claim</H2>
      <Endpoint method="POST" path="/v1/claims" />
      <Code language="json" filename="request">
        {`{
  "policy_id": "pf_pol_01HX...",
  "provider_id": "pf_prov_reddington",
  "encounter": {
    "type": "outpatient",
    "diagnosis_codes": ["A01.0"],
    "service_date": "2026-06-05"
  },
  "amount_ngn": 45000
}`}
      </Code>
      <Code language="json" filename="202 Accepted">
        {`{
  "claim_id": "pf_clm_01HX...",
  "status": "SUBMITTED",
  "fraud_score": 12,
  "eligibility_confidence": 0.99
}`}
      </Code>

      <H2 id="status-codes">Status codes</H2>
      <KVTable
        headers={["Status", "Description", "Suggested action"]}
        rows={[
          ["SUBMITTED", "Received by Pierflow", "None"],
          ["PENDING_HMO", "Sent to HMO, awaiting acknowledgement", "None"],
          ["UNDER_REVIEW", "HMO is reviewing", "None"],
          ["APPROVED", "Approved for payment", "Notify member"],
          ["REJECTED", "Rejected with reason code", "Surface reason to member"],
          ["PAID", "Disbursed to provider/member", "Notify member"],
        ]}
      />

      <PrevNext prev={prev} next={next} />
    </article>
  );
}
