import {
  DocPageHeader,
  H2,
  Lead,
  Body,
  KVTable,
  Callout,
  PrevNext,
} from "@/components/docs/primitives";
import { neighbors } from "@/components/docs/nav-helpers";

export default function Page() {
  const { prev, next } = neighbors("records/confidence");
  return (
    <article>
      <DocPageHeader
        eyebrow="Records API"
        title="Confidence & review"
        description="Pierflow tells you how confident it is in every field it extracts. Low-confidence records are routed to human review before they ever reach your importer."
      />

      <Lead>
        Confidence is the contract: by the time a patient bundle reaches your
        Import Package, it has either been auto-approved (high confidence) or
        signed off by a human reviewer.
      </Lead>

      <H2 id="record-status">Record status</H2>
      <KVTable
        headers={["Status", "Meaning for you"]}
        rows={[
          ["VALIDATED", "Ready to import. Will appear in the next Import Package."],
          ["AWAITING_REVIEW", "Held in Pierflow for human review. Not in any Import Package yet."],
          ["IMPORTED", "Acknowledged by an importer for this organization."],
          ["REJECTED", "Marked unusable by a reviewer (e.g. illegible original). Not delivered."],
        ]}
      />

      <H2 id="reviewer-portal">Review workflow</H2>
      <Body>
        Records below the auto-approval threshold show up in the Pierflow
        review portal, where a clinical reviewer corrects fields against the
        original page image and approves the record. Approved records flow
        into the next Import Package automatically — your integration
        doesn&apos;t need to do anything different.
      </Body>

      <H2 id="sla">Review SLAs</H2>
      <KVTable
        headers={["Batch priority", "Target completion"]}
        rows={[
          ["URGENT", "Within 4 hours of ingestion"],
          ["NORMAL — high-risk records", "Within 8 hours"],
          ["NORMAL — standard records", "Within 24 hours"],
        ]}
      />

      <Callout kind="info" title="Why this matters">
        Many extraction tools dump every record on you regardless of quality.
        Pierflow filters quality upstream — so your importer never sees a
        half-extracted, low-confidence record without a human having signed
        off on it.
      </Callout>

      <PrevNext prev={prev} next={next} />
    </article>
  );
}
