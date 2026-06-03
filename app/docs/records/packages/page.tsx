import {
  DocPageHeader,
  H2,
  Lead,
  Body,
  Endpoint,
  Code,
  Callout,
  PrevNext,
} from "@/components/docs/primitives";
import { neighbors } from "@/components/docs/nav-helpers";

export default function Page() {
  const { prev, next } = neighbors("records/packages");
  return (
    <article>
      <DocPageHeader
        eyebrow="Records API"
        title="Import packages"
        description="An Import Package is a single ZIP containing every newly validated patient bundle for an organization since your last import. It's the recommended way to ingest at scale."
      />

      <H2 id="why">Why packages</H2>
      <Lead>
        Polling per patient works, but it&apos;s slow and bandwidth-heavy.
        Pierflow assembles validated records into Import Packages — one ZIP
        per organization per build cycle — so your importer pulls one file
        and ingests everything in it.
      </Lead>

      <H2 id="list">Listing packages</H2>
      <Endpoint
        method="GET"
        path="/v1/organizations/:id/import-packages?status=READY"
      />
      <Code language="json" filename="200 OK">
        {`{
  "packages": [
    {
      "package_id": "pkg_c7d8e9f0",
      "organization_id": "org_lagos_general_clinic",
      "created_at": "2026-06-01T10:00:00Z",
      "status": "READY",
      "patient_count": 247,
      "record_count": 1834,
      "download_url": "/v1/import-packages/pkg_c7d8e9f0/download",
      "checksum_sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      "expires_at": "2026-06-08T10:00:00Z"
    }
  ]
}`}
      </Code>

      <H2 id="download">Downloading</H2>
      <Endpoint method="GET" path="/v1/import-packages/:package_id/download" />
      <Body>
        Returns a ZIP with a manifest and one FHIR R4 Bundle per patient.
      </Body>
      <Code language="text" filename="ZIP contents">
        {`manifest.json          — package metadata + record index
patients/
  pat_b3f9c21a.json    — FHIR R4 Bundle
  pat_c4d5e6f7.json
  ...
checksum.sha256        — SHA-256 of every file in the package`}
      </Code>

      <H2 id="ack">Acknowledging</H2>
      <Endpoint
        method="POST"
        path="/v1/import-packages/:package_id/acknowledge"
      />
      <Body>
        After your importer finishes, send an acknowledgement so Pierflow can
        mark the records as <code>IMPORTED</code>. Include the patients you
        couldn&apos;t import and the reasons — they&apos;ll be rebuilt into
        the next package.
      </Body>
      <Code language="json" filename="request">
        {`{
  "imported_patient_count": 245,
  "failed_patient_ids": ["pat_x1y2z3", "pat_a4b5c6"],
  "failure_reasons": {
    "pat_x1y2z3": "DUPLICATE_HOSPITAL_NUMBER",
    "pat_a4b5c6": "MISSING_REQUIRED_FIELD"
  },
  "imported_at": "2026-06-01T11:23:00Z",
  "partner_import_reference": "YOUR-IMPORT-REF-00047"
}`}
      </Code>

      <Callout kind="warn" title="Package retention">
        Packages expire 7 days after creation. Build your importer to pull
        and acknowledge on a daily cadence at minimum.
      </Callout>

      <PrevNext prev={prev} next={next} />
    </article>
  );
}
