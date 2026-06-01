import ModulePage from "@/components/shared/ModulePage";

export default function Page() {
  return (
    <ModulePage
      label="Platform · Data exchange"
      title="Canonical health data, mapped to FHIR R4."
      intro="One schema across every HMO, hospital, and partner. Read and write the same shapes, regardless of source system."
      features={[
        {
          title: "Universal Health Schema",
          body: "Plans, Members, Policies, Claims, Providers, Encounters — canonical and stable.",
        },
        {
          title: "FHIR R4 mapping",
          body: "Every canonical resource is bidirectionally mapped to its FHIR R4 equivalent.",
        },
        {
          title: "Identifier registry",
          body: "Namespaced identifiers (BVN, NIN, HMO numbers) with provenance metadata.",
        },
      ]}
    />
  );
}
