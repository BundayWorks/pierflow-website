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
  const { prev, next } = neighbors("quotes");
  return (
    <article>
      <DocPageHeader
        eyebrow="Resources"
        title="Quotes"
        description="Submit a user profile, get back ranked HMO plan quotes with rationale, frozen pricing, and a 24-hour validity window."
      />

      <Body>
        A quote is a personalised, time-bound snapshot. You submit a minimal
        user profile (no PII), Pierflow scores every active plan against the
        profile, applies the per-HMO contract math, and returns a ranked
        list. The numbers are frozen so the same quote you displayed in
        comparison flows through to enrollment and settlement.
      </Body>

      <Callout kind="info">
        Requires an API key with the <code>insurance:read</code> scope.
      </Callout>

      <H2 id="create-a-quote">Create a quote</H2>
      <Endpoint method="POST" path="/v1/quotes" />

      <H3 id="profile-shape">Profile shape</H3>
      <KVTable
        headers={["Field", "Required", "Description"]}
        rows={[
          ["age_in_years", "Yes", "Numeric age 0–120."],
          ["sex", "No", "M | F | U. Defaults to U."],
          ["dependents", "No", "Number of dependents to cover. Default 0."],
          [
            "monthly_budget_ngn",
            "No",
            "Budget in NGN minor units (kobo). Influences ranking. Omit for no constraint.",
          ],
          [
            "state",
            "No",
            "User's state. Used by geographic scoring (and plan filtering once provider networks are wired up).",
          ],
          ["lga", "No", "User's LGA."],
          [
            "conditions",
            "No",
            "Self-declared lowercase condition tokens (e.g. ['asthma','diabetes']). Influences exclusion penalty.",
          ],
          [
            "fintech_ref",
            "No",
            "Opaque reference (e.g. your user id + session id). Round-tripped on retrieval.",
          ],
          [
            "limit",
            "No",
            "How many ranked quotes to return. 1–20. Defaults to 5.",
          ],
          [
            "provider_slug",
            "No",
            "Restrict to one HMO. Omit to score across the catalogue.",
          ],
        ]}
      />

      <Callout kind="warn">
        Don&apos;t send full date of birth, BVN, or NIN at quote time. The
        quote step is anonymous by design — identity verification happens at{" "}
        <code>POST /v1/enrollments</code>.
      </Callout>

      <Code language="bash">
        {`curl -X POST https://sandbox.api.pierflow.com/v1/quotes \\
  -H "Authorization: Bearer $PIERFLOW_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "age_in_years": 28,
    "sex": "M",
    "dependents": 0,
    "monthly_budget_ngn": 1000000,
    "state": "Lagos",
    "lga": "Ikeja",
    "limit": 5,
    "fintech_ref": "session_8f3a92"
  }'`}
      </Code>

      <H2 id="quote-response">Response</H2>
      <Code language="json" filename="200 OK">
        {`{
  "request_id": "qreq_b3f9c21a",
  "expires_at": "2026-06-09T12:00:00.000Z",
  "quotes": [
    {
      "id": "quote_a1b2c3d4",
      "plan_id": "plan_silver",
      "rank": 1,
      "score": 0.845,
      "wholesale_ngn": "850000",
      "markup_ngn": "150000",
      "member_pays_ngn": "1000000",
      "rationale": {
        "reasons": [
          "Fits your ₦10,000 monthly budget",
          "Available for age 28",
          "Broad benefit coverage"
        ],
        "warnings": [],
        "signals": {
          "budget": 1,
          "age": 1,
          "dependents": 1,
          "geography": 0.6,
          "coverage": 0.545,
          "exclusionPenalty": 0
        }
      },
      "contract_version": 1,
      "splits_snapshot": {
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
      },
      "expires_at": "2026-06-09T12:00:00.000Z"
    }
  ]
}`}
      </Code>

      <Callout kind="info">
        Money fields are returned as strings to preserve BigInt precision.
        Treat them as integers in kobo and parse explicitly:{" "}
        <code>BigInt(q.wholesale_ngn)</code>.
      </Callout>

      <H2 id="rationale">Rationale shape</H2>
      <Body>
        Every quote carries a <code>rationale</code> with three parts. Render
        any or all of it to the user — it&apos;s designed to be human-honest.
      </Body>
      <KVTable
        headers={["Field", "Description"]}
        rows={[
          [
            "reasons",
            "Positive-signal strings. e.g. 'Fits your ₦10,000 monthly budget'. Show these to justify the recommendation.",
          ],
          [
            "warnings",
            "Negative-signal strings. e.g. 'Plan excludes: HIV'. Show alongside the price so the user sees what they're trading off.",
          ],
          [
            "signals",
            "Per-signal score breakdown (0..1) for audit. Useful for debugging the ranking but rarely shown to end-users.",
          ],
        ]}
      />

      <H2 id="pricing-model">Pricing model</H2>
      <Body>
        The three pricing fields on a quote describe a layered model:
      </Body>
      <KVTable
        headers={["Field", "Meaning"]}
        rows={[
          [
            "wholesale_ngn",
            "What the HMO charges Pierflow. This is the plan's catalogue price.",
          ],
          [
            "markup_ngn",
            "Platform markup added on top. Zero in gross-share contracts, non-zero in markup contracts.",
          ],
          [
            "member_pays_ngn",
            "What the user actually pays. Always wholesale + markup.",
          ],
        ]}
      />
      <Body>
        Decide whether you show the breakdown to the user or just{" "}
        <code>member_pays_ngn</code>. Both are honest. The split per party is
        in <code>splits_snapshot.lines</code>.
      </Body>

      <H2 id="retrieve-a-quote">Retrieve a quote</H2>
      <Endpoint method="GET" path="/v1/quotes/:id" />
      <Body>
        Accepts either a quote id or a quote request id. With a quote id you
        get one quote; with a request id you get the full ranked list. Both
        are scoped to your partner — you only see your own quotes.
      </Body>
      <Code language="bash">
        {`curl https://sandbox.api.pierflow.com/v1/quotes/quote_a1b2c3d4 \\
  -H "Authorization: Bearer $PIERFLOW_KEY"`}
      </Code>

      <H2 id="validity">Validity &amp; expiry</H2>
      <Body>
        Quotes expire 24 hours after creation. After that the{" "}
        <code>expires_at</code> timestamp has elapsed and you must call{" "}
        <code>POST /v1/quotes</code> again. The numbers may change if the HMO
        updated their catalogue, or if you renegotiated the contract — that&apos;s
        why we freeze them per-quote rather than recomputing at enrollment.
      </Body>
      <Callout kind="warn">
        If a user begins enrollment more than 24 hours after seeing a quote,
        re-quote and present the new numbers before charging. Otherwise the
        settlement step will fail because the snapshot has expired.
      </Callout>

      <H2 id="next">Next step</H2>
      <Body>
        Pass <code>quote.id</code> to <code>POST /v1/enrollments</code> when
        the user clicks Buy. Enrollment reads the frozen splits snapshot and
        instructs the settlement layer in your ledger.
      </Body>

      <PrevNext prev={prev} next={next} />
    </article>
  );
}
