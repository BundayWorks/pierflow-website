import ModulePage from "@/components/shared/ModulePage";

export default function Page() {
  return (
    <ModulePage
      label="Platform · Insurance distribution"
      title="Distribute every HMO product, from one API."
      intro="Plans, quotes, enrollment, policies, collections — across every HMO in the network."
      features={[
        {
          title: "Plans & quotes",
          body: "Search plans across the network, ranked by value_score for each buyer profile.",
        },
        {
          title: "Enrollment",
          body: "One canonical POST creates the policy with the right HMO and the right effective date.",
        },
        {
          title: "Collections",
          body: "Recurring premium collection, retries, and reconciliation across payment providers.",
        },
      ]}
    />
  );
}
