import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { scoreOrganizationDuplicates } from "@/lib/patients/duplicateScoring";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Cron: walks every ACTIVE Organization and scores its Patient rows
 * for likely duplicates. Writes PatientMergeCandidate rows the reviewer
 * portal surfaces in the Merge queue tab.
 *
 * Scheduled in vercel.json. Manual call: pass Authorization: Bearer
 * <CRON_SECRET>.
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
  const orgs = await db.organization.findMany({
    where: { accessStatus: "ACTIVE", isActive: true },
    select: { id: true, name: true },
  });

  let totalCandidates = 0;
  let totalPairs = 0;
  const perOrg: { id: string; name: string; candidates: number; pairs: number }[] = [];
  for (const org of orgs) {
    try {
      const r = await scoreOrganizationDuplicates(org.id);
      totalCandidates += r.candidatesWritten;
      totalPairs += r.pairsConsidered;
      perOrg.push({
        id: org.id,
        name: org.name,
        candidates: r.candidatesWritten,
        pairs: r.pairsConsidered,
      });
    } catch (err) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(
          "[cron:reconcile-patients] org failed:",
          org.id,
          err instanceof Error ? err.message : err,
        );
      }
    }
  }

  return NextResponse.json(
    {
      ok: true,
      duration_ms: Date.now() - startedAt,
      orgs_considered: orgs.length,
      pairs_considered: totalPairs,
      candidates_written: totalCandidates,
      per_org: perOrg,
    },
    { status: 200 },
  );
}
