import ModulePage from "@/components/shared/ModulePage";

export default function Page() {
  return (
    <ModulePage
      label="Platform · Records API"
      title="Paper records to FHIR R4, in one call."
      intro="Turn decades of paper patient files — outpatient cards, lab slips, prescriptions, antenatal registers, immunisation cards, discharge summaries — into validated FHIR R4 bundles your EMR, HMS, or partner system can import on day one."
      features={[
        {
          title: "Capture anywhere",
          body: "Mobile capture for the MVP; direct upload for server-to-server workflows. Scanner and MFP integrations on the roadmap. Same API regardless.",
        },
        {
          title: "Validated, scored, reviewed",
          body: "Records arrive with structure, ICD-10 / LOINC / ATC codes, and confidence scoring. Low-confidence records are routed to human review before they ever reach your importer.",
        },
        {
          title: "Pull, don't poll",
          body: "Validated records assemble into Import Packages per organization. One ZIP, all bundles, one GET — your importer runs on a daily cadence and acknowledges what it took.",
        },
        {
          title: "Standards-aligned",
          body: "FHIR R4 by default: Patient, Encounter, Observation, Condition, MedicationRequest. No translation between Pierflow and a modern clinical system.",
        },
      ]}
    />
  );
}
