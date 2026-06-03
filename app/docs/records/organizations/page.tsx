import {
  DocPageHeader,
  H2,
  Lead,
  Body,
  Endpoint,
  Code,
  KVTable,
  PrevNext,
} from "@/components/docs/primitives";
import { neighbors } from "@/components/docs/nav-helpers";

export default function Page() {
  const { prev, next } = neighbors("records/organizations");
  return (
    <article>
      <DocPageHeader
        eyebrow="Records API"
        title="Organizations"
        description="An organization is any contracted entity whose records you process — hospitals, clinics, labs, pharmacies, insurers, EMR vendors, and government programmes."
      />

      <Lead>
        The Records API is multi-tenant. Every record belongs to exactly one
        organization. Your access token is scoped to the organizations your
        account is linked to — you cannot see or affect anyone else&apos;s
        data.
      </Lead>

      <H2 id="list">List linked organizations</H2>
      <Endpoint method="GET" path="/v1/organizations" />
      <Body>Returns the organizations the current token is permitted to act on.</Body>
      <Code language="json" filename="200 OK">
        {`{
  "organizations": [
    {
      "organization_id": "org_lagos_general_clinic",
      "name": "Lagos General Clinic",
      "type": "CLINIC",
      "address": { "street": "14 Adeola Street", "lga": "Ikeja", "state": "Lagos" },
      "stats": {
        "records_processed": 12450,
        "records_validated": 11203,
        "records_in_review": 89
      }
    }
  ],
  "pagination": { "total": 47, "page": 1, "per_page": 50 }
}`}
      </Code>

      <H2 id="types">Organization types</H2>
      <KVTable
        headers={["Type", "Examples"]}
        rows={[
          ["HOSPITAL", "Tertiary hospitals, teaching hospitals"],
          ["CLINIC", "Outpatient clinics, polyclinics, PHCs"],
          ["LAB", "Diagnostic laboratories"],
          ["PHARMACY", "Retail and hospital pharmacies"],
          ["INSURER", "Health insurers, HMOs, payers"],
          ["EMR_VENDOR", "EMR / EHR software vendors"],
          ["HMS_VENDOR", "HMS software vendors"],
          ["GOVERNMENT", "Ministries of Health, public health programmes"],
          ["OTHER", "Cooperatives, networks, community programmes"],
        ]}
      />

      <H2 id="single">Retrieve one organization</H2>
      <Endpoint method="GET" path="/v1/organizations/:id" />
      <Body>
        Returns the full record for one organization, including site
        breakdown when the organization has multiple physical locations.
      </Body>

      <PrevNext prev={prev} next={next} />
    </article>
  );
}
