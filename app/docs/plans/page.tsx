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
  const { prev, next } = neighbors("plans");
  return (
    <article>
      <DocPageHeader
        eyebrow="Resources"
        title="Plans"
        description="Browse the HMO plan catalogue. Every plan is returned in the Universal Plan Schema, regardless of the source HMO's internal format."
      />

      <Body>
        Plans are the browseable inventory. Use{" "}
        <code>GET /v1/plans</code> for a paginated, filterable list and{" "}
        <code>GET /v1/plans/:id</code> for a single plan&apos;s detail. For
        personalised ranking against a specific user profile, use{" "}
        <code>POST /v1/quotes</code> instead.
      </Body>

      <Callout kind="info">
        Requires an API key with the <code>insurance:read</code> scope. Legacy
        keys without an explicit scope list are granted all scopes for
        backwards compatibility.
      </Callout>

      <H2 id="list-plans">List plans</H2>
      <Endpoint method="GET" path="/v1/plans" />
      <Body>
        Returns active plans across every HMO Pierflow has currently
        distributing. Cursor-paginated; default page size 50, max 200.
      </Body>

      <H3 id="filters">Query parameters</H3>
      <KVTable
        headers={["Parameter", "Description"]}
        rows={[
          ["cursor", "Pagination cursor from a previous response."],
          ["limit", "Page size, 1–200. Defaults to 50."],
          ["status", "DRAFT | ACTIVE | WITHDRAWN. Defaults to ACTIVE."],
          ["scope", "INDIVIDUAL | FAMILY | EMPLOYEE_GROUP | STUDENT | OTHER."],
          ["provider_slug", "Restrict to one HMO (e.g. reliance-hmo)."],
          ["state", "User's state — filters plans without coverage there."],
          ["lga", "User's LGA. Used alongside state."],
          [
            "max_monthly_premium_ngn",
            "Maximum monthly premium in NGN minor units (kobo).",
          ],
          [
            "age_in_years",
            "Drops plans whose age bands don't cover this age.",
          ],
        ]}
      />

      <Code language="bash">
        {`curl https://sandbox.api.pierflow.com/v1/plans?scope=INDIVIDUAL&max_monthly_premium_ngn=1000000&age_in_years=28 \\
  -H "Authorization: Bearer $PIERFLOW_KEY"`}
      </Code>

      <H3 id="list-response">Response</H3>
      <Code language="json" filename="200 OK">
        {`{
  "items": [
    {
      "id": "plan_b3f9c21a",
      "external_id": "REL-SILVER-IND",
      "name": "Silver Plan",
      "scope": "INDIVIDUAL",
      "status": "ACTIVE",
      "billing_frequency": "MONTHLY",
      "hmo": { "slug": "reliance-hmo", "name": "Reliance HMO" },
      "pricing": {
        "individual_monthly": 850000,
        "age_bands": [
          { "min_age": 18, "max_age": 35, "monthly": 850000 },
          { "min_age": 36, "max_age": 50, "monthly": 1100000 }
        ]
      },
      "coverage": {
        "outpatient":   { "covered": true, "limit": 20000000, "co_pay_percent": 0 },
        "inpatient":    { "covered": true, "limit": 100000000, "co_pay_percent": 10 },
        "maternity":    { "covered": true, "limit": 30000000, "waiting_period_days": 270 },
        "dental":       { "covered": false },
        "telemedicine": { "covered": true, "unlimited": true }
      },
      "exclusions": ["HIV/AIDS treatment", "Cosmetic surgery"],
      "waiting_periods": { "general": 30, "maternity": 270, "pre_existing": 365 },
      "last_synced_at": "2026-06-08T08:00:00.000Z",
      "last_verified_at": "2026-06-08T07:55:00.000Z",
      "is_stale": false
    }
  ],
  "next_cursor": "plan_xyz123"
}`}
      </Code>

      <Callout kind="info">
        Money is always in NGN minor units (kobo). 850000 kobo = ₦8,500. The
        same convention applies to every monetary field across the API.
      </Callout>

      <H2 id="retrieve-a-plan">Retrieve a plan</H2>
      <Endpoint method="GET" path="/v1/plans/:planId" />
      <Body>
        Same shape as a single item in the list response. Returns 404 if the
        plan belongs to an HMO that isn&apos;t currently distributing —
        suspended or pending providers are hidden.
      </Body>
      <Code language="bash">
        {`curl https://sandbox.api.pierflow.com/v1/plans/plan_b3f9c21a \\
  -H "Authorization: Bearer $PIERFLOW_KEY"`}
      </Code>

      <H2 id="freshness">Freshness</H2>
      <Body>
        Every plan carries three time signals so the fintech UI can show
        honest data:
      </Body>
      <KVTable
        headers={["Field", "Meaning"]}
        rows={[
          [
            "last_synced_at",
            "When the HMO last pushed this plan to Pierflow.",
          ],
          [
            "last_verified_at",
            "When Pierflow last asked the HMO to re-confirm the plan is unchanged. Present after a live verify call.",
          ],
          [
            "is_stale",
            "True when the soft TTL has elapsed since the last sync. Surface a 'data may be stale' hint when true.",
          ],
        ]}
      />
      <Body>
        For binding actions — enrollment, locking a quote — Pierflow performs
        a live verification with the HMO before proceeding. Browse responses
        use the cached view; quote responses freeze numbers for 24 hours.
      </Body>

      <PrevNext prev={prev} next={next} />
    </article>
  );
}
