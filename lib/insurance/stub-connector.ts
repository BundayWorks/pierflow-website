/**
 * Stub HMO connector — synthesises a fake `hmoPolicyId` and returns
 * ACTIVE without calling any external system. Used when the active
 * EMR vendor integration isn't wired (sandbox + dev + early staging).
 *
 * Implements only the methods the enrollment flow currently calls:
 *   • enrollMember
 *   • cancelPolicy
 *
 * Real connector implementations (LinkHMS, Reliance direct, etc.)
 * land alongside this file and the orchestrator picks the right one
 * at runtime based on the HmoProvider's connector metadata.
 */

import { randomBytes } from "node:crypto";

export type StubEnrollInput = {
  planExternalId: string;
  fullName: string;
  partnerMemberRef: string;
  effectiveFrom?: string;
};

export type StubEnrollResult = {
  hmoPolicyId: string;
  hmoMemberId: string;
  status: "ACTIVE" | "PENDING_HMO";
  effectiveFrom: string;
  raw: Record<string, unknown>;
};

/**
 * Synthesise a fake HMO policy. Returns immediately with an ACTIVE
 * status — the real connector would queue the request, poll for
 * status, and call back to update.
 */
export async function stubEnrollMember(
  input: StubEnrollInput,
): Promise<StubEnrollResult> {
  const hmoPolicyId = `STUB-${input.planExternalId}-${shortId()}`;
  const hmoMemberId = `STUB-MBR-${shortId()}`;
  const effectiveFrom = input.effectiveFrom ?? new Date().toISOString();
  return {
    hmoPolicyId,
    hmoMemberId,
    status: "ACTIVE",
    effectiveFrom,
    raw: {
      stub: true,
      partner_member_ref: input.partnerMemberRef,
      plan_external_id: input.planExternalId,
    },
  };
}

export async function stubCancelPolicy(
  hmoPolicyId: string,
  reason: string,
): Promise<{ terminationDate: string; raw: Record<string, unknown> }> {
  return {
    terminationDate: new Date().toISOString(),
    raw: { stub: true, hmoPolicyId, reason },
  };
}

// ─────────────────────────────────────────────────────────────────────
// Claims connector — same pattern, sandbox-only
// ─────────────────────────────────────────────────────────────────────

export type StubSubmitClaimInput = {
  hmoPolicyId: string;
  amountNgn: bigint;
  serviceDate: string;
  diagnosisCodes: string[];
  notes?: string | null;
};

export type StubClaimStatus =
  | "SUBMITTED"
  | "PENDING_HMO"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "PAID";

export type StubSubmitClaimResult = {
  hmoClaimId: string;
  status: StubClaimStatus;
  raw: Record<string, unknown>;
};

/**
 * Submit a claim to the HMO. Synthesises a fake claim id and
 * returns PENDING_HMO. Magic notes drive sandbox test paths:
 *   notes contains "test_reject" → REJECTED on next poll
 *   notes contains "test_fast_approve" → APPROVED on next poll
 *   otherwise → walks SUBMITTED → UNDER_REVIEW → APPROVED → PAID
 *     across successive poll calls, ~30s spacing.
 */
export async function stubSubmitClaim(
  input: StubSubmitClaimInput,
): Promise<StubSubmitClaimResult> {
  return {
    hmoClaimId: `STUB-CLM-${shortId()}`,
    status: "PENDING_HMO",
    raw: {
      stub: true,
      hmo_policy_id: input.hmoPolicyId,
      amount_ngn: input.amountNgn.toString(),
      service_date: input.serviceDate,
      diagnosis_codes: input.diagnosisCodes,
    },
  };
}

/**
 * Poll the HMO for the current status of a claim. The stub progresses
 * a deterministic chain based on the claim's age + notes string the
 * caller passes in. The caller is responsible for tracking which
 * state we last saw.
 */
export async function stubGetClaimStatus(input: {
  hmoClaimId: string;
  currentStatus: StubClaimStatus;
  notesHint?: string | null;
  ageMs: number;
}): Promise<{
  status: StubClaimStatus;
  approvedAmountNgn?: bigint;
  paidAmountNgn?: bigint;
  rejectionReason?: string;
  raw: Record<string, unknown>;
}> {
  const notes = (input.notesHint ?? "").toLowerCase();
  if (notes.includes("test_reject")) {
    return {
      status: "REJECTED",
      rejectionReason: "Sandbox: claim explicitly marked test_reject",
      raw: { stub: true, claim_id: input.hmoClaimId },
    };
  }
  if (notes.includes("test_fast_approve")) {
    return {
      status: "APPROVED",
      approvedAmountNgn: BigInt(0),
      raw: { stub: true, claim_id: input.hmoClaimId },
    };
  }
  // Deterministic progression: each poll advances the state. The
  // ageMs hint gives us a soft pacing — minimum 10 seconds between
  // transitions in sandbox so the lifecycle is observable.
  const next = nextStatus(input.currentStatus, input.ageMs);
  return {
    status: next,
    ...(next === "APPROVED" || next === "PAID"
      ? { approvedAmountNgn: BigInt(0), paidAmountNgn: BigInt(0) }
      : {}),
    raw: { stub: true, claim_id: input.hmoClaimId, advanced: next !== input.currentStatus },
  };
}

function nextStatus(s: StubClaimStatus, ageMs: number): StubClaimStatus {
  const minStepMs = 10_000;
  if (ageMs < minStepMs) return s; // throttle
  if (s === "SUBMITTED" || s === "PENDING_HMO") return "UNDER_REVIEW";
  if (s === "UNDER_REVIEW") return "APPROVED";
  if (s === "APPROVED") return "PAID";
  return s;
}

// ─────────────────────────────────────────────────────────────────────
// Provider network — sandbox-only synthetic data
// ─────────────────────────────────────────────────────────────────────

export type StubNetworkProvider = {
  external_id: string;
  name: string;
  type: "HOSPITAL" | "CLINIC" | "LAB" | "PHARMACY" | "OTHER";
  state: string;
  lga: string;
  street?: string;
  latitude?: number;
  longitude?: number;
  specialties: string[];
  contact_phone?: string;
  tier?: number;
};

/**
 * Return synthetic network providers for an HMO. The real connector
 * would call out to the EMR vendor's provider-list endpoint. The
 * stub returns a fixed set of well-known Lagos / Abuja hospitals so
 * the rest of the system has data to test against.
 */
export async function stubListNetworkProviders(input: {
  hmoSlug: string;
}): Promise<StubNetworkProvider[]> {
  // Slug isn't used by the stub — same network for every HMO. Real
  // connectors would scope this. We tag the external ids with the
  // slug prefix for traceability so they don't collide across HMOs.
  const prefix = (input.hmoSlug || "stub").toUpperCase();
  return BASE_PROVIDERS.map((p) => ({
    ...p,
    external_id: `${prefix}-${p.external_id}`,
  }));
}

const BASE_PROVIDERS: StubNetworkProvider[] = [
  {
    external_id: "REDDINGTON-IKEJA",
    name: "Reddington Hospital — Ikeja",
    type: "HOSPITAL",
    state: "Lagos",
    lga: "Ikeja",
    street: "12 Isaac John St",
    latitude: 6.6018,
    longitude: 3.3515,
    specialties: ["cardiology", "oncology", "maternity", "emergency"],
    contact_phone: "+2347001000000",
    tier: 1,
  },
  {
    external_id: "LAGOON-VI",
    name: "Lagoon Hospital — Victoria Island",
    type: "HOSPITAL",
    state: "Lagos",
    lga: "Eti-Osa",
    street: "8 Marine Rd",
    latitude: 6.4274,
    longitude: 3.4196,
    specialties: ["cardiology", "orthopaedics", "maternity"],
    contact_phone: "+2347001000001",
    tier: 1,
  },
  {
    external_id: "GENERAL-IKORODU",
    name: "Ikorodu General Hospital",
    type: "HOSPITAL",
    state: "Lagos",
    lga: "Ikorodu",
    street: "Government Reserved Area",
    latitude: 6.6194,
    longitude: 3.5106,
    specialties: ["general", "emergency"],
    contact_phone: "+2347001000002",
    tier: 3,
  },
  {
    external_id: "ABUJA-NATIONAL",
    name: "National Hospital — Abuja",
    type: "HOSPITAL",
    state: "FCT",
    lga: "Abuja Municipal",
    street: "Plot 132 Garki",
    latitude: 9.0561,
    longitude: 7.4951,
    specialties: ["cardiology", "neurology", "oncology"],
    contact_phone: "+2347001000003",
    tier: 1,
  },
  {
    external_id: "CLINIX-LEKKI",
    name: "Clinix Family Practice — Lekki",
    type: "CLINIC",
    state: "Lagos",
    lga: "Eti-Osa",
    street: "Admiralty Way",
    latitude: 6.4419,
    longitude: 3.4729,
    specialties: ["primary_care", "paediatrics"],
    tier: 2,
  },
  {
    external_id: "PATHCARE-IKEJA",
    name: "PathCare Diagnostics — Ikeja",
    type: "LAB",
    state: "Lagos",
    lga: "Ikeja",
    street: "Allen Avenue",
    latitude: 6.5894,
    longitude: 3.3531,
    specialties: ["diagnostics"],
    tier: 1,
  },
];

function shortId(): string {
  return randomBytes(4).toString("hex").toUpperCase();
}
