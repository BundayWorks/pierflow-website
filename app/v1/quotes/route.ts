import { NextResponse } from "next/server";
import { z } from "zod";
import {
  resolvePartnerSession,
  unauthorized,
  requireScope,
} from "@/lib/partnerAuth";
import { createQuotes } from "@/lib/insurance/quotes";

/**
 * POST /v1/quotes
 *
 * Submit a user profile, get back ranked + priced HMO plan quotes.
 * The fintech renders the response (or the rationale) to the user;
 * each quote is valid for 24 hours and carries a frozen split
 * snapshot so the same numbers hold from comparison through to
 * enrollment.
 *
 * Profile shape is deliberately minimal — no PII at quote time.
 * BVN / NIN come later at enrollment (Chapter 3).
 */

const Body = z.object({
  age_in_years: z.number().int().min(0).max(120),
  sex: z.enum(["M", "F", "U"]).optional(),
  dependents: z.number().int().min(0).max(20).optional(),
  monthly_budget_ngn: z
    .number()
    .int()
    .nonnegative()
    .optional()
    .nullable()
    .describe("In kobo (NGN minor units). e.g. 1000000 = ₦10,000."),
  state: z.string().trim().max(60).optional(),
  lga: z.string().trim().max(60).optional(),
  conditions: z
    .array(z.string().trim().min(1).max(60))
    .max(20)
    .optional()
    .describe("Self-declared condition tokens (lowercase: 'asthma')."),
  fintech_ref: z.string().trim().max(200).optional(),
  limit: z.number().int().min(1).max(20).optional(),
  provider_slug: z.string().trim().max(60).optional(),
});

export async function POST(req: Request) {
  const session = await resolvePartnerSession(req);
  if (!session) return unauthorized();
  const scopeFail = requireScope(session, "insurance:read");
  if (scopeFail) return scopeFail;

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      {
        error: "VALIDATION_ERROR",
        details: err instanceof z.ZodError ? err.issues : undefined,
      },
      { status: 422 },
    );
  }

  const result = await createQuotes({
    partnerId: session.partnerId,
    limit: body.limit,
    providerSlug: body.provider_slug,
    profile: {
      ageInYears: body.age_in_years,
      sex: body.sex,
      dependents: body.dependents,
      monthlyBudgetNgn:
        body.monthly_budget_ngn !== undefined &&
        body.monthly_budget_ngn !== null
          ? BigInt(body.monthly_budget_ngn)
          : undefined,
      state: body.state,
      lga: body.lga,
      conditions: body.conditions,
      fintechRef: body.fintech_ref,
    },
  });

  return NextResponse.json({
    request_id: result.request_id,
    expires_at: result.expires_at,
    quotes: result.quotes.map((q) => ({
      ...q,
      wholesale_ngn: q.wholesale_ngn.toString(),
      markup_ngn: q.markup_ngn.toString(),
      member_pays_ngn: q.member_pays_ngn.toString(),
    })),
  });
}
