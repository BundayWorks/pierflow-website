import LegalPage from "@/components/shared/LegalPage";

export default function Page() {
  return (
    <LegalPage
      label="Legal"
      title="NDPR statement"
      updated="2026-05-01"
      body={[
        {
          heading: "Our role",
          text: "Pierflow Technologies acts as a data processor on behalf of its partners, who are the data controllers for member data they submit to the platform.",
        },
        {
          heading: "Safeguards",
          text: "We maintain technical and organisational safeguards in line with NDPR, including encryption in transit and at rest, role-based access, and full audit logging.",
        },
        {
          heading: "Requests",
          text: "Data subject access, rectification, and erasure requests should be raised with the controlling partner. We respond promptly to controller-initiated requests.",
        },
      ]}
    />
  );
}
