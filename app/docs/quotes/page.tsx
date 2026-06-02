import {
  DocPageHeader,
  H2,
  Body,
  Endpoint,
  Code,
  KVTable,
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
        description="A quote returns a comparable array of packages from every eligible HMO, with pricing rules and AI scores applied."
      />

      <H2 id="create-a-quote">Create a quote</H2>
      <Endpoint method="POST" path="/v1/quotes" />
      <Body>
        Provide the member profile. Pierflow queries every eligible HMO
        connector in parallel, normalises responses, applies your pricing
        rules, and returns a ranked array.
      </Body>
      <Code language="json" filename="request">
        {`{
  "member": { "age": 28, "state": "Lagos" },
  "audience": "individual",
  "budget_ngn": 120000,
  "include_hmos": ["pf_hmo_clearline", "pf_hmo_bastion"]
}`}
      </Code>

      <H2 id="quote-response">Quote response</H2>
      <Code language="json" filename="200 OK">
        {`{
  "quote_id": "pf_quote_01HX...",
  "expires_at": "2026-06-01T10:00:00Z",
  "member": { "age": 28, "state": "Lagos" },
  "packages": [
    {
      "rank": 1,
      "plan": { /* Universal Plan Schema */ },
      "pricing": {
        "base_premium": 8500,
        "employer_subsidy": 0,
        "partner_fee": 850,
        "member_pays": 9350,
        "frequency": "monthly"
      },
      "coverage_score": 78,
      "value_score": 82
    }
  ]
}`}
      </Code>

      <H2 id="pricing-rules">Pricing rules</H2>
      <KVTable
        headers={["Rule", "Description"]}
        rows={[
          ["Age band", "Premium varies by age range, defined per plan"],
          ["Family", "Flat or per-member discount when family_size > 1"],
          ["Employer", "Group discount for enrollments with employer_id"],
          ["Geographic loading", "State-level loading per HMO"],
          ["Subsidy", "Government or employer subsidy applied per tenant"],
          ["Partner markup", "Your own margin on top of base premium"],
        ]}
      />

      <PrevNext prev={prev} next={next} />
    </article>
  );
}
