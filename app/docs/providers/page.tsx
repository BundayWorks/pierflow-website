import {
  DocPageHeader,
  H2,
  Endpoint,
  Code,
  KVTable,
  PrevNext,
} from "@/components/docs/primitives";
import { neighbors } from "@/components/docs/nav-helpers";

export default function Page() {
  const { prev, next } = neighbors("providers");
  return (
    <article>
      <DocPageHeader
        eyebrow="Resources"
        title="Providers"
        description="Search the network of hospitals, clinics, and pharmacies. Filter by capability, geolocation, and accepted plans."
      />

      <H2 id="search">Search</H2>
      <Endpoint method="GET" path="/v1/providers" />
      <KVTable
        headers={["Query parameter", "Description"]}
        rows={[
          ["state", "Nigerian state (e.g. Lagos)"],
          ["lga", "Local Government Area"],
          ["specialty", "Comma-separated specialties"],
          ["hmo_id", "Restrict to providers accepting one HMO"],
          ["plan_id", "Restrict to providers accepting one plan"],
          ["radius_km", "Distance from lat/lng centre"],
        ]}
      />

      <H2 id="shape">Provider shape</H2>
      <Code language="json">
        {`{
  "provider_id": "pf_prov_reddington",
  "hmo_ids": ["pf_hmo_clearline", "pf_hmo_bastion"],
  "name": "Reddington Hospital",
  "type": "hospital",
  "tier": "tertiary",
  "address": { "street": "12 Isaac John St", "lga": "Ikeja", "state": "Lagos" },
  "coordinates": { "lat": 6.6018, "lng": 3.3515 },
  "specialties": ["cardiology", "oncology", "maternity", "emergency"],
  "acceptance_status": { "pf_hmo_clearline": "active", "pf_hmo_bastion": "active" },
  "operating_hours": "24/7"
}`}
      </Code>

      <PrevNext prev={prev} next={next} />
    </article>
  );
}
