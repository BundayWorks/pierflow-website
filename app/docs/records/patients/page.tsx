import {
  DocPageHeader,
  H2,
  H3,
  Body,
  Lead,
  Endpoint,
  Code,
  KVTable,
  Callout,
  PrevNext,
} from "@/components/docs/primitives";
import { neighbors } from "@/components/docs/nav-helpers";

export default function Page() {
  const { prev, next } = neighbors("records/patients");
  return (
    <article>
      <DocPageHeader
        eyebrow="Records API"
        title="Patients"
        description="Patients are the entities the Records API ultimately produces. Each has demographic data, one or more identifiers, and a FHIR R4 bundle holding their clinical history."
      />

      <H2 id="list">List patients for an organization</H2>
      <Endpoint method="GET" path="/v1/organizations/:id/patients" />
      <KVTable
        headers={["Query parameter", "Description"]}
        rows={[
          ["status", "VALIDATED | IMPORTED | ALL (default VALIDATED)"],
          ["updated_since", "ISO-8601 timestamp — incremental sync cursor"],
          ["search", "Fuzzy match on name or MRN"],
          ["page / per_page", "Pagination (default 1 / 100)"],
        ]}
      />
      <Code language="json" filename="200 OK">
        {`{
  "patients": [
    {
      "patient_id": "pat_b3f9c21a",
      "mrn": "LGC-00438",
      "full_name": "Adaeze Nwosu",
      "date_of_birth": "1985-03-14",
      "sex": "F",
      "record_count": 7,
      "visit_count": 12,
      "earliest_visit": "2019-01-10",
      "latest_visit": "2025-11-03",
      "validation_status": "VALIDATED",
      "fhir_url": "/v1/organizations/org_lagos_general_clinic/patients/pat_b3f9c21a/fhir"
    }
  ],
  "pagination": { "total": 11203, "page": 1, "per_page": 100 }
}`}
      </Code>

      <H2 id="bundle">Patient FHIR bundle</H2>
      <Endpoint
        method="GET"
        path="/v1/organizations/:id/patients/:patient_id/fhir"
      />
      <Lead>
        Returns a FHIR R4 <code>Bundle</code> with every resource we&apos;ve
        extracted for that patient. You can import this directly into any
        FHIR-aware system.
      </Lead>
      <KVTable
        headers={["Query parameter", "Description"]}
        rows={[
          ["include", "Comma-separated resource types to include (default: all)"],
          ["date_from / date_to", "Filter visits by date range"],
        ]}
      />
      <Code language="json" filename="200 OK (abbreviated)">
        {`{
  "resourceType": "Bundle",
  "type": "collection",
  "total": 34,
  "entry": [
    {
      "fullUrl": "Patient/pat_b3f9c21a",
      "resource": {
        "resourceType": "Patient",
        "id": "pat_b3f9c21a",
        "identifier": [
          { "system": "https://pierflow.com/mrn", "value": "LGC-00438" }
        ],
        "name": [{ "use": "official", "text": "Adaeze Nwosu" }],
        "gender": "female",
        "birthDate": "1985-03-14"
      }
    },
    { "fullUrl": "Encounter/enc_001", "resource": { "resourceType": "Encounter", "...": "..." } },
    { "fullUrl": "Observation/obs_bp_001", "resource": { "resourceType": "Observation", "...": "..." } },
    { "fullUrl": "Condition/cond_001", "resource": { "resourceType": "Condition", "...": "..." } },
    { "fullUrl": "MedicationRequest/med_001", "resource": { "resourceType": "MedicationRequest", "...": "..." } }
  ]
}`}
      </Code>

      <H2 id="identifiers">Identifiers</H2>
      <Body>
        Pierflow stores identifiers as a list of typed values so you&apos;re
        not stuck with a single field. Each entry has a stable{" "}
        <code>system</code> URI and a <code>value</code>.
      </Body>
      <KVTable
        headers={["System", "Description"]}
        rows={[
          ["https://pierflow.com/mrn", "Medical Record Number assigned by the organization"],
          ["https://pierflow.com/bvn", "Bank Verification Number (Nigeria)"],
          ["https://pierflow.com/nin", "National Identification Number (Nigeria)"],
          ["https://pierflow.com/nhis", "NHIS / scheme enrolment number"],
          ["https://pierflow.com/hmo-card", "HMO / insurer card number"],
        ]}
      />

      <H3>Why this matters</H3>
      <Body>
        A patient may appear in multiple systems under different IDs. By
        keeping identifiers as typed values, you can match a Pierflow patient
        to your own internal record without renegotiating a primary key.
      </Body>

      <Callout kind="info" title="Possible duplicates">
        When Pierflow suspects two patients are the same person but
        confidence is below the auto-merge threshold, you&apos;ll see a{" "}
        <code>possible_duplicate_of</code> field on the patient. Resolution
        happens in the Pierflow review portal.
      </Callout>

      <PrevNext prev={prev} next={next} />
    </article>
  );
}
