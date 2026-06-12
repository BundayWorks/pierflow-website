import { NextResponse } from "next/server";
import { reconcileRecent } from "@/lib/insurance/reconciliation";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Cron: walks ACTIVE enrollments updated in the last 72h and
 * compares each one's INSTRUCTED vs EXECUTED ledger entries.
 *
 * On non-zero net deltas, writes (or updates) a LedgerDiscrepancy
 * row that staff can review at /portal/reconciliation. On a balanced
 * enrollment that previously had a discrepancy, the discrepancy is
 * auto-resolved.
 *
 * Schedule via vercel.json. Manual call: pass
 *   Authorization: Bearer <CRON_SECRET>
 */
export async function GET(req: Request) {
  const expected = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (expected && auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const startedAt = Date.now();
  const result = await reconcileRecent({ sinceHours: 72, limit: 500 });
  const ms = Date.now() - startedAt;

  return NextResponse.json({
    ok: true,
    elapsed_ms: ms,
    ...result,
  });
}
