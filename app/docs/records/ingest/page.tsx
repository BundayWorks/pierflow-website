import {
  DocPageHeader,
  H2,
  H3,
  Body,
  Endpoint,
  Code,
  KVTable,
  FieldCardList,
  FieldCard,
  Callout,
  PrevNext,
} from "@/components/docs/primitives";
import { neighbors } from "@/components/docs/nav-helpers";

export default function Page() {
  const { prev, next } = neighbors("records/ingest");
  return (
    <article>
      <DocPageHeader
        eyebrow="Records API"
        title="Ingest documents"
        description="Submit scanned pages for processing. The endpoint returns a job ID immediately; the actual extraction happens asynchronously."
      />

      <H2 id="endpoint">Endpoint</H2>
      <Endpoint method="POST" path="/v1/ingest/documents" />
      <Body>
        Multipart upload, one or more files per request. The same endpoint
        accepts uploads from the Pierflow capture app and from your own
        server-to-server integration.
      </Body>
      <Code language="http">
        {`POST /v1/ingest/documents
Authorization: Bearer pf_live_sk_...
Content-Type: multipart/form-data

file[]            — one or more PDF, TIFF, JPEG, PNG, or WEBP files (≤50 MB each)
organization_id   — required. The organization the records belong to.
batch_label       — optional. Human label (e.g. "Ward A — June").
record_type_hint  — optional. AUTO (default) | OUTPATIENT_CARD | LAB_RESULT
                    | PRESCRIPTION | ANTENATAL | IMMUNISATION | DISCHARGE_SUMMARY
                    | REGISTRATION | OTHER
priority          — optional. NORMAL (default) | URGENT
operator_id       — optional. ID of the staff member submitting the batch.`}
      </Code>

      <H3>Response · 202 Accepted</H3>
      <Code language="json">
        {`{
  "status": "accepted",
  "batch_id": "btch_9f3a1c82d4e74b2a",
  "jobs": [
    {
      "job_id": "job_a1b2c3d4e5f6",
      "filename": "ward_a_003.pdf",
      "pages": 4,
      "status": "queued"
    }
  ]
}`}
      </Code>

      <H2 id="types">Document types</H2>
      <Body>
        Pierflow auto-classifies pages by default. Pass a{" "}
        <code>record_type_hint</code> when you already know what&apos;s in the
        batch — it improves accuracy and speeds up processing.
      </Body>
      <FieldCardList>
        <FieldCard
          name="OUTPATIENT_CARD"
          type="document"
          description="General clinical visit record"
        />
        <FieldCard
          name="REGISTRATION"
          type="document"
          description="Patient registration sheet — demographics, blood group, allergies"
        />
        <FieldCard
          name="LAB_RESULT"
          type="document"
          description="Haematology, biochemistry, microbiology, pathology results"
        />
        <FieldCard
          name="PRESCRIPTION"
          type="document"
          description="Drug orders, dosages, instructions"
        />
        <FieldCard
          name="ANTENATAL"
          type="document"
          description="Maternal health visit records"
        />
        <FieldCard
          name="IMMUNISATION"
          type="document"
          description="Vaccination history"
        />
        <FieldCard
          name="DISCHARGE_SUMMARY"
          type="document"
          description="Inpatient discharge notes"
        />
      </FieldCardList>

      <H2 id="lifecycle">Job lifecycle</H2>
      <Body>
        A job moves through a small set of states. Poll{" "}
        <code>GET /v1/jobs/:id</code> to track progress, or wait for the
        records to appear in the corresponding organization&apos;s patient
        list.
      </Body>
      <KVTable
        headers={["Status", "Meaning"]}
        rows={[
          ["QUEUED", "Accepted, waiting in the processing queue"],
          ["PROCESSING", "Pages are being extracted"],
          ["AWAITING_REVIEW", "Extraction complete, but one or more records need human review"],
          ["VALIDATED", "All records approved, ready to be included in the next Import Package"],
          ["IMPORTED", "Records have been delivered to and acknowledged by a partner"],
          ["FAILED", "Processing failed — see error_code for the reason"],
        ]}
      />

      <Callout kind="warn" title="Idempotency">
        Always pass an <code>Idempotency-Key</code> header on uploads. A retry
        with the same key returns the original batch_id without creating
        duplicate jobs.
      </Callout>

      <PrevNext prev={prev} next={next} />
    </article>
  );
}
