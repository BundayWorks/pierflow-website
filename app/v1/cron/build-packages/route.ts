import { NextResponse } from "next/server";
import { buildPendingImportPackages } from "@/lib/packages/builder";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Cron entry point invoked by Vercel Cron Jobs.
 *
 * Vercel sends an Authorization header with the CRON_SECRET configured
 * for the project. We accept either that or a manual call with the same
 * header for local testing.
 *
 * Defined in vercel.json:
 *   { "path": "/v1/cron/build-packages", "schedule": "0 2 * * *" }
 */
export async function GET(req: Request) {
  const expected = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (expected) {
    if (auth !== `Bearer ${expected}`) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
  }

  const startedAt = Date.now();
  const result = await buildPendingImportPackages();
  const ms = Date.now() - startedAt;

  return NextResponse.json(
    {
      ok: true,
      duration_ms: ms,
      partners_considered: result.partnersConsidered,
      packages_built: result.packagesBuilt,
    },
    { status: 200 },
  );
}
