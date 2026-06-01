import ModulePage from "@/components/shared/ModulePage";

export default function Page() {
  return (
    <ModulePage
      label="Platform · Security"
      title="Health data, handled the way health data must be handled."
      intro="NDPR-aligned, encrypted in transit and at rest, fully audited, signed at every boundary."
      features={[
        {
          title: "NDPR alignment",
          body: "Built to Nigeria Data Protection Regulation requirements from day one.",
        },
        {
          title: "Encryption everywhere",
          body: "TLS 1.3 in transit, AES-256 at rest, per-tenant key isolation.",
        },
        {
          title: "Auditability",
          body: "Every API call, every score, every webhook delivery is logged with sufficient detail for audit and replay.",
        },
        {
          title: "Signed webhooks",
          body: "Per-endpoint signing keys with rotation and per-event verification.",
        },
      ]}
    />
  );
}
