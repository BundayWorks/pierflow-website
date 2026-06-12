/**
 * Cleanup script for pre-demo database hygiene.
 *
 * Keeps config + identity (specified Partners, all Organizations
 * unless --keep-orgs is given, your staff OrgMember row).
 * Flushes operational + transactional data (ScanBatches, Jobs,
 * ExtractedRecords, ChartFolders, Patients, Identifiers, ImportPackages,
 * PatientMergeCandidates, PartnerPatientLinks, WebhookEndpoints,
 * AuditLog, OrganizationApprovalEvents).
 *
 * Also cleans the Cloudinary `pierflow/<orgId>/*` folders for orgs
 * whose operational data is being flushed.
 *
 * Usage
 * -----
 *   node --env-file=.env.local scripts/cleanup-demo-state.mjs \
 *     --keep-partners=porchplus-t7kxbj,linkhms-z3bx4b \
 *     [--keep-orgs=org-slug-1,org-slug-2] \
 *     [--dry-run] [--skip-cloudinary] [--yes]
 *
 * Flags
 * -----
 *   --keep-partners=… REQUIRED. Comma-separated Partner slugs to preserve.
 *                     Every other Partner (+ its PartnerUsers, ApiKeys,
 *                     OrganizationLinks, Profile, Agreements, Security
 *                     Assessment, PatientLinks, ImportPackages) is
 *                     cascade-deleted.
 *   --keep-orgs=…     Comma-separated Organization slugs to preserve as-is
 *                     (their operational data is still flushed, but the
 *                     org row stays). Default: keep every Organization.
 *   --dry-run         Print the plan and counts, don't delete anything.
 *   --skip-cloudinary Skip the Cloudinary phase. Faster, but storage
 *                     keeps growing.
 *   --yes             Skip the "type YES to proceed" prompt.
 */

import readline from "node:readline";
import pg from "pg";
const { Pool } = pg;

const args = parseArgs(process.argv.slice(2));

const dryRun = !!args["dry-run"];
const skipCloudinary = !!args["skip-cloudinary"];
const autoYes = !!args.yes;
const keepPartnerSlugs = (args["keep-partners"] ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const keepOrgSlugs = (args["keep-orgs"] ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const dropAllPartners = !!args["drop-all-partners"];

if (keepPartnerSlugs.length === 0 && !dropAllPartners) {
  console.error(
    "Refusing to run without --keep-partners=slug1,slug2,…",
    "\n  Pass --keep-partners with the slugs you want to preserve,",
    "\n  OR pass --drop-all-partners to delete every Partner (deliberate flag).",
  );
  process.exit(2);
}

const url = (process.env.POSTGRES_URL_NON_POOLING ?? "").replace(
  "sslmode=require",
  "sslmode=no-verify",
);
if (!url) {
  console.error("POSTGRES_URL_NON_POOLING not set in .env.local");
  process.exit(2);
}

const pool = new Pool({ connectionString: url });

async function q(sql, params = []) {
  const r = await pool.query(sql, params);
  return r.rows;
}
async function count(sql, params = []) {
  const r = await pool.query(sql, params);
  return Number(r.rows[0]?.count ?? 0);
}

try {
  console.log("\n── Cleanup plan ────────────────────────────────────────\n");

  // ── Partners ─────────────────────────────────────────────
  let keepPartners = [];
  if (keepPartnerSlugs.length > 0) {
    keepPartners = await q(
      `SELECT id, name, slug FROM partners WHERE slug = ANY($1)`,
      [keepPartnerSlugs],
    );
    if (keepPartners.length !== keepPartnerSlugs.length) {
      const found = new Set(keepPartners.map((p) => p.slug));
      const missing = keepPartnerSlugs.filter((s) => !found.has(s));
      console.error(
        `Refusing to run: --keep-partners listed slugs that don't exist:`,
        missing,
      );
      process.exit(2);
    }
  }
  const keepPartnerIds = keepPartners.map((p) => p.id);

  const dropPartners = await q(
    keepPartnerIds.length > 0
      ? `SELECT id, name, slug, "accessStatus" FROM partners
         WHERE id <> ALL($1) ORDER BY name`
      : `SELECT id, name, slug, "accessStatus" FROM partners ORDER BY name`,
    keepPartnerIds.length > 0 ? [keepPartnerIds] : [],
  );

  console.log(`Partners to KEEP (${keepPartners.length}):`);
  for (const p of keepPartners) console.log(`  · ${p.slug} — ${p.name}`);
  console.log(`\nPartners to DROP (${dropPartners.length}):`);
  for (const p of dropPartners)
    console.log(`  · ${p.slug} — ${p.name} (${p.accessStatus})`);

  // ── Orgs ─────────────────────────────────────────────────
  let allOrgs = await q(`SELECT id, name, slug FROM organizations`);
  let keepOrgs;
  if (keepOrgSlugs.length === 0) {
    keepOrgs = allOrgs;
  } else {
    keepOrgs = await q(
      `SELECT id, name, slug FROM organizations WHERE slug = ANY($1)`,
      [keepOrgSlugs],
    );
    if (keepOrgs.length !== keepOrgSlugs.length) {
      const found = new Set(keepOrgs.map((o) => o.slug));
      const missing = keepOrgSlugs.filter((s) => !found.has(s));
      console.error(
        `Refusing to run: --keep-orgs listed slugs that don't exist:`,
        missing,
      );
      process.exit(2);
    }
  }
  const keepOrgIds = keepOrgs.map((o) => o.id);
  const dropOrgs = allOrgs.filter((o) => !keepOrgIds.includes(o.id));

  console.log(`\nOrganizations to KEEP (${keepOrgs.length}):`);
  for (const o of keepOrgs) console.log(`  · ${o.slug ?? "(no slug)"} — ${o.name}`);
  if (dropOrgs.length > 0) {
    console.log(`\nOrganizations to DROP (${dropOrgs.length}):`);
    for (const o of dropOrgs)
      console.log(`  · ${o.slug ?? "(no slug)"} — ${o.name}`);
  }

  // ── Operational counts ───────────────────────────────────
  const opCounts = {
    scan_batches: await count(`SELECT COUNT(*) FROM scan_batches`),
    processing_jobs: await count(`SELECT COUNT(*) FROM processing_jobs`),
    extracted_records: await count(`SELECT COUNT(*) FROM extracted_records`),
    chart_folders: await count(`SELECT COUNT(*) FROM chart_folders`),
    patients: await count(`SELECT COUNT(*) FROM patients`),
    patient_identifiers: await count(`SELECT COUNT(*) FROM patient_identifiers`),
    import_packages: await count(`SELECT COUNT(*) FROM import_packages`),
    patient_merge_candidates: await count(
      `SELECT COUNT(*) FROM patient_merge_candidates`,
    ),
    partner_patient_links: await count(`SELECT COUNT(*) FROM partner_patient_links`),
    webhook_endpoints: await count(`SELECT COUNT(*) FROM webhook_endpoints`),
    audit_log: await count(`SELECT COUNT(*) FROM audit_log`),
    organization_approval_events: await count(
      `SELECT COUNT(*) FROM organization_approval_events`,
    ),
  };

  console.log("\nOperational rows to flush from all kept orgs:");
  for (const [k, v] of Object.entries(opCounts)) {
    console.log(`  · ${k}: ${v}`);
  }

  console.log("\nCloudinary: " + (skipCloudinary ? "SKIPPED" : "will destroy assets under pierflow/<orgId>/*"));
  console.log("Mode:       " + (dryRun ? "DRY RUN (no deletes)" : "LIVE"));

  if (dryRun) {
    console.log("\nDry run finished. No changes made.\n");
    process.exit(0);
  }

  // ── Confirm ──────────────────────────────────────────────
  if (!autoYes) {
    const ok = await confirm(
      `\nProceed? Type "YES" to continue, anything else aborts: `,
    );
    if (ok !== "YES") {
      console.log("Aborted.");
      process.exit(0);
    }
  }

  console.log("\n── Executing ───────────────────────────────────────────");

  // ── Cloudinary phase ─────────────────────────────────────
  if (!skipCloudinary) {
    console.log("\n[1/3] Cloudinary cleanup…");
    const orgIdsForCloudinary = allOrgs.map((o) => o.id);
    const { destroyed, failed } = await cleanupCloudinary(orgIdsForCloudinary);
    console.log(`  destroyed=${destroyed} failed=${failed}`);
  } else {
    console.log("\n[1/3] Cloudinary cleanup SKIPPED.");
  }

  // ── Operational data phase ───────────────────────────────
  console.log("\n[2/3] Flushing operational rows…");
  const opDeletes = [
    [`partner_patient_links`, await q(`DELETE FROM partner_patient_links RETURNING id`)],
    [`patient_merge_candidates`, await q(`DELETE FROM patient_merge_candidates RETURNING id`)],
    [`import_packages`, await q(`DELETE FROM import_packages RETURNING id`)],
    [`extracted_records`, await q(`DELETE FROM extracted_records RETURNING id`)],
    [`chart_folders`, await q(`DELETE FROM chart_folders RETURNING id`)],
    [`processing_jobs`, await q(`DELETE FROM processing_jobs RETURNING id`)],
    [`scan_batches`, await q(`DELETE FROM scan_batches RETURNING id`)],
    [`patient_identifiers`, await q(`DELETE FROM patient_identifiers RETURNING id`)],
    [`patients`, await q(`DELETE FROM patients RETURNING id`)],
    [`webhook_endpoints`, await q(`DELETE FROM webhook_endpoints RETURNING id`)],
    [`audit_log`, await q(`DELETE FROM audit_log RETURNING id`)],
    [
      `organization_approval_events`,
      await q(`DELETE FROM organization_approval_events RETURNING id`),
    ],
  ];
  for (const [table, rows] of opDeletes) {
    console.log(`  · ${table}: ${rows.length} deleted`);
  }

  // ── Non-kept Partners ────────────────────────────────────
  console.log("\n[3/3] Dropping non-kept Partners (cascades through users + keys + links)…");
  if (dropPartners.length === 0) {
    console.log("  none.");
  } else {
    const dropIds = dropPartners.map((p) => p.id);
    const r = await q(
      `DELETE FROM partners WHERE id = ANY($1) RETURNING id, slug`,
      [dropIds],
    );
    console.log(`  · partners: ${r.length} deleted`);
  }

  // ── Drop non-kept Orgs ───────────────────────────────────
  if (dropOrgs.length > 0) {
    console.log("\n[bonus] Dropping non-kept Organizations…");
    const dropIds = dropOrgs.map((o) => o.id);
    const r = await q(
      `DELETE FROM organizations WHERE id = ANY($1) RETURNING id, slug`,
      [dropIds],
    );
    console.log(`  · organizations: ${r.length} deleted`);
  }

  console.log("\n✓ Done.\n");
} finally {
  await pool.end();
}

/* ── Helpers ──────────────────────────────────────────────── */

function parseArgs(argv) {
  const out = {};
  for (const a of argv) {
    if (a.startsWith("--")) {
      const [k, v] = a.slice(2).split("=");
      out[k] = v ?? true;
    }
  }
  return out;
}

function confirm(prompt) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function cleanupCloudinary(orgIds) {
  if (orgIds.length === 0) return { destroyed: 0, failed: 0 };
  const cloud_name = process.env.CLOUDINARY_CLOUD_NAME;
  const api_key = process.env.CLOUDINARY_API_KEY;
  const api_secret = process.env.CLOUDINARY_API_SECRET;
  if (!cloud_name || !api_key || !api_secret) {
    console.warn(
      "  CLOUDINARY_* env vars not set, skipping Cloudinary cleanup",
    );
    return { destroyed: 0, failed: 0 };
  }
  const { v2: cloudinary } = await import("cloudinary");
  cloudinary.config({ cloud_name, api_key, api_secret, secure: true });

  let destroyed = 0;
  let failed = 0;

  for (const orgId of orgIds) {
    const prefix = `pierflow/${orgId}`;
    let nextCursor;
    do {
      try {
        const res = await cloudinary.search
          .expression(`folder=${prefix}/*`)
          .max_results(500)
          .next_cursor(nextCursor)
          .execute();
        const resources = res.resources ?? [];
        for (const r of resources) {
          try {
            await cloudinary.uploader.destroy(r.public_id, {
              resource_type: r.resource_type ?? "image",
              invalidate: true,
            });
            destroyed++;
          } catch (e) {
            failed++;
            console.warn(
              `    destroy failed: ${r.public_id} — ${e?.message ?? e}`,
            );
          }
        }
        nextCursor = res.next_cursor;
      } catch (e) {
        console.warn(
          `    search failed under ${prefix}/* — ${e?.message ?? e}`,
        );
        nextCursor = undefined;
      }
    } while (nextCursor);
  }
  return { destroyed, failed };
}
