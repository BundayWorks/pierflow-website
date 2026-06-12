import { NextResponse } from "next/server";
import { pollOpenClaims } from "@/lib/insurance/claims";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Cron: polls open claims for status updates from the HMO connector.
 * Runs every 4h via vercel.json. Each open claim with lastPolledAt
 * older than 4h is re-checked; status changes fire webhooks +
 * advance the row.
 *
 * Manual call: pass Authorization: Bearer <CRON_SECRET>.
 */
export async function GET(req: Request) {
  const expected = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (expected && auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const startedAt = Date.now();
  const result = await pollOpenClaims();
  return NextResponse.json({
    ok: true,
    elapsed_ms: Date.now() - startedAt,
    ...result,
  });
}
