import {
  DocPageHeader,
  H2,
  H3,
  Body,
  Code,
  Callout,
  PrevNext,
} from "@/components/docs/primitives";
import { neighbors } from "@/components/docs/nav-helpers";

export default function Page() {
  const { prev, next } = neighbors("patient-mapping");
  return (
    <article>
      <DocPageHeader
        eyebrow="Records API"
        title="Patient mapping"
        description="How Pierflow groups multi-page charts during capture, detects duplicate Patient rows, and maps Pierflow patient ids to your EMR's ids — end to end."
      />

      <Body>
        Real paper migration produces three problems Pierflow solves before
        records reach your EMR:
      </Body>
      <Body>
        <strong>1.</strong> A patient&apos;s chart spans many pages. Page 1 has
        their name and MRN. Pages 2–47 are lab printouts and continuation
        sheets with no patient header. Without grouping, we&apos;d emit 47
        independent records, 38 of them orphans.
      </Body>
      <Body>
        <strong>2.</strong> The same patient registers under two different
        spellings, or with a missing DOB, and ends up as two Patient rows.
      </Body>
      <Body>
        <strong>3.</strong> Your EMR has its own patient ids. You need to look
        up Pierflow data using <em>your</em> id, not ours.
      </Body>
      <Body>
        Three primitives address each in turn:{" "}
        <strong>chart folders</strong> (intra-batch grouping),{" "}
        <strong>duplicate detection</strong> (post-capture dedupe), and{" "}
        <strong>partner patient links</strong> (Pierflow id ↔ your id).
      </Body>

      {/* ── Chart folders ─────────────────────────────────── */}
      <H2 id="chart-folders">Chart folders</H2>
      <Body>
        A <code>ChartFolder</code> groups every page from one patient&apos;s
        chart so identity is resolved at folder level, not per page. The
        operator opens a chart, photographs N pages, then closes it. Every
        ProcessingJob carries the folder id; the resolver picks a Patient
        once the folder closes and every job is terminal.
      </Body>

      <H3 id="declarations">Operator declarations</H3>
      <Body>
        When opening a chart, the operator can declare:
      </Body>
      <Body>
        <strong>Pick an existing patient</strong> — search by name or
        identifier. Sets <code>declaredPatientId</code>. Resolution short-
        circuits to <code>DECLARED_BY_OPERATOR</code> the moment the chart
        closes, regardless of extraction state. Late-arriving records auto-
        attach when their extraction lands.
      </Body>
      <Body>
        <strong>Type an MRN</strong> — sets <code>declaredMrn</code>. We
        look up the MRN under the org&apos;s <code>mrnSystem</code> URI. If
        a Patient has it, resolution becomes <code>MRN_LOOKUP</code>.
      </Body>
      <Body>
        <strong>Just start capturing</strong> — no declaration. Resolution
        runs purely on extracted evidence (name + DOB tuple, with any MRN
        we see on any page in the folder). Falls back to{" "}
        <code>FUZZY_MATCH</code> or <code>NEW_PATIENT</code>.
      </Body>

      <H3 id="api-grouping">Telling the API about a chart</H3>
      <Body>
        Programmatic ingest passes the same <code>chartFolderId</code> on
        every <code>/v1/ingest/documents</code> call for that chart. The
        folder is created server-side by the capture portal; pure-API
        partners can manage their own ids in the future, but for now use
        capture or the partner-side endpoint we ship next.
      </Body>
      <Code language="HTTP" filename="POST /v1/ingest/documents">
{`{
  "organizationId": "org_lagoon_hospital",
  "batchId": "bat_3xMA…",
  "chartFolderId": "cf_8KqL…",
  "source": {
    "publicId": "pierflow/…/page_002",
    "secureUrl": "https://res.cloudinary.com/…/page_002.png"
  },
  "documentType": "OUTPATIENT_CARD"
}`}
      </Code>

      <H3 id="lifecycle">Folder lifecycle</H3>
      <Body>
        Folders have one of five effective states:
      </Body>
      <Body>
        <code>OPEN</code> — operator is still capturing. New pages welcome.
      </Body>
      <Body>
        <code>EXTRACTING</code> — closed; at least one job hasn&apos;t reached
        a terminal state yet. Resolution will trigger when it does.
      </Body>
      <Body>
        <code>RESOLVED</code> — patient picked. Every record points at it.
        <code>resolvedSource</code> tells you which branch fired.
      </Body>
      <Body>
        <code>UNRESOLVED_NO_EVIDENCE</code> — closed, all jobs terminal, but
        no patient block was extractable and no declaration was made. Surface
        a &quot;Resolve now&quot; affordance to your reviewer if you want to
        force a retry.
      </Body>
      <Body>
        <code>FAILED_NO_RESOLUTION</code> — closed, every job failed
        extraction. Reviewer intervention required.
      </Body>

      {/* ── Duplicates ─────────────────────────────────── */}
      <H2 id="duplicates">Duplicate detection</H2>
      <Body>
        A nightly cron walks every ACTIVE organisation and scores Patient
        pairs for likely duplication. Writes a{" "}
        <code>PatientMergeCandidate</code> row per pair; reviewers confirm in
        the staff portal&apos;s Merge queue tab.
      </Body>

      <H3 id="scoring">How candidates are scored</H3>
      <Body>
        <strong>Score 1.0 — MRN match.</strong> Same identifier value under
        the same MRN system URI. By definition, same person. Auto-flagged,
        never auto-merged.
      </Body>
      <Body>
        <strong>Score 0.55–0.95 — Name + DOB.</strong> Token-set name ratio
        weighted at 0.65, DOB equality at 0.25, sex match at 0.1. We bucket
        candidates by DOB to keep the comparison tractable on large orgs.
      </Body>

      <H3 id="merging">Accepting a merge</H3>
      <Body>
        Confirming a merge re-parents every <code>ExtractedRecord</code>,
        <code>ChartFolder</code> declaration, and <code>PatientIdentifier</code>{" "}
        from the candidate to the primary in one transaction. Identifier
        collisions are deduped. The candidate is soft-deleted via{" "}
        <code>possibleDuplicateOfId</code> so the next scoring pass ignores
        it.
      </Body>
      <Callout kind="info">
        We never auto-merge — even on score 1.0. A reviewer is in the loop on
        every merge. This is intentional: an EMR vendor can&apos;t justify a
        merge to a clinical user without a paper trail.
      </Callout>

      {/* ── Partner patient links ───────────────────────── */}
      <H2 id="partner-links">Partner patient links</H2>
      <Body>
        A <code>PartnerPatientLink</code> maps a Pierflow Patient id to your
        EMR&apos;s patient id. Once a link exists, you can query Pierflow
        with your own id and the FHIR response carries it back as an
        Identifier so round-trips are self-describing.
      </Body>

      <H3 id="creating-links">Creating links</H3>
      <Body>
        <strong>During cohort onboarding</strong> — POST{" "}
        <code>/v1/partner-patient-links/bulk</code> with up to 500{" "}
        <code>(mrn, external_id)</code> pairs. We resolve each MRN under the
        org&apos;s <code>mrnSystem</code>. If we don&apos;t have a Patient for
        an MRN yet, we create a placeholder Patient + identifier + link
        (source <code>PLACEHOLDER_FROM_MRN</code>). When extraction later
        produces records carrying that MRN, the identifier already exists, so
        the records auto-attach to the same Patient — no re-linking.
      </Body>
      <Code language="HTTP" filename="POST /v1/partner-patient-links/bulk">
{`{
  "organization_id": "org_lagoon_hospital",
  "external_system": "https://your-emr.example.com/patients/",
  "items": [
    { "kind": "by_mrn", "mrn": "LH-00143-26", "external_id": "emr_8821" },
    { "kind": "by_mrn", "mrn": "LH-00200-26", "external_id": "emr_8822",
      "placeholder_name": "Tunde Adeleke" },
    { "kind": "by_patient_id", "patient_id": "pat_b3f9c21a",
      "external_id": "emr_8823" }
  ]
}`}
      </Code>
      <Body>
        <strong>On import acknowledgement</strong> — POST{" "}
        <code>/v1/import-packages/:id/acknowledge</code> with a{" "}
        <code>patient_id_mappings</code> array. Each pair becomes a
        PartnerPatientLink with source <code>IMPORT_ACK</code>. Use this when
        your EMR creates new patient ids during the import and you want to
        register them in the same call that confirms the import.
      </Body>

      <H3 id="reverse-lookup">Querying by your own id</H3>
      <Body>
        Once a link exists, this works:
      </Body>
      <Code language="HTTP" filename="GET">
{`curl https://www.pierflow.com/v1/organizations/org_lagoon_hospital/patients/by-external/emr_8821/fhir \\
  -H "Authorization: Bearer $PIERFLOW_KEY"`}
      </Code>
      <Body>
        We resolve the link internally and serve the merged FHIR Bundle.
        Your EMR doesn&apos;t need to maintain a mapping table.
      </Body>

      <H2 id="fhir-bundle">FHIR Bundle with your id</H2>
      <Body>
        When a PartnerPatientLink exists between you and the requested
        Patient, the Bundle&apos;s Patient.identifier array carries three
        entries: Pierflow&apos;s internal id, the MRN under the org&apos;s
        mrnSystem, and your <code>external_id</code> under the URI you
        claimed at link time. <code>use: secondary</code> on the partner
        identifier.
      </Body>
      <Code language="FHIR R4" filename="Patient resource (excerpt)">
{`{
  "resourceType": "Patient",
  "id": "pat_b3f9c21a",
  "identifier": [
    { "system": "https://pierflow.com/patient", "value": "pat_b3f9c21a" },
    { "system": "https://healthos.ng/mrn/", "value": "LH-00143-26" },
    { "system": "https://your-emr.example.com/patients/",
      "value": "emr_8821", "use": "secondary" }
  ],
  "name": [
    { "use": "official", "text": "Adaeze Margaret Nwosu",
      "family": "Nwosu", "given": ["Adaeze", "Margaret"] }
  ],
  "gender": "female",
  "birthDate": "1985-03-14"
}`}
      </Code>

      <PrevNext prev={prev} next={next} />
    </article>
  );
}
