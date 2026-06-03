import {
  DocPageHeader,
  H2,
  Lead,
  Body,
  KVTable,
  Callout,
  CtaRow,
  PrevNext,
} from "@/components/docs/primitives";
import { neighbors } from "@/components/docs/nav-helpers";
import { Rocket, FileText, ShieldCheck } from "lucide-react";

export default function Page() {
  const { prev, next } = neighbors("records/overview");
  return (
    <article>
      <DocPageHeader
        eyebrow="Records API"
        title="Records API"
        description="Turn paper-based patient records into validated, FHIR R4-compliant data your EMR, HMS, or partner system can import in one call."
      />

      <CtaRow
        items={[
          {
            label: "Quickstart",
            href: "/docs/records/ingest",
            icon: <Rocket size={14} />,
          },
          {
            label: "FHIR bundle reference",
            href: "/docs/records/patients",
            icon: <FileText size={14} />,
          },
          {
            label: "Security & NDPR",
            href: "/docs/security",
            icon: <ShieldCheck size={14} />,
          },
        ]}
      />

      <H2 id="how-it-works">How it works</H2>
      <Lead>
        You send Pierflow scanned pages. Pierflow returns structured patient
        records — already mapped to FHIR R4 — ready to import.
      </Lead>
      <Body>
        Behind the API, every page is normalised, extracted, validated, and
        either auto-approved or routed to human review when confidence is low.
        Your integration sees a single, consistent response shape — you don&apos;t
        need to handle any of the underlying pipeline.
      </Body>

      <H2 id="who-its-for">Who it&apos;s for</H2>
      <KVTable
        headers={["You are…", "What you use the Records API for"]}
        rows={[
          [
            "EMR / EHR vendor",
            "Activate hospital and clinic clients by pulling their historical paper records into your platform on day one.",
          ],
          [
            "HMS vendor",
            "Make HMS go-lives meaningful — the platform isn't empty when your customer switches on.",
          ],
          [
            "Hospital or clinic group",
            "Migrate decades of records into your chosen digital system without manual data entry.",
          ],
          [
            "Diagnostic lab",
            "Lift archived lab result sheets into a structured, searchable record set.",
          ],
          [
            "Insurer / HMO",
            "Reconcile member coverage with documented care from provider archives.",
          ],
          [
            "Government or public health programme",
            "Population-level digitisation of facility records for analytics and continuity of care.",
          ],
        ]}
      />

      <H2 id="what-you-get">What you get back</H2>
      <Body>
        For every approved record, you receive a <strong>FHIR R4 Bundle</strong>{" "}
        containing the relevant resources — typically{" "}
        <code>Patient</code>, <code>Encounter</code>, <code>Observation</code>,{" "}
        <code>Condition</code>, and <code>MedicationRequest</code>. For batch
        consumption, records are assembled into{" "}
        <a
          href="/docs/records/packages"
          className="text-accent-emerald underline"
        >
          Import Packages
        </a>{" "}
        you download as a single ZIP.
      </Body>

      <Callout kind="info" title="Standards-aligned by default">
        Output conforms to FHIR R4. Diagnoses carry ICD-10 codes, vitals carry
        LOINC codes, medications carry ATC codes. You shouldn&apos;t need to
        translate anything to import into a modern clinical system.
      </Callout>

      <PrevNext prev={prev} next={next} />
    </article>
  );
}
