/**
 * Country profiles for Pierflow Cover.
 *
 * Each profile supplies locale-specific constants the FHIR builders
 * and portal UI consume: currency, identifier systems, benefit codes,
 * and timezone. Loaded once from the COUNTRY_PROFILE env var (default
 * "ng" — Nigeria).
 */

export type IdentifierSystem = {
  /** FHIR identifier system URI */
  system: string;
  /** Human-readable label (e.g. "National ID Number") */
  label: string;
  /** Short code used in Pierflow's IdentityVerification.docType */
  docType: string;
};

export type CountryProfile = {
  /** ISO 3166-1 alpha-2, lowercased */
  code: string;
  /** Human-readable country name */
  name: string;
  /** ISO 4217 currency code */
  currency: string;
  /** Subunit multiplier (e.g. 100 for kobo/cents) */
  subunitMultiplier: number;
  /** Subunit label (e.g. "kobo") */
  subunitLabel: string;
  /** IANA timezone for display / cron scheduling */
  timezone: string;
  /** National identifier systems accepted for patient matching */
  identifierSystems: IdentifierSystem[];
  /** NHIA / national benefit category codes (used in CoverageEligibilityResponse) */
  benefitCodes: { code: string; display: string }[];
};

// Lazy-load country modules to keep the initial bundle lean.
const loaders: Record<string, () => Promise<{ profile: CountryProfile }>> = {
  ng: () => import("./ng.ts"),
  lr: () => import("./lr.ts"),
  sl: () => import("./sl.ts"),
};

let cached: CountryProfile | undefined;

export async function getCountryProfile(): Promise<CountryProfile> {
  if (cached) return cached;
  const code = (process.env.COUNTRY_PROFILE ?? "ng").toLowerCase();
  const loader = loaders[code];
  if (!loader) {
    throw new Error(
      `Unknown COUNTRY_PROFILE "${code}". Supported: ${Object.keys(loaders).join(", ")}`,
    );
  }
  const mod = await loader();
  cached = mod.profile;
  return cached;
}
