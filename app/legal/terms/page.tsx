import LegalPage from "@/components/shared/LegalPage";

export default function Page() {
  return (
    <LegalPage
      label="Legal"
      title="Terms of service"
      updated="2026-05-01"
      body={[
        {
          heading: "Acceptance",
          text: "By using the Pierflow API or related services, you agree to these terms and any commercial agreement signed with Pierflow Technologies.",
        },
        {
          heading: "Acceptable use",
          text: "You may not use the platform to violate applicable law or the rights of any person whose data flows through your integration.",
        },
        {
          heading: "Service levels",
          text: "Production environments are operated to a 99% uptime SLA. Sandbox environments are best-effort.",
        },
        {
          heading: "Liability",
          text: "Liability is limited as set out in the commercial agreement governing your access.",
        },
      ]}
    />
  );
}
