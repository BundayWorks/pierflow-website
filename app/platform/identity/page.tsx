import ModulePage from "@/components/shared/ModulePage";

export default function Page() {
  return (
    <ModulePage
      label="Platform · Identity"
      title="Verified identity for every health transaction."
      intro="BVN, NIN, biometric, and historical signal fused into a single identity_confidence score."
      features={[
        {
          title: "Identity fusion",
          body: "Multiple identifiers reconciled to one canonical member identity.",
        },
        {
          title: "identity_confidence",
          body: "0-1 score returned inline on every enrollment and verification.",
        },
        {
          title: "Audit trail",
          body: "Every identity decision is logged with the inputs and model version.",
        },
      ]}
    />
  );
}
