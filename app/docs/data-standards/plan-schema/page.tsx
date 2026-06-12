import {
  DocPageHeader,
  H2,
  H3,
  Body,
  Lead,
  Code,
  Callout,
  PrevNext,
} from "@/components/docs/primitives";
import { neighbors } from "@/components/docs/nav-helpers";

export default function Page() {
  const { prev, next } = neighbors("data-standards/plan-schema");
  return (
    <article>
      <DocPageHeader
        eyebrow="Data standards"
        title="Universal Plan Schema"
        description="Every HMO plan — regardless of how the carrier represents it internally — is mapped to this canonical schema before storage and on every API response."
      />

      <Lead>
        A fintech engineer should be able to compare plans from five HMOs
        without learning how any of them define products internally. The
        Universal Plan Schema is how that promise is kept.
      </Lead>

      <H2 id="plan-object">Plan object</H2>
      <Code language="json">
        {`{
  "id": "plan_b3f9c21a",
  "external_id": "REL-SILVER-IND",
  "name": "Silver Plan",
  "scope": "INDIVIDUAL",
  "status": "ACTIVE",
  "billing_frequency": "MONTHLY",
  "hmo": { "slug": "reliance-hmo", "name": "Reliance HMO" },
  "coverage": { /* see below */ },
  "pricing": { /* see below */ },
  "exclusions": ["HIV/AIDS treatment", "Cosmetic surgery"],
  "waiting_periods": { "general": 30, "maternity": 270, "pre_existing": 365 },
  "effective_from": "2026-06-01T00:00:00Z",
  "effective_to": null,
  "last_synced_at": "2026-06-08T08:00:00.000Z",
  "last_verified_at": "2026-06-08T07:55:00.000Z",
  "is_stale": false
}`}
      </Code>

      <Callout kind="info">
        All monetary values are integer kobo (NGN minor units). ₦8,500 is
        stored and returned as 850000.
      </Callout>

      <H3 id="enums">Enums</H3>
      <Body>
        <strong>scope</strong>: INDIVIDUAL | FAMILY | EMPLOYEE_GROUP | STUDENT
        | OTHER. <br />
        <strong>status</strong>: DRAFT | ACTIVE | WITHDRAWN. Only ACTIVE plans
        are surfaced via the consumer API. <br />
        <strong>billing_frequency</strong>: MONTHLY | QUARTERLY | ANNUAL.
      </Body>

      <H2 id="coverage">Coverage</H2>
      <Body>
        Coverage is broken down by benefit class with optional limits, co-pay
        percentages, and per-benefit waiting periods. Unset benefits are
        absent from the object rather than represented as{" "}
        <code>{`{ covered: false }`}</code> — though explicit{" "}
        <code>covered: false</code> is also valid.
      </Body>
      <Code language="json">
        {`{
  "outpatient":   { "covered": true, "limit": 20000000, "co_pay_percent": 0 },
  "inpatient":    { "covered": true, "limit": 100000000, "co_pay_percent": 10 },
  "maternity":    { "covered": true, "limit": 30000000, "waiting_period_days": 270 },
  "dental":       { "covered": false },
  "optical":      { "covered": true, "limit": 3000000 },
  "emergency":    { "covered": true, "limit": 50000000, "co_pay_percent": 0 },
  "telemedicine": { "covered": true, "unlimited": true },
  "diagnostics":  { "covered": true, "limit": 5000000 },
  "pharmacy":     { "covered": true },
  "mental_health":{ "covered": false },
  "wellness":     { "covered": true }
}`}
      </Code>
      <Body>
        Benefit classes that don&apos;t have a top-level key (a future
        addition) appear under <code>coverage.extras</code> with the same
        shape.
      </Body>

      <H2 id="pricing">Pricing</H2>
      <Body>
        Pricing carries a fallback <code>individual_monthly</code> plus an
        ordered list of <code>age_bands</code>. The engine walks the bands;
        if no band contains the user&apos;s age, the fallback applies.
        Optional <code>family_rate</code> overrides for FAMILY-scoped plans.
      </Body>
      <Code language="json">
        {`{
  "individual_monthly": 850000,
  "age_bands": [
    { "min_age": 0,  "max_age": 17, "monthly": 600000 },
    { "min_age": 18, "max_age": 35, "monthly": 850000 },
    { "min_age": 36, "max_age": 50, "monthly": 1100000 },
    { "min_age": 51, "max_age": 65, "monthly": 1600000 }
  ],
  "family_rate": 2500000,
  "employer_discount_percent": 15
}`}
      </Code>

      <H2 id="exclusions">Exclusions &amp; waiting periods</H2>
      <Body>
        Exclusions are plain strings — render them as-is. Waiting periods are
        days. Surface these prominently in your UI; they&apos;re the source
        of most member disputes.
      </Body>
      <Code language="json">
        {`{
  "exclusions": ["HIV/AIDS treatment", "Cosmetic surgery", "Pre-existing conditions"],
  "waiting_periods": { "general": 30, "maternity": 270, "pre_existing": 365 }
}`}
      </Code>

      <Callout kind="tip">
        New benefit classes may appear (additive change). Render unknown keys
        gracefully — don&apos;t hard-code a closed list.
      </Callout>

      <PrevNext prev={prev} next={next} />
    </article>
  );
}
