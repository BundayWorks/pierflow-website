import LegalPage from "@/components/shared/LegalPage";

export default function Page() {
  return (
    <LegalPage
      label="Legal"
      title="Privacy policy"
      updated="2026-05-01"
      body={[
        {
          heading: "What we collect",
          text: "Pierflow processes health-related personal data on behalf of partner organisations under a data processing agreement. The categories of data we handle are defined per integration.",
        },
        {
          heading: "How we use it",
          text: "We use this data exclusively to deliver the connectivity services contracted by the partner. We do not sell or share personal data with unauthorised parties.",
        },
        {
          heading: "Your rights",
          text: "Members can exercise their NDPR rights through their carrier or partner. We facilitate access and erasure requests in line with applicable law.",
        },
        {
          heading: "Contact",
          text: "Email pierflowllc@gmail.com for any privacy-related question.",
        },
      ]}
    />
  );
}
