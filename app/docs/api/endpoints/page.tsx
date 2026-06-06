import {
  DocPageHeader,
  H2,
  H3,
  Body,
  Code,
  Callout,
  KVTable,
  PrevNext,
} from "@/components/docs/primitives";
import { neighbors } from "@/components/docs/nav-helpers";

export default function Page() {
  const { prev, next } = neighbors("api/endpoints");
  return (
    <article>
      <DocPageHeader
        eyebrow="API"
        title="Records API endpoints"
        description="Every /v1 endpoint partners can call, with auth notes and example request shapes. Reach for the Postman collection (downloadable from your /portal/overview) for runnable versions."
      />

      <Callout kind="info">
        Every request needs{" "}
        <code>Authorization: Bearer pf_test_sk_… (or pf_live_sk_…)</code>.
        Issue keys from <code>/portal/keys</code>. Keys are server-side only —
        never embed them in mobile or browser code.
      </Callout>

      <H2 id="organizations">Organizations</H2>
      <Body>
        Each request acts on a customer organization your key is linked to via
        a <code>PartnerOrganizationLink</code>. Use these to list and inspect
        the orgs available to you.
      </Body>
      <KVTable
        headers={["Method · Path", "Purpose"]}
        rows={[
          ["GET /v1/organizations", "List orgs this key may act on"],
          [
            "GET /v1/organizations/:orgId",
            "One organization, including mrnSystem",
          ],
        ]}
      />
      <Code language="HTTP" filename="GET /v1/organizations">
{`curl -H "Authorization: Bearer $PIERFLOW_KEY" \\
  https://www.pierflow.com/v1/organizations`}
      </Code>

      <H2 id="ingest">Capture and ingest</H2>
      <Body>
        Use these to push paper records through extraction. Image bytes go
        direct to Cloudinary using a signed URL — Pierflow never proxies files.
      </Body>
      <KVTable
        headers={["Method · Path", "Purpose"]}
        rows={[
          [
            "POST /v1/uploads/sign",
            "Get a one-shot Cloudinary upload signature",
          ],
          [
            "POST /v1/scan-batches",
            "Create a batch (groups pages from one session)",
          ],
          [
            "POST /v1/ingest/documents",
            "Register an uploaded asset as a ProcessingJob",
          ],
          [
            "GET /v1/ingest/jobs/:jobId",
            "Poll ProcessingJob state + extracted records",
          ],
        ]}
      />

      <H3 id="ingest-flow">Typical ingest flow</H3>
      <Code language="bash" filename="curl">
{`# 1. Create a batch
curl -X POST https://www.pierflow.com/v1/scan-batches \\
  -H "Authorization: Bearer $PIERFLOW_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "organizationId": "org_lagoon_hospital",
    "label": "Ward A migration · cohort 1",
    "priority": "NORMAL"
  }'

# 2. Sign a Cloudinary upload
curl -X POST https://www.pierflow.com/v1/uploads/sign \\
  -H "Authorization: Bearer $PIERFLOW_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "organizationId": "org_lagoon_hospital",
    "batchId": "bat_3xMA…"
  }'

# 3. Upload directly to Cloudinary
# (multipart-form upload using the fields returned in step 2)

# 4. Tell Pierflow about the asset
curl -X POST https://www.pierflow.com/v1/ingest/documents \\
  -H "Authorization: Bearer $PIERFLOW_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "organizationId": "org_lagoon_hospital",
    "batchId": "bat_3xMA…",
    "source": {
      "publicId": "pierflow/org_…/page_001",
      "secureUrl": "https://res.cloudinary.com/…/page_001.png"
    },
    "documentType": "OUTPATIENT_CARD"
  }'

# 5. Poll
curl https://www.pierflow.com/v1/ingest/jobs/job_4HD… \\
  -H "Authorization: Bearer $PIERFLOW_KEY"`}
      </Code>

      <Callout kind="info">
        <strong>Chart folders.</strong> If you&apos;re photographing multi-page
        charts, group pages by passing the same <code>chartFolderId</code> on
        every <code>/v1/ingest/documents</code> call for that chart. Identity
        is resolved at folder level — see{" "}
        <a
          href="/docs/patient-mapping"
          className="text-accent-emerald underline"
        >
          Patient mapping
        </a>
        .
      </Callout>

      <H2 id="patients">Patients</H2>
      <Body>
        After extraction, validated records roll up into a per-patient FHIR
        Bundle.
      </Body>
      <KVTable
        headers={["Method · Path", "Purpose"]}
        rows={[
          [
            "GET /v1/organizations/:orgId/patients",
            "List patients for an org",
          ],
          [
            "GET /v1/organizations/:orgId/patients/:patientId/fhir",
            "Merged FHIR R4 Bundle",
          ],
          [
            "GET /v1/organizations/:orgId/patients/by-external/:externalId/fhir",
            "Bundle by your own EMR id (via PartnerPatientLink)",
          ],
        ]}
      />
      <Body>
        Both FHIR endpoints accept the same query params: <code>include</code>{" "}
        (comma-separated resource types), <code>date_from</code>,{" "}
        <code>date_to</code> (YYYY-MM-DD filters on Encounter.period.start).
        When a PartnerPatientLink exists, the Patient.identifier array in the
        response includes your <code>external_id</code> as a secondary
        identifier so your EMR can round-trip without out-of-band state.
      </Body>

      <H2 id="partner-patient-links">Partner patient links</H2>
      <Body>
        Map Pierflow Patient ids to your EMR&apos;s patient ids in one place.
        Cohort imports go through <code>/bulk</code>; per-patient mappings
        from acknowledge calls flow in automatically (see Acknowledge). Once
        linked, you can query Pierflow with your own id via the by-external
        FHIR endpoint above.
      </Body>
      <KVTable
        headers={["Method · Path", "Purpose"]}
        rows={[
          [
            "POST /v1/partner-patient-links",
            "Create or update one mapping (by MRN or patient id)",
          ],
          [
            "POST /v1/partner-patient-links/bulk",
            "Up to 500 mappings in one call",
          ],
          [
            "GET /v1/partner-patient-links?external_id=…",
            "Lookup by your id",
          ],
          [
            "GET /v1/partner-patient-links?patient_id=…",
            "Lookup by Pierflow id",
          ],
        ]}
      />
      <Code language="HTTP" filename="POST /v1/partner-patient-links (by MRN)">
{`curl -X POST https://www.pierflow.com/v1/partner-patient-links \\
  -H "Authorization: Bearer $PIERFLOW_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "kind": "by_mrn",
    "organization_id": "org_lagoon_hospital",
    "mrn": "LH-00143-26",
    "external_id": "emr_patient_8821",
    "external_system": "https://your-emr.example.com/patients/",
    "placeholder_name": "Adaeze Margaret Nwosu"
  }'`}
      </Code>
      <Body>
        If no Patient exists under that MRN yet, we create a placeholder
        Patient + identifier + link with source{" "}
        <code>PLACEHOLDER_FROM_MRN</code>. Future extracted records carrying
        that MRN auto-attach to the same Patient — the link survives the
        switch.
      </Body>

      <H2 id="packages">Import packages</H2>
      <Body>
        Nightly ZIP of validated records per (partner, org) tuple. Download
        once, acknowledge once.
      </Body>
      <KVTable
        headers={["Method · Path", "Purpose"]}
        rows={[
          [
            "GET /v1/organizations/:orgId/import-packages",
            "List packages for an org (status, counts, expiresAt)",
          ],
          [
            "GET /v1/import-packages/:packageId/download",
            "Short-lived signed Cloudinary URL for the ZIP",
          ],
          [
            "POST /v1/import-packages/:packageId/acknowledge",
            "Confirm import + register patient_id_mappings",
          ],
        ]}
      />
      <Code
        language="HTTP"
        filename="POST /v1/import-packages/:packageId/acknowledge"
      >
{`curl -X POST https://www.pierflow.com/v1/import-packages/pkg_4HD…/acknowledge \\
  -H "Authorization: Bearer $PIERFLOW_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "imported_patient_count": 47,
    "failed_patient_ids": [],
    "partner_import_reference": "emr-import-2026-06-06-001",
    "patient_id_mappings": [
      {
        "pierflow_patient_id": "pat_b3f9c21a",
        "external_id": "emr_8821",
        "external_system": "https://your-emr.example.com/patients/"
      }
    ]
  }'`}
      </Code>
      <Body>
        <code>patient_id_mappings</code> is optional. When present, each pair
        becomes a PartnerPatientLink with source <code>IMPORT_ACK</code>. Per-item
        outcomes return in the response so you retry only the failures.
      </Body>

      <H2 id="webhooks">Webhooks</H2>
      <Body>
        Subscribe to events so you don&apos;t have to poll. Endpoints are
        signed with HMAC-SHA256; verify <code>X-Pierflow-Signature</code>{" "}
        before trusting any payload.
      </Body>
      <KVTable
        headers={["Event", "Fired when"]}
        rows={[
          [
            "processing_job.completed",
            "Extraction finished — record is AUTO_APPROVED or AWAITING_REVIEW",
          ],
          [
            "processing_job.failed",
            "Extraction errored; ProcessingJob.status = FAILED",
          ],
          [
            "import_package.ready",
            "A new ImportPackage moved to READY",
          ],
          ["test.ping", "Sent on demand from /portal/webhooks"],
        ]}
      />
      <Body>
        Manage endpoints from your <code>/portal/webhooks</code> page.
        Synchronous delivery with one retry after 30s today; persistent
        delivery audit ships next.
      </Body>

      <PrevNext prev={prev} next={next} />
    </article>
  );
}
