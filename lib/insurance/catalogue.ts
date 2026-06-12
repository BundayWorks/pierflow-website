/**
 * HMO catalogue ingest — the path the EMR vendor's connector hits to
 * publish (or re-publish) a provider's plans.
 *
 * Idempotent by design: re-running with the same (providerId, externalId)
 * pair updates the existing HmoPlan row in place. A bulk push is the
 * common case — the EMR vendor sends his full catalogue daily; we
 * upsert each plan and stamp lastSyncedAt.
 *
 * Every successful upsert records a HmoPlanFreshnessEvent so we can
 * answer "when was this plan last confirmed correct?" after the fact.
 */

import {
  Prisma,
  type HmoPlanFreshnessKind,
  type HmoPlanScope,
  type HmoPlanStatus,
  type BillingFrequency,
} from "@prisma/client";
import { db } from "@/lib/db";
import {
  validateUniversalPlan,
  type UniversalPlan,
} from "@/lib/insurance/plan-schema";
import { applyMapping, type Template } from "@/lib/insurance/normalise";
import { getActiveMapping } from "@/lib/insurance/mappings";

export type IngestPlanInput = {
  /** Pierflow's HmoProvider id (resolved from slug by the route). */
  providerId: string;
  /** The connector's catalogue payload — one entry per plan. */
  plans: unknown[];
  /**
   * Plan format on the wire:
   *   "universal" — payloads already conform to Universal Plan Schema.
   *   "native"    — payloads are the HMO's native shape; we run them
   *                 through the active ConnectorMapping first.
   * Defaults to "universal" if omitted.
   */
  format?: "universal" | "native";
  /**
   * What triggered this ingest. Drives the FreshnessEvent kind so we
   * can later distinguish a scheduled sync from a webhook-driven
   * partial update.
   */
  kind: HmoPlanFreshnessKind;
  /**
   * Optional "soft TTL" for this batch. If set, every plan written in
   * this call gets `staleAfter = now + staleAfterMs`. Beyond that the
   * fintech-facing API surfaces a freshness warning.
   */
  staleAfterMs?: number;
};

export type IngestPlanResult = {
  /** Per-plan outcome — caller returns this so the connector can retry. */
  results: Array<
    | {
        externalId: string;
        ok: true;
        planId: string;
        action: "CREATED" | "UPDATED";
      }
    | {
        externalId: string | null;
        ok: false;
        reason: "VALIDATION_FAILED";
        issues: string[];
      }
  >;
  summary: { received: number; created: number; updated: number; failed: number };
};

/**
 * Bulk-upsert plans for a single provider. Each plan is validated with
 * the Universal Plan Schema; invalid plans are skipped (not rolled
 * back) so a single bad plan doesn't poison the whole batch.
 *
 * Per-plan upsert is run inside its own transaction so the
 * HmoPlanFreshnessEvent insert stays atomic with the plan write.
 */
export async function ingestPlans(
  input: IngestPlanInput,
): Promise<IngestPlanResult> {
  const results: IngestPlanResult["results"] = [];
  let created = 0;
  let updated = 0;
  let failed = 0;

  const now = new Date();
  const staleAfter =
    input.staleAfterMs && input.staleAfterMs > 0
      ? new Date(now.getTime() + input.staleAfterMs)
      : null;

  // If this push is in native format, resolve the active mapping
  // once at the top of the loop. We refuse the whole batch if the
  // connector pushes native without an active mapping configured —
  // otherwise every plan would fail validation and we'd burn a sync
  // window for no good reason.
  let template: Template | null = null;
  if (input.format === "native") {
    const active = await getActiveMapping(input.providerId);
    if (!active) {
      return {
        results: input.plans.map((raw) => {
          const externalId =
            typeof raw === "object" && raw !== null && "external_id" in raw
              ? String((raw as { external_id: unknown }).external_id ?? "")
              : null;
          return {
            ok: false as const,
            externalId,
            reason: "VALIDATION_FAILED" as const,
            issues: [
              "No active ConnectorMapping for this provider — register a mapping in the staff portal before pushing native catalogues, or send the catalogue in Universal Plan Schema format.",
            ],
          };
        }),
        summary: {
          received: input.plans.length,
          created: 0,
          updated: 0,
          failed: input.plans.length,
        },
      };
    }
    template = active.template as Template;
  }

  for (const raw of input.plans) {
    // For native pushes, run the entry through the active template
    // first. The template emits Universal Plan Schema JSON that the
    // existing validator + write path picks up unchanged.
    let candidate: unknown = raw;
    if (template) {
      const applied = applyMapping(template, raw);
      if (!applied.ok) {
        failed++;
        const externalId =
          typeof raw === "object" && raw !== null && "external_id" in raw
            ? String((raw as { external_id: unknown }).external_id ?? "")
            : null;
        results.push({
          ok: false,
          externalId,
          reason: "VALIDATION_FAILED",
          issues: applied.issues,
        });
        continue;
      }
      candidate = applied.plan;
    }

    const v = validateUniversalPlan(candidate);
    if (!v.ok) {
      failed++;
      const externalId =
        typeof candidate === "object" &&
        candidate !== null &&
        "external_id" in candidate
          ? String(
              (candidate as { external_id: unknown }).external_id ?? "",
            )
          : null;
      results.push({
        ok: false,
        externalId: externalId || null,
        reason: "VALIDATION_FAILED",
        issues: v.issues,
      });
      continue;
    }

    const plan: UniversalPlan = v.plan;
    const upsertOutcome = await db.$transaction(async (tx) => {
      const existing = await tx.hmoPlan.findUnique({
        where: {
          providerId_externalId: {
            providerId: input.providerId,
            externalId: plan.external_id,
          },
        },
        select: { id: true },
      });

      const data = {
        name: plan.name,
        scope: plan.scope as HmoPlanScope,
        status: plan.status as HmoPlanStatus,
        billingFrequency: plan.billing_frequency as BillingFrequency,
        coverage: plan.coverage as Prisma.InputJsonValue,
        pricing: plan.pricing as Prisma.InputJsonValue,
        waitingPeriods: plan.waiting_periods
          ? (plan.waiting_periods as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        exclusions: plan.exclusions
          ? (plan.exclusions as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        effectiveFrom: plan.effective_from ? new Date(plan.effective_from) : null,
        effectiveTo: plan.effective_to ? new Date(plan.effective_to) : null,
        metadata: plan.metadata
          ? (plan.metadata as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        lastSyncedAt: now,
        staleAfter,
      };

      const row = existing
        ? await tx.hmoPlan.update({
            where: { id: existing.id },
            data,
            select: { id: true },
          })
        : await tx.hmoPlan.create({
            data: {
              providerId: input.providerId,
              externalId: plan.external_id,
              ...data,
            },
            select: { id: true },
          });

      await tx.hmoPlanFreshnessEvent.create({
        data: {
          planId: row.id,
          kind: input.kind,
          // For an upsert we don't yet diff to know if the content
          // changed — record the touch as `changed=false` if updating,
          // `changed=true` if creating. A future enhancement: hash the
          // payload and compare against the prior write.
          changed: !existing,
        },
      });

      return { id: row.id, action: existing ? "UPDATED" : "CREATED" } as const;
    });

    results.push({
      ok: true,
      externalId: plan.external_id,
      planId: upsertOutcome.id,
      action: upsertOutcome.action,
    });
    if (upsertOutcome.action === "CREATED") created++;
    else updated++;
  }

  return {
    results,
    summary: { received: input.plans.length, created, updated, failed },
  };
}

/**
 * Mark a single plan WITHDRAWN. Called by the connector when the
 * "something changed" webhook says a plan was discontinued, or by
 * staff via the portal. Records a WITHDRAWAL FreshnessEvent.
 */
export async function withdrawPlan(planId: string) {
  return db.$transaction(async (tx) => {
    const updated = await tx.hmoPlan.update({
      where: { id: planId },
      data: { status: "WITHDRAWN", lastSyncedAt: new Date() },
      select: { id: true, status: true },
    });
    await tx.hmoPlanFreshnessEvent.create({
      data: {
        planId,
        kind: "WITHDRAWAL",
        changed: true,
      },
    });
    return updated;
  });
}

/**
 * Record a verify touch — used after a successful live verify call to
 * the connector, even if nothing about the plan changed. This is how
 * we drive "last confirmed N minutes ago" stamps in the fintech-facing
 * API.
 */
export async function recordVerifyEvent(planId: string, changed: boolean) {
  return db.$transaction(async (tx) => {
    await tx.hmoPlan.update({
      where: { id: planId },
      data: { lastVerifiedAt: new Date() },
    });
    await tx.hmoPlanFreshnessEvent.create({
      data: { planId, kind: "LIVE_VERIFY", changed },
    });
  });
}
