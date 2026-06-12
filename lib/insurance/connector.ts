/**
 * IHMOConnector — the standard interface every HMO integration implements.
 *
 * The core orchestration layer (quoting, enrollment, claims) knows nothing
 * about any specific HMO. It only calls this interface. Each HMO vendor —
 * an EMR vendor deployed at multiple HMOs, a direct HMO API, or a future
 * manual-ops adapter for HMOs with no API at all — is a class that
 * implements `IHMOConnector`.
 *
 * Three maturity tiers we accommodate (architecture spec §4.2):
 *   • Tier 1 — full REST API. Connector is a thin schema translator.
 *   • Tier 2 — partial API + file exchange. Connector handles both.
 *   • Tier 3 — no API. Connector enqueues to an internal ops queue;
 *     staff complete manually and confirm in a dashboard.
 *
 * Freshness model:
 *   • The connector pushes the catalogue to Pierflow on a schedule
 *     (`syncCatalogue`) and ideally on every change (`receiveChangeNotification`
 *     — implemented by Pierflow's inbound webhook handler, not the
 *     connector itself).
 *   • Pierflow caches the catalogue and serves it to fintechs for
 *     browsing.
 *   • Before any binding action (quote lock, enrollment), Pierflow calls
 *     `verifyPlan` to confirm the plan is still active and the price is
 *     still what we think. The HMO stays the source of truth.
 *
 * All money is NGN minor units (kobo). All timestamps ISO-8601 UTC.
 */

import type { UniversalPlan } from "@/lib/insurance/plan-schema";

// ─────────────────────────────────────────────────────────────────────
// Common request / response shapes
// ─────────────────────────────────────────────────────────────────────

export type ConnectorContext = {
  /** The HmoProvider this connector is operating on behalf of. */
  providerId: string;
  /** Connector-specific config (credentials, base URLs, mappings) — opaque to the core. */
  config: Record<string, unknown>;
};

export type PlanFilters = {
  /** Filter by Universal Plan Schema scope. */
  scope?: "INDIVIDUAL" | "FAMILY" | "EMPLOYEE_GROUP" | "STUDENT" | "OTHER";
  /** Only return ACTIVE plans by default. */
  status?: "DRAFT" | "ACTIVE" | "WITHDRAWN";
  /** State / LGA filters for plans with geographic restrictions. */
  state?: string;
  lga?: string;
};

export type MemberIdentity = {
  /** Either NIN or BVN — the connector decides which the HMO honours. */
  nin?: string;
  bvn?: string;
  fullName: string;
  dateOfBirth: string; // ISO date (YYYY-MM-DD)
  sex?: "M" | "F" | "U";
  phone?: string;
  email?: string;
};

export type VerificationResult = {
  /** 0–100 confidence the supplied identity matches a real Nigerian. */
  confidence: number;
  /** Field-level breakdown for the review surface. */
  fieldChecks: {
    name?: { matched: boolean; score: number };
    dateOfBirth?: { matched: boolean };
    sex?: { matched: boolean };
  };
  /**
   * The disposition the platform should take:
   *   AUTO_APPROVE (> 85), SOFT_REVIEW (60-85), REJECT (< 60).
   * Architecture spec §7.1.
   */
  disposition: "AUTO_APPROVE" | "SOFT_REVIEW" | "REJECT";
  /** Raw response payload for audit. */
  raw?: Record<string, unknown>;
};

export type EnrollmentRequest = {
  planExternalId: string;
  member: MemberIdentity;
  dependants?: MemberIdentity[];
  /** The fintech's reference for this user — round-tripped on every event. */
  partnerMemberRef: string;
  /** Optional quote id if the enrollment was preceded by a quote lock. */
  quoteRef?: string;
  effectiveFrom?: string; // ISO date
};

export type PolicyRecord = {
  /** HMO-native policy id — the source-of-truth identifier downstream. */
  hmoPolicyId: string;
  /** HMO-native member id (and one per dependant if applicable). */
  hmoMemberId: string;
  hmoDependantMemberIds?: string[];
  status: "ACTIVE" | "PENDING_PAYMENT" | "PENDING_HMO" | "FAILED";
  effectiveFrom: string;
  effectiveTo?: string;
  /** Raw HMO response for audit. */
  raw?: Record<string, unknown>;
};

export type PolicyStatusSnapshot = {
  hmoPolicyId: string;
  status:
    | "ACTIVE"
    | "PENDING_HMO"
    | "LAPSED"
    | "CANCELLED"
    | "TERMINATED"
    | "UNKNOWN";
  asOf: string;
  raw?: Record<string, unknown>;
};

export type ClaimRequest = {
  hmoPolicyId: string;
  providerId: string; // hospital / clinic id
  serviceDate: string; // ISO date
  amountNgn: bigint; // minor units
  diagnosisCodes: string[];
  procedureCodes?: string[];
  notes?: string;
};

export type ClaimRecord = {
  hmoClaimId: string;
  status: "SUBMITTED" | "PENDING_HMO" | "UNDER_REVIEW";
  receivedAt: string;
  raw?: Record<string, unknown>;
};

export type ClaimStatusSnapshot = {
  hmoClaimId: string;
  status:
    | "SUBMITTED"
    | "PENDING_HMO"
    | "UNDER_REVIEW"
    | "APPROVED"
    | "REJECTED"
    | "PAID";
  rejectionReason?: string;
  paidAmountNgn?: bigint;
  asOf: string;
  raw?: Record<string, unknown>;
};

export type ProviderFilters = {
  state?: string;
  lga?: string;
  specialty?: string;
  /** Limit to providers active on a specific plan. */
  planExternalId?: string;
};

export type NormalisedProvider = {
  /** HMO-native provider id. */
  hmoProviderRef: string;
  name: string;
  type: "hospital" | "clinic" | "lab" | "pharmacy" | "other";
  tier?: "primary" | "secondary" | "tertiary";
  street?: string;
  lga?: string;
  state?: string;
  coordinates?: { lat: number; lng: number };
  specialties?: string[];
  phone?: string;
  email?: string;
  operatingHours?: string;
};

export type AuthRequest = {
  hmoPolicyId: string;
  serviceCode: string; // procedure / service identifier
  facilityRef: string;
  estimatedAmountNgn?: bigint;
  notes?: string;
};

export type AuthResult = {
  hmoAuthId: string;
  status: "APPROVED" | "DENIED" | "PENDING";
  expiresAt?: string;
  raw?: Record<string, unknown>;
};

// ─────────────────────────────────────────────────────────────────────
// The interface itself
// ─────────────────────────────────────────────────────────────────────

export interface IHMOConnector {
  /**
   * Pull every plan from the HMO and return them in the Universal Plan
   * Schema. Used by the scheduled-sync job. Connectors that don't
   * support pull (push-only EMR vendors) should throw NotSupported and
   * rely on the catalogue-publish endpoint instead.
   */
  syncCatalogue(
    ctx: ConnectorContext,
    filters?: PlanFilters,
  ): Promise<UniversalPlan[]>;

  /**
   * Re-confirm a single plan is still active and unchanged right now.
   * Called immediately before any binding action — quote lock, enroll.
   * Returns the freshest plan snapshot the HMO has. If the connector
   * detects a change since the last sync, the caller updates the cache
   * before proceeding.
   */
  verifyPlan(
    ctx: ConnectorContext,
    planExternalId: string,
  ): Promise<{ stillActive: boolean; plan?: UniversalPlan }>;

  /**
   * Confirm a Nigerian identity. Most connectors will delegate to a
   * shared NIMC / BVN lookup; some HMOs run their own KYC stack.
   * Returns a confidence-scored result the platform routes to
   * auto-approve / soft-review / reject (architecture spec §7.1).
   */
  verifyMember(
    ctx: ConnectorContext,
    member: MemberIdentity,
  ): Promise<VerificationResult>;

  /**
   * Enroll a member (and any dependants) in the chosen plan. The
   * connector returns the HMO-native policy + member ids. The platform
   * stores these as the source-of-truth references for everything
   * downstream (claims, status checks, cancellation).
   */
  enrollMember(
    ctx: ConnectorContext,
    req: EnrollmentRequest,
  ): Promise<PolicyRecord>;

  /**
   * Get the current HMO-side status of a policy. Used by reconciliation
   * to confirm a policy active in Pierflow is also active in the HMO's
   * own system (architecture spec §15.2, third reconciliation job).
   */
  getPolicyStatus(
    ctx: ConnectorContext,
    hmoPolicyId: string,
  ): Promise<PolicyStatusSnapshot>;

  /**
   * Cancel a policy. Returns the effective termination date and any
   * refund amount the HMO computed.
   */
  cancelPolicy(
    ctx: ConnectorContext,
    hmoPolicyId: string,
    reason: string,
  ): Promise<{
    terminationDate: string;
    refundNgn?: bigint;
    raw?: Record<string, unknown>;
  }>;

  /**
   * Submit a claim on behalf of a member. Returns the HMO's claim id
   * and the initial status. Status polling lives in the orchestration
   * layer, not the connector.
   */
  submitClaim(ctx: ConnectorContext, claim: ClaimRequest): Promise<ClaimRecord>;

  /** Get the current status of a previously-submitted claim. */
  getClaimStatus(
    ctx: ConnectorContext,
    hmoClaimId: string,
  ): Promise<ClaimStatusSnapshot>;

  /**
   * List providers in the HMO's network. Used to seed the provider
   * directory and refresh it nightly. Connectors that don't expose
   * provider data return an empty array.
   */
  getProviders(
    ctx: ConnectorContext,
    filters?: ProviderFilters,
  ): Promise<NormalisedProvider[]>;

  /**
   * Request pre-authorisation for a service. Optional — connectors that
   * don't support it should throw NotSupported and the platform falls
   * back to whatever the HMO's manual process is.
   */
  verifyAuthorization(
    ctx: ConnectorContext,
    req: AuthRequest,
  ): Promise<AuthResult>;
}

// ─────────────────────────────────────────────────────────────────────
// Errors
// ─────────────────────────────────────────────────────────────────────

/**
 * Thrown by connectors that don't support an optional method. The
 * orchestration layer catches it and either falls back to a default
 * behaviour or surfaces a clean error to the caller.
 */
export class ConnectorNotSupported extends Error {
  constructor(method: string, providerId: string) {
    super(`Connector for provider ${providerId} does not support ${method}`);
    this.name = "ConnectorNotSupported";
  }
}

/**
 * Thrown when the HMO-side system was reachable but returned an error
 * (validation, authorization, business rule). The caller decides
 * whether to surface to the partner or queue for retry.
 */
export class ConnectorRemoteError extends Error {
  constructor(
    message: string,
    public readonly remoteCode?: string,
    public readonly remoteDetail?: unknown,
  ) {
    super(message);
    this.name = "ConnectorRemoteError";
  }
}

/**
 * Thrown when the HMO-side system was unreachable (timeout, DNS,
 * 5xx). The caller queues for retry rather than surfacing an error.
 */
export class ConnectorUnavailable extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConnectorUnavailable";
  }
}
