import DocStub from "@/components/shared/DocStub";

export default function Page() {
  return (
    <DocStub
      title="Data standards"
      intro="Pierflow normalises every HMO and provider to a Universal Health Schema mapped to FHIR R4. You write one integration, not one per partner."
      sections={[
        {
          heading: "Canonical resources",
          body: "Plans, Members, Policies, Claims, Providers, and Encounters all conform to the same canonical shapes regardless of source HMO.",
        },
        {
          heading: "FHIR R4 mapping",
          body: "Every canonical resource is mappable to its FHIR R4 equivalent. Use the /v1/fhir endpoints to retrieve FHIR-native representations.",
        },
        {
          heading: "Codes and identifiers",
          body: "Identifiers (BVN, NIN, HMO numbers) carry namespace metadata. Clinical codes follow ICD-10 / SNOMED CT where applicable.",
        },
      ]}
    />
  );
}
