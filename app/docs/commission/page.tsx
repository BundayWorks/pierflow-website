import {
  DocPageHeader,
  H2,
  Body,
  KVTable,
  Code,
  PrevNext,
} from "@/components/docs/primitives";
import { neighbors } from "@/components/docs/nav-helpers";

export default function Page() {
  const { prev, next } = neighbors("commission");
  return (
    <article>
      <DocPageHeader
        eyebrow="Commerce"
        title="Commission & revenue"
        description="How commissions are calculated, split between parties, and settled to your wallet."
      />

      <H2 id="models">Commission models</H2>
      <KVTable
        headers={["Model", "Description", "Example"]}
        rows={[
          ["Flat", "Fixed amount per policy issued", "₦500 per enrollment"],
          ["Percentage", "Percentage of premium collected", "10% of ₦8,500 = ₦850 / month"],
          [
            "Tiered",
            "Rate improves at volume thresholds",
            "0–500: 8% · 501–2,000: 10% · 2,001+: 12%",
          ],
        ]}
      />

      <H2 id="split">Revenue split</H2>
      <Body>
        Each tenant can configure a multi-party split. When a premium is
        collected, the split engine posts to every party&apos;s ledger
        atomically.
      </Body>
      <Code language="json">
        {`{
  "premium": 9350,
  "splits": [
    { "party": "hmo",              "amount": 7650, "percent": 81.8 },
    { "party": "pierflow",         "amount": 850,  "percent": 9.1 },
    { "party": "partner_fintech",  "amount": 850,  "percent": 9.1 }
  ]
}`}
      </Code>

      <H2 id="settlement">Settlement</H2>
      <Body>
        Commissions accumulate in your wallet ledger. Settlement runs weekly
        by default; enterprise partners can request daily. Settlements include
        a per-cycle statement delivered via webhook and email.
      </Body>

      <PrevNext prev={prev} next={next} />
    </article>
  );
}
