"use server";

import { resolveSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { ingestPlans, withdrawPlan } from "@/lib/insurance/catalogue";
import { validateUniversalPlan } from "@/lib/insurance/plan-schema";

/**
 * Resolve the HMO provider id for the current INSURER partner.
 * Duplicated from cover/actions.ts to keep this module self-contained.
 */
async function resolveProviderId(): Promise<string | null> {
  const session = await resolveSession();
  if (session.kind !== "partner") return null;
  const link = await db.partnerOrganizationLink.findFirst({
    where: { partnerId: session.partner.id },
    include: {
      organization: {
        include: { hmoProvider: { select: { id: true } } },
      },
    },
  });
  return link?.organization?.hmoProvider?.id ?? null;
}

// ── Plan list ──────────────────────────────────────────────────────

export type PlanRow = {
  id: string;
  externalId: string;
  name: string;
  scope: string;
  status: string;
  billingFrequency: string;
  wholesaleMonthly: number | null;
  lastSyncedAt: string;
  stale: boolean;
  createdAt: string;
};

export async function getPlans(): Promise<PlanRow[]> {
  const providerId = await resolveProviderId();
  if (!providerId) return [];

  const plans = await db.hmoPlan.findMany({
    where: { providerId },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const now = new Date();
  return plans.map((p) => {
    const pricing = p.pricing as { individual_monthly?: number } | null;
    return {
      id: p.id,
      externalId: p.externalId,
      name: p.name,
      scope: p.scope,
      status: p.status,
      billingFrequency: p.billingFrequency,
      wholesaleMonthly: pricing?.individual_monthly ?? null,
      lastSyncedAt: p.lastSyncedAt.toISOString(),
      stale: p.staleAfter !== null && p.staleAfter < now,
      createdAt: p.createdAt.toISOString(),
    };
  });
}

// ── Plan detail ────────────────────────────────────────────────────

export type PlanDetail = {
  id: string;
  externalId: string;
  name: string;
  scope: string;
  status: string;
  billingFrequency: string;
  coverage: unknown;
  pricing: unknown;
  waitingPeriods: unknown;
  exclusions: unknown;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  lastSyncedAt: string;
  lastVerifiedAt: string | null;
  staleAfter: string | null;
  stale: boolean;
  createdAt: string;
  updatedAt: string;
  freshnessEvents: {
    id: string;
    kind: string;
    changed: boolean;
    occurredAt: string;
  }[];
};

export async function getPlanDetail(
  planId: string,
): Promise<PlanDetail | null> {
  const providerId = await resolveProviderId();
  if (!providerId) return null;

  const plan = await db.hmoPlan.findUnique({
    where: { id: planId },
    include: {
      freshnessEvents: {
        orderBy: { occurredAt: "desc" },
        take: 10,
        select: { id: true, kind: true, changed: true, occurredAt: true },
      },
    },
  });
  if (!plan || plan.providerId !== providerId) return null;

  const now = new Date();
  return {
    id: plan.id,
    externalId: plan.externalId,
    name: plan.name,
    scope: plan.scope,
    status: plan.status,
    billingFrequency: plan.billingFrequency,
    coverage: plan.coverage,
    pricing: plan.pricing,
    waitingPeriods: plan.waitingPeriods,
    exclusions: plan.exclusions,
    effectiveFrom: plan.effectiveFrom?.toISOString() ?? null,
    effectiveTo: plan.effectiveTo?.toISOString() ?? null,
    lastSyncedAt: plan.lastSyncedAt.toISOString(),
    lastVerifiedAt: plan.lastVerifiedAt?.toISOString() ?? null,
    staleAfter: plan.staleAfter?.toISOString() ?? null,
    stale: plan.staleAfter !== null && plan.staleAfter < now,
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt.toISOString(),
    freshnessEvents: plan.freshnessEvents.map((e) => ({
      id: e.id,
      kind: e.kind,
      changed: e.changed,
      occurredAt: e.occurredAt.toISOString(),
    })),
  };
}

// ── Create / Update ────────────────────────────────────────────────

type PlanMutationResult =
  | { ok: true; planId: string; action: "CREATED" | "UPDATED" }
  | { ok: false; reason: string; issues?: string[] };

export async function createPlanAction(
  raw: Record<string, unknown>,
): Promise<PlanMutationResult> {
  const providerId = await resolveProviderId();
  if (!providerId) return { ok: false, reason: "Unauthorized" };

  const validation = validateUniversalPlan(raw);
  if (!validation.ok) {
    return { ok: false, reason: "VALIDATION_FAILED", issues: validation.issues };
  }

  const result = await ingestPlans({
    providerId,
    plans: [raw],
    format: "universal",
    kind: "PARTIAL_UPDATE",
  });

  const first = result.results[0];
  if (!first || !first.ok) {
    return {
      ok: false,
      reason: "INGEST_FAILED",
      issues: first && !first.ok ? first.issues : ["Unknown error"],
    };
  }
  return { ok: true, planId: first.planId, action: first.action };
}

export async function updatePlanAction(
  planId: string,
  raw: Record<string, unknown>,
): Promise<PlanMutationResult> {
  const providerId = await resolveProviderId();
  if (!providerId) return { ok: false, reason: "Unauthorized" };

  // Verify plan belongs to this provider
  const existing = await db.hmoPlan.findUnique({
    where: { id: planId },
    select: { providerId: true, externalId: true },
  });
  if (!existing || existing.providerId !== providerId) {
    return { ok: false, reason: "Plan not found" };
  }

  // Ensure the external_id stays the same
  raw.external_id = existing.externalId;

  const validation = validateUniversalPlan(raw);
  if (!validation.ok) {
    return { ok: false, reason: "VALIDATION_FAILED", issues: validation.issues };
  }

  const result = await ingestPlans({
    providerId,
    plans: [raw],
    format: "universal",
    kind: "PARTIAL_UPDATE",
  });

  const first = result.results[0];
  if (!first || !first.ok) {
    return {
      ok: false,
      reason: "INGEST_FAILED",
      issues: first && !first.ok ? first.issues : ["Unknown error"],
    };
  }
  return { ok: true, planId: first.planId, action: first.action };
}

// ── Status changes ─────────────────────────────────────────────────

type StatusResult = { ok: true } | { ok: false; reason: string };

export async function withdrawPlanAction(
  planId: string,
): Promise<StatusResult> {
  const providerId = await resolveProviderId();
  if (!providerId) return { ok: false, reason: "Unauthorized" };

  const plan = await db.hmoPlan.findUnique({
    where: { id: planId },
    select: { providerId: true, status: true },
  });
  if (!plan || plan.providerId !== providerId) {
    return { ok: false, reason: "Plan not found" };
  }
  if (plan.status === "WITHDRAWN") {
    return { ok: false, reason: "Plan is already withdrawn" };
  }

  await withdrawPlan(planId);
  return { ok: true };
}

export async function activatePlanAction(
  planId: string,
): Promise<StatusResult> {
  const providerId = await resolveProviderId();
  if (!providerId) return { ok: false, reason: "Unauthorized" };

  const plan = await db.hmoPlan.findUnique({
    where: { id: planId },
    select: { providerId: true, status: true },
  });
  if (!plan || plan.providerId !== providerId) {
    return { ok: false, reason: "Plan not found" };
  }
  if (plan.status === "ACTIVE") {
    return { ok: false, reason: "Plan is already active" };
  }

  await db.$transaction(async (tx) => {
    await tx.hmoPlan.update({
      where: { id: planId },
      data: { status: "ACTIVE", lastSyncedAt: new Date() },
    });
    await tx.hmoPlanFreshnessEvent.create({
      data: { planId, kind: "PARTIAL_UPDATE", changed: true },
    });
  });
  return { ok: true };
}
