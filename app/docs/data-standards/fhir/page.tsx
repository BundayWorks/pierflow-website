import {
  DocPageHeader,
  H2,
  Body,
  Lead,
  KVTable,
  Callout,
  PrevNext,
} from "@/components/docs/primitives";
import { neighbors } from "@/components/docs/nav-helpers";

export default function Page() {
  const { prev, next } = neighbors("data-standards/fhir");
  return (
    <article>
      <DocPageHeader
        eyebrow="Data standards"
        title="FHIR R4 mapping"
        description="Every canonical resource is bidirectionally mapped to its FHIR R4 equivalent. You can keep working in the Pierflow shape, or pull FHIR-native representations when you need them."
      />

      <Lead>
        FHIR is the lingua franca of health data exchange. Pierflow speaks
        both — its own concise shapes by default, FHIR R4 when you need to
        cross system boundaries.
      </Lead>

      <H2 id="mappings">Canonical ↔ FHIR</H2>
      <KVTable
        headers={["Pierflow resource", "FHIR R4 resource"]}
        rows={[
          ["Plan", "InsurancePlan"],
          ["Policy", "Coverage"],
          ["Member", "Patient"],
          ["Provider", "Organization + Location + Practitioner"],
          ["Claim", "Claim + ClaimResponse"],
          ["Encounter (Phase 2)", "Encounter"],
          ["Authorisation", "CoverageEligibilityRequest + Response"],
        ]}
      />

      <H2 id="fhir-endpoints">Retrieving as FHIR</H2>
      <Body>
        Append <code>?format=fhir</code> to any GET request, or use the{" "}
        <code>/v1/fhir/*</code> endpoints for fully FHIR-native interaction.
      </Body>

      <Callout kind="info">
        FHIR support is read-only in MVP. FHIR-native writes ship in v1.2.
      </Callout>

      <PrevNext prev={prev} next={next} />
    </article>
  );
}
