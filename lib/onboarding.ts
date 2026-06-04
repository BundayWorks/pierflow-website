/**
 * Onboarding flow constants — shared between the public /get-started
 * pages and the partner signup server action that consumes them.
 *
 * Use case options are partner-type-aware so a Government user doesn't
 * see "Onboard providers" and an EMR vendor doesn't see "Disease
 * surveillance". Each option is a stable string we persist to
 * Partner.primaryUseCase so we can group + report on it later.
 */

import type { PartnerType } from "@prisma/client";

export type AudienceOption = {
  type: PartnerType;
  label: string;
  description: string;
};

export const AUDIENCE_OPTIONS: AudienceOption[] = [
  {
    type: "EMR_VENDOR",
    label: "EMR / HMS / EHR vendor",
    description:
      "You build clinical software and want to ingest digitised records into your system.",
  },
  {
    type: "INSURER",
    label: "Insurer / HMO / Payer",
    description:
      "You process claims and want verified records for members and providers.",
  },
  {
    type: "ANALYTICS",
    label: "Health platform, analytics, or fintech",
    description:
      "You aggregate health data for an app, dashboards, underwriting, or risk models.",
  },
  {
    type: "GOVERNMENT",
    label: "Government / research / NGO",
    description:
      "You coordinate health programmes, surveillance, or population studies.",
  },
];

const USE_CASES_BY_TYPE: Record<PartnerType, string[]> = {
  EMR_VENDOR: [
    "Onboard new providers",
    "Migrate paper / legacy records",
    "Continuity of care across facilities",
    "Other",
  ],
  HMS_VENDOR: [
    "Onboard new facilities",
    "Migrate paper / legacy records",
    "Continuity of care across facilities",
    "Other",
  ],
  EHR_VENDOR: [
    "Onboard new facilities",
    "Migrate paper / legacy records",
    "Continuity of care across facilities",
    "Other",
  ],
  INSURER: [
    "Member onboarding / KYC",
    "Claims verification",
    "Provider network audit",
    "Other",
  ],
  ANALYTICS: [
    "Records aggregation",
    "Patient-facing app",
    "Underwriting / risk scoring",
    "Other",
  ],
  GOVERNMENT: [
    "Programme reporting",
    "Disease surveillance",
    "Population health",
    "Other",
  ],
  OTHER: [
    "Records aggregation",
    "Patient-facing app",
    "Programme reporting",
    "Other",
  ],
};

export function useCasesFor(type: PartnerType): string[] {
  return USE_CASES_BY_TYPE[type] ?? USE_CASES_BY_TYPE.OTHER;
}

export const VOLUME_OPTIONS = [
  "< 1,000 records / month",
  "1,000 – 10,000 records / month",
  "10,000 – 100,000 records / month",
  "100,000+ records / month",
];

export const TIMELINE_OPTIONS = [
  "Exploring",
  "Integrating in 1–3 months",
  "Going live this quarter",
  "Already in production",
];

export const PARTNER_TYPES = AUDIENCE_OPTIONS.map((o) => o.type);

export type OnboardingDraft = {
  partnerType: PartnerType;
  primaryUseCase: string;
  expectedVolume: string;
  timeline: string;
};

export const SESSION_STORAGE_KEY = "pf:get-started:draft";
