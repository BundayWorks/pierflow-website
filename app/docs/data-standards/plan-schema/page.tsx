import {
  DocPageHeader,
  H2,
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
  "plan_id": "pf_plan_01HX...",
  "hmo_id": "pf_hmo_clearline",
  "name": "Silver Plan",
  "tier": "standard",
  "annual_limit": 1500000,
  "currency": "NGN",
  "coverage": { /* see below */ },
  "exclusions": ["HIV/AIDS treatment", "Cosmetic surgery", "Pre-existing conditions"],
  "waiting_periods": { "general": 30, "maternity": 270, "pre_existing": 365 },
  "pricing": { /* see below */ }
}`}
      </Code>

      <H2 id="coverage">Coverage</H2>
      <Body>
        Coverage is broken down by benefit class with limits and co-pay
        percentages. Unset benefits are absent rather than null.
      </Body>
      <Code language="json">
        {`{
  "outpatient":   { "covered": true, "limit": 200000, "co_pay_percent": 0 },
  "inpatient":    { "covered": true, "limit": 1000000, "co_pay_percent": 10 },
  "maternity":    { "covered": true, "limit": 300000, "waiting_period_days": 270 },
  "dental":       { "covered": false },
  "optical":      { "covered": true, "limit": 30000 },
  "emergency":    { "covered": true, "limit": 500000, "co_pay_percent": 0 },
  "telemedicine": { "covered": true, "unlimited": true }
}`}
      </Code>

      <H2 id="pricing">Pricing</H2>
      <Body>
        Pricing is structured for both individual and group lookups, with age
        bands and employer discounts baked in.
      </Body>
      <Code language="json">
        {`{
  "individual_monthly": 8500,
  "age_bands": [
    { "min_age": 0,  "max_age": 17, "monthly": 6000 },
    { "min_age": 18, "max_age": 35, "monthly": 8500 },
    { "min_age": 36, "max_age": 50, "monthly": 11000 },
    { "min_age": 51, "max_age": 65, "monthly": 16000 }
  ],
  "family_rate": 25000,
  "employer_discount_percent": 15
}`}
      </Code>

      <H2 id="exclusions">Exclusions & waiting periods</H2>
      <Body>
        Surface these prominently in your UI — they&apos;re the source of most
        member disputes. The platform exposes them as plain strings so they
        can be rendered without translation.
      </Body>

      <Callout kind="tip">
        New benefit classes may appear (additive change). Render unknown keys
        gracefully — don&apos;t hard-code a closed list.
      </Callout>

      <PrevNext prev={prev} next={next} />
    </article>
  );
}
