import ModulePage from "@/components/shared/ModulePage";

export default function Page() {
  return (
    <ModulePage
      label="Platform · Payments"
      title="Money moves where the data moves."
      intro="Premium collection, claim payouts, partner commissions, and per-HMO reconciliation."
      features={[
        {
          title: "Premium collection",
          body: "Recurring debits across cards, bank transfers, and mobile money. Retry strategies tuned to lapse_risk_score.",
        },
        {
          title: "Payouts",
          body: "Pay providers and members through the same canonical surface that orchestrates the data.",
        },
        {
          title: "Reconciliation",
          body: "Daily reconciliation per HMO, per partner, per channel.",
        },
      ]}
    />
  );
}
