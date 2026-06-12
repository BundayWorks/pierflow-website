import { NextResponse } from "next/server";
import {
  resolvePartnerSession,
  unauthorized,
  notFound,
  requireScope,
} from "@/lib/partnerAuth";
import { getQuote, getQuoteRequest } from "@/lib/insurance/quotes";

/**
 * GET /v1/quotes/:id — retrieve a single quote or a full quote
 * request (by request id). We accept both shapes and return either
 * one quote or the full ranked list.
 *
 * Auth scopes the lookup by partner id — partners only see their own
 * quotes.
 */
export async function GET(
  req: Request,
  { params }: { params: { quoteId: string } },
) {
  const session = await resolvePartnerSession(req);
  if (!session) return unauthorized();
  const scopeFail = requireScope(session, "insurance:read");
  if (scopeFail) return scopeFail;

  // Try as a single quote first.
  const single = await getQuote(params.quoteId, session.partnerId);
  if (single) {
    return NextResponse.json({
      ...single,
      wholesale_ngn: single.wholesale_ngn.toString(),
      markup_ngn: single.markup_ngn.toString(),
      member_pays_ngn: single.member_pays_ngn.toString(),
    });
  }

  // Fall back to looking it up as a quote-request id.
  const request = await getQuoteRequest(params.quoteId, session.partnerId);
  if (request) {
    return NextResponse.json({
      request_id: request.request_id,
      expires_at: request.expires_at,
      quotes: request.quotes.map((q) => ({
        ...q,
        wholesale_ngn: q.wholesale_ngn.toString(),
        markup_ngn: q.markup_ngn.toString(),
        member_pays_ngn: q.member_pays_ngn.toString(),
      })),
    });
  }

  return notFound("QUOTE_NOT_FOUND");
}
