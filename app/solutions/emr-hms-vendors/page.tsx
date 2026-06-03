import SolutionPage from "@/components/shared/SolutionPage";

export default function Page() {
  return (
    <SolutionPage
      label="Solutions · EMR / HMS vendors"
      title="Activate hospital clients with digitised paper records."
      intro="Most hospital and clinic clients sit on decades of paper history. Your HMS goes live empty until that history makes it in. Pierflow turns paper into FHIR R4 bundles your platform can import on day one — so the system is meaningful from the first appointment."
      aiField="extraction_confidence"
      capabilities={[
        {
          title: "Records API",
          body: "Mobile or direct-upload capture, Pierflow handles extraction and validation, your importer pulls FHIR R4 Bundles by organization.",
        },
        {
          title: "Human-reviewed quality",
          body: "Low-confidence records go to human review inside Pierflow before they ever reach your importer. Your customers never see half-extracted records.",
        },
        {
          title: "Import Packages",
          body: "One ZIP per organization per cycle. Manifest, per-patient FHIR bundle, checksum. Acknowledge on import and we re-issue what failed.",
        },
        {
          title: "Standards-aligned",
          body: "Patient, Encounter, Observation, Condition, MedicationRequest — all FHIR R4. ICD-10, LOINC, ATC codes baked in.",
        },
      ]}
      outcomes={[
        {
          metric: "Day 1",
          body: "go-lives that include the real patient history, not an empty database.",
        },
        {
          metric: "1",
          body: "API to consume — no custom importer per facility.",
        },
        {
          metric: "FHIR R4",
          body: "compliance you didn't have to build yourself.",
        },
      ]}
    />
  );
}
