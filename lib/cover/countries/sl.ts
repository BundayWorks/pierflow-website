/**
 * Sierra Leone country profile.
 */
import type { CountryProfile } from "./index.ts";

export const profile: CountryProfile = {
  code: "sl",
  name: "Sierra Leone",
  currency: "SLE",
  subunitMultiplier: 100,
  subunitLabel: "cents",
  timezone: "Africa/Freetown",

  identifierSystems: [
    {
      system: "https://ncra.gov.sl/nin",
      label: "National Identification Number",
      docType: "NIN",
    },
  ],

  benefitCodes: [
    { code: "1", display: "Medical Care" },
    { code: "2", display: "Surgical" },
    { code: "3", display: "Consultation" },
    { code: "5", display: "Diagnostic Lab" },
    { code: "47", display: "Hospital" },
    { code: "50", display: "Outpatient" },
    { code: "69", display: "Maternity" },
    { code: "F1", display: "Medical Coverage" },
  ],
};
