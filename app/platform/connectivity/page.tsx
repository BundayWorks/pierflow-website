import ModulePage from "@/components/shared/ModulePage";

export default function Page() {
  return (
    <ModulePage
      label="Platform · Connectivity"
      title="Pre-built integrations to every HMO."
      intro="Stop maintaining one-off connectors. Pierflow runs the integrations and normalises the data."
      features={[
        {
          title: "HMO connectors",
          body: "Seven HMOs live today, with new connectors continuously rolled out.",
        },
        {
          title: "Webhooks",
          body: "Signed, at-least-once event delivery with replay and retry windows.",
        },
        {
          title: "Idempotency & retries",
          body: "Idempotency-Key support on every write. Safe to retry under any failure mode.",
        },
      ]}
    />
  );
}
