import LegalPage from "@/components/shared/LegalPage";

export default function Page() {
  return (
    <LegalPage
      label="Legal"
      title="Cookie policy"
      updated="2026-05-01"
      body={[
        {
          heading: "What we use",
          text: "We use a minimal set of first-party cookies to operate the site and analytics cookies to understand how it is used.",
        },
        {
          heading: "Your choices",
          text: "You can disable non-essential cookies in your browser. Essential cookies are required for security and core functionality.",
        },
      ]}
    />
  );
}
