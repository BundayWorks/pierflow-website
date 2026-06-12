/**
 * FHIR R4 resource builders for Pierflow Cover.
 *
 * Transforms Prisma models (HmoEnrollment, HmoClaim, HmoPlan, etc.)
 * into FHIR R4 resources for upsert to Medplum. Each builder is
 * defensive: missing fields are skipped, not faked.
 *
 * Uses @medplum/fhirtypes for type safety. The Pierflow identifier
 * system is "https://pierflow.com/cover/<resource-type>".
 *
 * 9 resources:
 *   Patient, Organization, Practitioner, Coverage,
 *   CoverageEligibilityRequest, CoverageEligibilityResponse,
 *   Claim, ClaimResponse, ExplanationOfBenefit
 */

import type {
  Patient,
  Organization as FhirOrganization,
  Practitioner,
  Coverage,
  CoverageEligibilityRequest,
  CoverageEligibilityResponse,
  Claim,
  ClaimResponse,
  ExplanationOfBenefit,
  CodeableConcept,
  Money,
} from "@medplum/fhirtypes";
import type { CountryProfile } from "@/lib/cover/countries/index.ts";

type CurrencyCode = Money["currency"];

// ─────────────────────────────────────────────────────────────────────
// Identifier system URIs
// ─────────────────────────────────────────────────────────────────────

const PIERFLOW = "https://pierflow.com/cover";
const SYSTEM_PATIENT = `${PIERFLOW}/enrollment`;
const SYSTEM_ORG = `${PIERFLOW}/organization`;
const SYSTEM_PROVIDER = `${PIERFLOW}/network-provider`;
const SYSTEM_COVERAGE = `${PIERFLOW}/coverage`;
const SYSTEM_CLAIM = `${PIERFLOW}/claim`;

// ─────────────────────────────────────────────────────────────────────
// Input shapes (projections from Prisma includes)
// ─────────────────────────────────────────────────────────────────────

/** Enrollment with its relations as loaded by the sync layer. */
export type EnrollmentForFhir = {
  id: string;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  effectiveFrom?: Date | null;
  effectiveTo?: Date | null;
  status: string; // HmoEnrollmentStatus
  fintechUserRef: string;
  hmoPolicyId?: string | null;
  hmoMemberId?: string | null;
  wholesaleNgn: bigint;
  markupNgn: bigint;
  memberPaysNgn: bigint;
  contractVersion: number;
  identityVerification?: {
    fullName: string;
    dateOfBirth: Date;
    sex?: string | null;
    ninLast4?: string | null;
    bvnLast4?: string | null;
    ninHash?: string | null;
    bvnHash?: string | null;
  } | null;
  plan?: {
    id: string;
    name: string;
    externalId: string;
    scope: string;
    coverage: unknown;
  } | null;
  provider?: {
    id: string;
    slug: string;
    displayName: string;
    organization: {
      id: string;
      name: string;
      type: string;
      slug?: string | null;
      state?: string | null;
      country: string;
    };
  } | null;
};

export type ClaimForFhir = {
  id: string;
  enrollmentId: string;
  fintechUserRef: string;
  hmoClaimId?: string | null;
  serviceDate: Date;
  serviceType?: string | null;
  facilityName?: string | null;
  amountNgn: bigint;
  diagnosisCodes: string[];
  procedureCodes: string[];
  notes?: string | null;
  status: string; // HmoClaimStatus
  approvedAmountNgn?: bigint | null;
  paidAmountNgn?: bigint | null;
  rejectionReason?: string | null;
  createdAt: Date;
};

export type NetworkProviderForFhir = {
  id: string;
  externalId: string;
  name: string;
  type: string;
  state?: string | null;
  lga?: string | null;
  street?: string | null;
  specialties: string[];
  contactPhone?: string | null;
  contactEmail?: string | null;
};

export type OrgForFhir = {
  id: string;
  name: string;
  type: string;
  slug?: string | null;
  state?: string | null;
  country: string;
  contactEmail?: string | null;
  contactPhone?: string | null;
};

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────

const KOBO_PER_NAIRA = BigInt(100);

function koboToDecimal(kobo: bigint): string {
  const naira = Number(kobo) / 100;
  return naira.toFixed(2);
}

function splitName(text: string): { family?: string; given?: string[] } {
  const parts = text.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return {};
  if (parts.length === 1) return { family: parts[0] };
  return { family: parts[parts.length - 1], given: parts.slice(0, -1) };
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function mapEnrollmentStatusToCoverage(
  status: string,
): "active" | "cancelled" | "draft" | "entered-in-error" {
  switch (status) {
    case "ACTIVE":
      return "active";
    case "CANCELLED":
    case "LAPSED":
    case "FAILED":
      return "cancelled";
    case "CREATED":
    case "PENDING_PAYMENT":
    case "PENDING_HMO":
      return "draft";
    default:
      return "draft";
  }
}

function mapClaimStatus(
  status: string,
): "active" | "cancelled" | "draft" | "entered-in-error" {
  switch (status) {
    case "SUBMITTED":
    case "PENDING_HMO":
    case "UNDER_REVIEW":
      return "active";
    case "APPROVED":
    case "PAID":
      return "active";
    case "REJECTED":
      return "cancelled";
    default:
      return "draft";
  }
}

function mapClaimResponseOutcome(
  status: string,
): "queued" | "complete" | "error" | "partial" {
  switch (status) {
    case "APPROVED":
    case "PAID":
      return "complete";
    case "REJECTED":
      return "error";
    case "UNDER_REVIEW":
      return "queued";
    default:
      return "queued";
  }
}

// ─────────────────────────────────────────────────────────────────────
// 1. Patient
// ─────────────────────────────────────────────────────────────────────

export function buildPatient(
  enrollment: EnrollmentForFhir,
  country: CountryProfile,
): Patient {
  const identifiers: Patient["identifier"] = [
    { system: SYSTEM_PATIENT, value: enrollment.id },
  ];

  // National identifiers from IdentityVerification.
  const iv = enrollment.identityVerification;
  if (iv) {
    for (const sys of country.identifierSystems) {
      if (sys.docType === "NIN" && iv.ninHash) {
        identifiers.push({
          system: sys.system,
          value: iv.ninLast4 ? `****${iv.ninLast4}` : "verified",
        });
      }
      if (sys.docType === "BVN" && iv.bvnHash) {
        identifiers.push({
          system: sys.system,
          value: iv.bvnLast4 ? `****${iv.bvnLast4}` : "verified",
        });
      }
    }
  }

  // HMO member id as identifier if present.
  if (enrollment.hmoMemberId) {
    identifiers.push({
      system: `${PIERFLOW}/hmo-member`,
      value: enrollment.hmoMemberId,
    });
  }

  const displayName = iv?.fullName ?? enrollment.fullName;
  const { family, given } = splitName(displayName);

  const telecom: Patient["telecom"] = [];
  if (enrollment.phone) {
    telecom.push({ system: "phone", value: enrollment.phone });
  }
  if (enrollment.email) {
    telecom.push({ system: "email", value: enrollment.email });
  }

  const sex = iv?.sex ?? undefined;
  const gender: Patient["gender"] =
    sex === "M" ? "male" : sex === "F" ? "female" : "unknown";

  return {
    resourceType: "Patient",
    identifier: identifiers,
    name: [
      {
        use: "official",
        text: displayName,
        family,
        given,
      },
    ],
    gender,
    birthDate: iv?.dateOfBirth ? isoDate(iv.dateOfBirth) : undefined,
    telecom: telecom.length > 0 ? telecom : undefined,
  };
}

// ─────────────────────────────────────────────────────────────────────
// 2. Organization
// ─────────────────────────────────────────────────────────────────────

export function buildOrganization(org: OrgForFhir): FhirOrganization {
  const identifiers: FhirOrganization["identifier"] = [
    { system: SYSTEM_ORG, value: org.id },
  ];
  if (org.slug) {
    identifiers.push({ system: `${PIERFLOW}/slug`, value: org.slug });
  }

  const telecom: FhirOrganization["telecom"] = [];
  if (org.contactEmail) {
    telecom.push({ system: "email", value: org.contactEmail });
  }
  if (org.contactPhone) {
    telecom.push({ system: "phone", value: org.contactPhone });
  }

  return {
    resourceType: "Organization",
    identifier: identifiers,
    name: org.name,
    type: [
      {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/organization-type",
            code: org.type === "INSURER" ? "ins" : "prov",
            display: org.type === "INSURER" ? "Insurance Company" : "Healthcare Provider",
          },
        ],
      },
    ],
    telecom: telecom.length > 0 ? telecom : undefined,
    address: org.state
      ? [{ state: org.state, country: org.country }]
      : undefined,
  };
}

// ─────────────────────────────────────────────────────────────────────
// 3. Practitioner (network facility stub)
// ─────────────────────────────────────────────────────────────────────

export function buildPractitioner(
  provider: NetworkProviderForFhir,
): Practitioner {
  return {
    resourceType: "Practitioner",
    identifier: [{ system: SYSTEM_PROVIDER, value: provider.id }],
    name: [{ text: provider.name }],
    telecom: [
      ...(provider.contactPhone
        ? [{ system: "phone" as const, value: provider.contactPhone }]
        : []),
      ...(provider.contactEmail
        ? [{ system: "email" as const, value: provider.contactEmail }]
        : []),
    ].length
      > 0
      ? [
          ...(provider.contactPhone
            ? [{ system: "phone" as const, value: provider.contactPhone }]
            : []),
          ...(provider.contactEmail
            ? [{ system: "email" as const, value: provider.contactEmail }]
            : []),
        ]
      : undefined,
    qualification: provider.specialties.length > 0
      ? provider.specialties.map((s) => ({
          code: { text: s },
        }))
      : undefined,
  };
}

// ─────────────────────────────────────────────────────────────────────
// 4. Coverage
// ─────────────────────────────────────────────────────────────────────

export function buildCoverage(
  enrollment: EnrollmentForFhir,
  patientRef: string,
  orgRef: string,
  country: CountryProfile,
): Coverage {
  return {
    resourceType: "Coverage",
    identifier: [{ system: SYSTEM_COVERAGE, value: enrollment.id }],
    status: mapEnrollmentStatusToCoverage(enrollment.status),
    type: {
      coding: [
        {
          system: "http://terminology.hl7.org/CodeSystem/v3-ActCode",
          code: "HIP",
          display: "health insurance plan policy",
        },
      ],
    },
    subscriber: { reference: patientRef },
    beneficiary: { reference: patientRef },
    payor: [{ reference: orgRef }],
    period:
      enrollment.effectiveFrom || enrollment.effectiveTo
        ? {
            start: enrollment.effectiveFrom
              ? isoDate(enrollment.effectiveFrom)
              : undefined,
            end: enrollment.effectiveTo
              ? isoDate(enrollment.effectiveTo)
              : undefined,
          }
        : undefined,
    class: enrollment.plan
      ? [
          {
            type: {
              coding: [
                {
                  system:
                    "http://terminology.hl7.org/CodeSystem/coverage-class",
                  code: "plan",
                },
              ],
            },
            value: enrollment.plan.externalId,
            name: enrollment.plan.name,
          },
        ]
      : undefined,
  };
}

// ─────────────────────────────────────────────────────────────────────
// 5. CoverageEligibilityRequest
// ─────────────────────────────────────────────────────────────────────

export function buildCoverageEligibilityRequest(opts: {
  patientRef: string;
  coverageRef: string;
  orgRef: string;
  serviceType?: string;
}): CoverageEligibilityRequest {
  return {
    resourceType: "CoverageEligibilityRequest",
    status: "active",
    purpose: ["benefits"],
    patient: { reference: opts.patientRef },
    created: new Date().toISOString().slice(0, 10),
    insurer: { reference: opts.orgRef },
    insurance: [
      {
        coverage: { reference: opts.coverageRef },
      },
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────
// 6. CoverageEligibilityResponse
// ─────────────────────────────────────────────────────────────────────

/**
 * Builds a CoverageEligibilityResponse from the plan's coverage JSONB
 * and the country's benefit codes. The coverage JSONB shape follows
 * the Universal Plan Schema: { outpatient: { covered, limit, ... }, ... }
 */
export function buildCoverageEligibilityResponse(opts: {
  requestRef: string;
  patientRef: string;
  orgRef: string;
  planCoverage: Record<string, unknown>;
  planName: string;
  country: CountryProfile;
  isEligible: boolean;
}): CoverageEligibilityResponse {
  const currency = opts.country.currency as CurrencyCode;

  // Map plan coverage keys to benefit items.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items: any[] = [];

  for (const [key, value] of Object.entries(opts.planCoverage)) {
    if (!value || typeof value !== "object") continue;
    const detail = value as Record<string, unknown>;
    const covered = detail.covered !== false;

    // Try to find a matching benefit code from the country profile.
    const benefitCode = matchBenefitCode(key, opts.country);

    const category: CodeableConcept = benefitCode
      ? {
          coding: [
            {
              system: "http://terminology.hl7.org/CodeSystem/ex-benefitcategory",
              code: benefitCode.code,
              display: benefitCode.display,
            },
          ],
          text: key,
        }
      : { text: key };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const item: any = { category, excluded: !covered };

    // Add monetary limit if present.
    if (typeof detail.limit === "number" && detail.limit > 0) {
      item.benefit = [
        {
          type: { text: "Annual limit" },
          allowedMoney: { value: detail.limit, currency },
        },
      ];
    }

    items.push(item);
  }

  return {
    resourceType: "CoverageEligibilityResponse",
    status: "active",
    purpose: ["benefits"],
    patient: { reference: opts.patientRef },
    created: new Date().toISOString().slice(0, 10),
    request: { reference: opts.requestRef },
    insurer: { reference: opts.orgRef },
    outcome: opts.isEligible ? "complete" : "error",
    insurance: [
      {
        coverage: { display: opts.planName },
        inforce: opts.isEligible,
        item: items.length > 0 ? items : undefined,
      },
    ],
  };
}

function matchBenefitCode(
  key: string,
  country: CountryProfile,
): { code: string; display: string } | undefined {
  const normalized = key.toLowerCase().replace(/[_-]/g, " ");
  // Map common plan coverage keys to standard benefit category codes.
  const keyMap: Record<string, string> = {
    outpatient: "50",
    inpatient: "47",
    hospital: "47",
    dental: "35",
    optical: "11",
    vision: "F6",
    maternity: "69",
    surgical: "2",
    consultation: "3",
    diagnostic: "5",
    lab: "5",
    medical: "F1",
    hospice: "45",
  };

  for (const [pattern, code] of Object.entries(keyMap)) {
    if (normalized.includes(pattern)) {
      return country.benefitCodes.find((b) => b.code === code);
    }
  }
  return undefined;
}

// ─────────────────────────────────────────────────────────────────────
// 7. Claim
// ─────────────────────────────────────────────────────────────────────

export function buildClaim(
  claim: ClaimForFhir,
  patientRef: string,
  orgRef: string,
  country: CountryProfile,
): Claim {
  const diagnosis: Claim["diagnosis"] = claim.diagnosisCodes.map((code, i) => ({
    sequence: i + 1,
    diagnosisCodeableConcept: {
      coding: [
        {
          system: "http://hl7.org/fhir/sid/icd-10",
          code,
        },
      ],
    },
  }));

  const procedure: Claim["procedure"] = claim.procedureCodes.length > 0
    ? claim.procedureCodes.map((code, i) => ({
        sequence: i + 1,
        procedureCodeableConcept: {
          coding: [{ system: "http://www.ama-assn.org/go/cpt", code }],
        },
      }))
    : undefined;

  return {
    resourceType: "Claim",
    identifier: [{ system: SYSTEM_CLAIM, value: claim.id }],
    status: mapClaimStatus(claim.status),
    type: {
      coding: [
        {
          system: "http://terminology.hl7.org/CodeSystem/claim-type",
          code: claim.serviceType === "inpatient" ? "institutional" : "professional",
        },
      ],
    },
    use: "claim",
    patient: { reference: patientRef },
    created: claim.createdAt.toISOString(),
    insurer: { reference: orgRef },
    provider: { reference: orgRef },
    priority: { coding: [{ code: "normal" }] },
    diagnosis: diagnosis.length > 0 ? diagnosis : undefined,
    procedure,
    insurance: [
      {
        sequence: 1,
        focal: true,
        coverage: { display: `Enrollment ${claim.enrollmentId}` },
      },
    ],
    item: [
      {
        sequence: 1,
        productOrService: {
          text: claim.serviceType ?? "Healthcare service",
        },
        servicedDate: isoDate(claim.serviceDate),
        unitPrice: {
          value: Number(koboToDecimal(claim.amountNgn)),
          currency: country.currency as CurrencyCode,
        },
        net: {
          value: Number(koboToDecimal(claim.amountNgn)),
          currency: country.currency as CurrencyCode,
        },
      },
    ],
    total: {
      value: Number(koboToDecimal(claim.amountNgn)),
      currency: country.currency as CurrencyCode,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────
// 8. ClaimResponse
// ─────────────────────────────────────────────────────────────────────

export function buildClaimResponse(
  claim: ClaimForFhir,
  claimRef: string,
  patientRef: string,
  orgRef: string,
  country: CountryProfile,
): ClaimResponse {
  const resolvedAmount =
    claim.paidAmountNgn ?? claim.approvedAmountNgn ?? claim.amountNgn;

  return {
    resourceType: "ClaimResponse",
    identifier: [{ system: `${SYSTEM_CLAIM}/response`, value: claim.id }],
    status: mapClaimStatus(claim.status),
    type: {
      coding: [
        {
          system: "http://terminology.hl7.org/CodeSystem/claim-type",
          code: claim.serviceType === "inpatient" ? "institutional" : "professional",
        },
      ],
    },
    use: "claim",
    patient: { reference: patientRef },
    created: new Date().toISOString(),
    insurer: { reference: orgRef },
    request: { reference: claimRef },
    outcome: mapClaimResponseOutcome(claim.status),
    disposition: claim.rejectionReason ?? undefined,
    item: [
      {
        itemSequence: 1,
        adjudication: [
          {
            category: {
              coding: [
                {
                  system: "http://terminology.hl7.org/CodeSystem/adjudication",
                  code: "submitted",
                },
              ],
            },
            amount: {
              value: Number(koboToDecimal(claim.amountNgn)),
              currency: country.currency as CurrencyCode,
            },
          },
          {
            category: {
              coding: [
                {
                  system: "http://terminology.hl7.org/CodeSystem/adjudication",
                  code: "benefit",
                },
              ],
            },
            amount: {
              value: Number(koboToDecimal(resolvedAmount)),
              currency: country.currency as CurrencyCode,
            },
          },
        ],
      },
    ],
    total: [
      {
        category: {
          coding: [
            {
              system: "http://terminology.hl7.org/CodeSystem/adjudication",
              code: "benefit",
            },
          ],
        },
        amount: {
          value: Number(koboToDecimal(resolvedAmount)),
          currency: country.currency as CurrencyCode,
        },
      },
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────
// 9. ExplanationOfBenefit
// ─────────────────────────────────────────────────────────────────────

export function buildExplanationOfBenefit(
  claim: ClaimForFhir,
  enrollment: EnrollmentForFhir,
  claimRef: string,
  patientRef: string,
  orgRef: string,
  country: CountryProfile,
): ExplanationOfBenefit {
  const resolvedAmount =
    claim.paidAmountNgn ?? claim.approvedAmountNgn ?? claim.amountNgn;

  return {
    resourceType: "ExplanationOfBenefit",
    identifier: [{ system: `${SYSTEM_CLAIM}/eob`, value: claim.id }],
    status: claim.status === "PAID" ? "active" : "draft",
    type: {
      coding: [
        {
          system: "http://terminology.hl7.org/CodeSystem/claim-type",
          code: claim.serviceType === "inpatient" ? "institutional" : "professional",
        },
      ],
    },
    use: "claim",
    patient: { reference: patientRef },
    created: new Date().toISOString(),
    insurer: { reference: orgRef },
    provider: { reference: orgRef },
    claim: { reference: claimRef },
    outcome: mapClaimResponseOutcome(claim.status),
    disposition: claim.rejectionReason ?? undefined,
    insurance: [
      {
        focal: true,
        coverage: {
          display: enrollment.plan?.name ?? "Health Insurance",
        },
      },
    ],
    item: [
      {
        sequence: 1,
        productOrService: {
          text: claim.serviceType ?? "Healthcare service",
        },
        servicedDate: isoDate(claim.serviceDate),
        adjudication: [
          {
            category: {
              coding: [
                {
                  system: "http://terminology.hl7.org/CodeSystem/adjudication",
                  code: "submitted",
                },
              ],
            },
            amount: {
              value: Number(koboToDecimal(claim.amountNgn)),
              currency: country.currency as CurrencyCode,
            },
          },
          {
            category: {
              coding: [
                {
                  system: "http://terminology.hl7.org/CodeSystem/adjudication",
                  code: "benefit",
                },
              ],
            },
            amount: {
              value: Number(koboToDecimal(resolvedAmount)),
              currency: country.currency as CurrencyCode,
            },
          },
        ],
      },
    ],
    total: [
      {
        category: {
          coding: [
            {
              system: "http://terminology.hl7.org/CodeSystem/adjudication",
              code: "submitted",
            },
          ],
        },
        amount: {
          value: Number(koboToDecimal(claim.amountNgn)),
          currency: country.currency as CurrencyCode,
        },
      },
      {
        category: {
          coding: [
            {
              system: "http://terminology.hl7.org/CodeSystem/adjudication",
              code: "benefit",
            },
          ],
        },
        amount: {
          value: Number(koboToDecimal(resolvedAmount)),
          currency: country.currency as CurrencyCode,
        },
      },
    ],
  };
}
