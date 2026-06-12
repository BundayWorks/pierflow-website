import { NextResponse } from "next/server";
import { z } from "zod";
import {
  resolvePartnerSession,
  unauthorized,
  requireScope,
} from "@/lib/partnerAuth";
import { listPlansPublic } from "@/lib/insurance/plans-public";

/**
 * GET /v1/plans — fintech browse surface.
 *
 * Returns a paginated list of currently-distributable HMO plans
 * across every HMO Pierflow has onboarded. Filters narrow by HMO,
 * scope, budget, age — see PlanFiltersQuery below.
 *
 * Personalised ranking lives at POST /v1/quotes; this endpoint is
 * the browse surface (no scoring, no markup applied yet).
 *
 * Auth: requires the calling key to carry `insurance:read`. Older
 * keys with an empty scopes list are treated as legacy and granted
 * all scopes for backwards compatibility.
 */

const PlanFiltersQuery = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  status: z.enum(["DRAFT", "ACTIVE", "WITHDRAWN"]).optional(),
  scope: z
    .enum(["INDIVIDUAL", "FAMILY", "EMPLOYEE_GROUP", "STUDENT", "OTHER"])
    .optional(),
  provider_slug: z.string().optional(),
  state: z.string().optional(),
  lga: z.string().optional(),
  max_monthly_premium_ngn: z.coerce.number().int().nonnegative().optional(),
  age_in_years: z.coerce.number().int().min(0).max(120).optional(),
});

export async function GET(req: Request) {
  const session = await resolvePartnerSession(req);
  if (!session) return unauthorized();
  const scopeFail = requireScope(session, "insurance:read");
  if (scopeFail) return scopeFail;

  const url = new URL(req.url);
  let q: z.infer<typeof PlanFiltersQuery>;
  try {
    q = PlanFiltersQuery.parse({
      cursor: url.searchParams.get("cursor") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      scope: url.searchParams.get("scope") ?? undefined,
      provider_slug: url.searchParams.get("provider_slug") ?? undefined,
      state: url.searchParams.get("state") ?? undefined,
      lga: url.searchParams.get("lga") ?? undefined,
      max_monthly_premium_ngn:
        url.searchParams.get("max_monthly_premium_ngn") ?? undefined,
      age_in_years: url.searchParams.get("age_in_years") ?? undefined,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: "VALIDATION_ERROR",
        details: err instanceof z.ZodError ? err.issues : undefined,
      },
      { status: 422 },
    );
  }

  const result = await listPlansPublic(
    {
      status: q.status,
      scope: q.scope,
      providerSlug: q.provider_slug,
      state: q.state,
      lga: q.lga,
      maxMonthlyPremiumNgn:
        q.max_monthly_premium_ngn !== undefined
          ? BigInt(q.max_monthly_premium_ngn)
          : undefined,
      ageInYears: q.age_in_years,
      partnerId: session.partnerId,
    },
    { cursor: q.cursor, limit: q.limit },
  );

  return NextResponse.json(result);
}
