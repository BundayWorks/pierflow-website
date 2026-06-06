import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { runExtractionForJob } from "@/lib/extraction/runExtraction";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Reaper: re-kick any ProcessingJob that's been stuck in QUEUED for
 * more than 10 minutes. These are usually fire-and-forget extractions
 * that lost their Vercel function instance before the worker started
 * (cold-start race, dev-server restart, etc.).
 *
 * Also catches PROCESSING jobs older than 30 minutes — a job that's
 * been "extracting" that long has almost certainly crashed inside
 * Haiku without a chance to mark itself FAILED.
 *
 * Scheduled at *:10 every hour in vercel.json.
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
  const QUEUED_THRESHOLD_MIN = 10;
  const PROCESSING_THRESHOLD_MIN = 30;

  const queuedCutoff = new Date(Date.now() - QUEUED_THRESHOLD_MIN * 60_000);
  const processingCutoff = new Date(Date.now() - PROCESSING_THRESHOLD_MIN * 60_000);

  // QUEUED jobs older than the cutoff get re-kicked.
  const stuckQueued = await db.processingJob.findMany({
    where: {
      status: "QUEUED",
      createdAt: { lt: queuedCutoff },
    },
    select: { id: true },
    take: 200,
  });

  // PROCESSING jobs older than the cutoff: reset to QUEUED + re-kick.
  // We don't try to recover whatever the worker was doing — we restart
  // the page from scratch. Extraction is idempotent (idempotencyKey on
  // create) so this is safe.
  const stuckProcessing = await db.processingJob.findMany({
    where: {
      status: "PROCESSING",
      startedAt: { lt: processingCutoff },
    },
    select: { id: true },
    take: 200,
  });

  let requeued = 0;
  for (const j of stuckProcessing) {
    await db.processingJob.updateMany({
      where: { id: j.id, status: "PROCESSING" },
      data: { status: "QUEUED", startedAt: null },
    });
    requeued++;
  }

  const kicked: string[] = [];
  for (const j of [...stuckQueued, ...stuckProcessing]) {
    // Fire-and-forget — same as the original ingest path. The cron
    // function instance will stay alive long enough on Vercel Fluid
    // Compute to actually run several of these in parallel.
    void runExtractionForJob(j.id).catch((err) => {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[reap] re-kick failed:", j.id, err);
      }
    });
    kicked.push(j.id);
  }

  return NextResponse.json(
    {
      ok: true,
      duration_ms: Date.now() - startedAt,
      stuck_queued: stuckQueued.length,
      stuck_processing: stuckProcessing.length,
      requeued_from_processing: requeued,
      kicked_count: kicked.length,
      kicked_sample: kicked.slice(0, 10),
    },
    { status: 200 },
  );
}
