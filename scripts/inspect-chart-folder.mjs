// Diagnostic: dump a chart folder + all its jobs + extracted records so
// we can see why a "Closed — resolving…" chart is stuck.
//
// Run with:
//   node --env-file=.env.local scripts/inspect-chart-folder.mjs Ogbonnaya
//
// The argument is a label / MRN substring to search for (case-insensitive).
// Omit it to see the 10 most recent unresolved closed folders instead.

import pg from "pg";
const { Pool } = pg;

const query = process.argv[2] ?? null;

const url = (process.env.POSTGRES_URL_NON_POOLING ?? "").replace(
  "sslmode=require",
  "sslmode=no-verify",
);
if (!url) {
  console.error("POSTGRES_URL_NON_POOLING not set in .env.local");
  process.exit(1);
}

const pool = new Pool({ connectionString: url });

try {
  const folders = await pool.query(
    query
      ? `SELECT cf.id, cf.label, cf."closedAt", cf."resolvedSource",
                cf."resolvedPatientId", cf."declaredMrn", cf."declaredPatientId",
                cf."createdAt"
         FROM chart_folders cf
         WHERE cf.label ILIKE $1 OR cf."declaredMrn" ILIKE $1
         ORDER BY cf."createdAt" DESC
         LIMIT 10`
      : `SELECT cf.id, cf.label, cf."closedAt", cf."resolvedSource",
                cf."resolvedPatientId", cf."declaredMrn", cf."declaredPatientId",
                cf."createdAt"
         FROM chart_folders cf
         WHERE cf."closedAt" IS NOT NULL
           AND cf."resolvedSource" = 'UNRESOLVED'
         ORDER BY cf."createdAt" DESC
         LIMIT 10`,
    query ? [`%${query}%`] : [],
  );

  if (folders.rows.length === 0) {
    console.log("No folders matched.");
    process.exit(0);
  }

  for (const f of folders.rows) {
    console.log("\n── Chart folder ───────────────────────────────");
    console.log(JSON.stringify(f, null, 2));
    const jobs = await pool.query(
      `SELECT pj.id, pj.status, pj."errorCode", pj."errorDetail",
              pj."startedAt", pj."completedAt",
              er.id AS record_id,
              er."validationStatus",
              er."avgConfidence",
              er."extractedJson"->'patient' AS patient_block
       FROM processing_jobs pj
       LEFT JOIN extracted_records er ON er."jobId" = pj.id
       WHERE pj."chartFolderId" = $1
       ORDER BY pj."createdAt" ASC`,
      [f.id],
    );
    console.log(`  Jobs (${jobs.rows.length}):`);
    for (const j of jobs.rows) {
      console.log("   ·", JSON.stringify(j, null, 2));
    }
  }
} finally {
  await pool.end();
}
