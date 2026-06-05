/**
 * "Should I resolve this chart folder yet?" decision point.
 *
 * The extraction worker calls this every time a job in a folder
 * reaches a terminal state (VALIDATED / AWAITING_REVIEW / FAILED). We
 * only run the actual resolution once:
 *
 *   - the folder is closed (operator finished it), AND
 *   - every job in the folder has reached a terminal state.
 *
 * Folders that the operator hasn't closed yet stay in UNRESOLVED — we
 * don't want to resolve mid-capture and have to re-resolve later when
 * the operator adds another page.
 */
import { db } from "@/lib/db";
import { resolveChartFolderIdentity } from "./resolveChartFolderIdentity";

const TERMINAL_STATUSES = ["VALIDATED", "AWAITING_REVIEW", "FAILED"] as const;

export async function maybeResolveChartFolderForJob(
  chartFolderId: string,
): Promise<void> {
  const folder = await db.chartFolder.findUnique({
    where: { id: chartFolderId },
    select: {
      id: true,
      closedAt: true,
      jobs: { select: { status: true } },
    },
  });
  if (!folder) return;
  if (!folder.closedAt) return; // operator hasn't finished the chart
  const anyUnsettled = folder.jobs.some(
    (j) => !TERMINAL_STATUSES.includes(j.status as (typeof TERMINAL_STATUSES)[number]),
  );
  if (anyUnsettled) return;

  await resolveChartFolderIdentity(folder.id);
}
