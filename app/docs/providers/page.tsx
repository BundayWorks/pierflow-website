import DocStub from "@/components/shared/DocStub";

export default function Page() {
  return (
    <DocStub
      title="Providers"
      intro="Search the network of hospitals, clinics, and pharmacies. Filter by capability, geolocation, and accepted plans."
      sections={[
        {
          heading: "GET /v1/providers",
          body: "Returns canonical Provider objects with capabilities, network membership, geolocation, and contact information.",
        },
        {
          heading: "Plan acceptance",
          body: "Each provider exposes accepted_plans — the canonical plan_ids it serves in network — for fast benefit-design lookups.",
        },
      ]}
    />
  );
}
