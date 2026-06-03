// Standalone TLS probe — no Prisma in the loop.
// Run with: node --env-file=.env.local scripts/test-db.mjs
import { Pool } from "pg";

const url =
  process.env.POSTGRES_PRISMA_URL ??
  process.env.DATABASE_URL ??
  process.env.POSTGRES_URL;

console.log("URL host:", new URL(url).host);

// pg v8+ treats sslmode=require in the URL as verify-full and ignores
// our ssl option. Downgrade to no-verify in-place so pg accepts the
// Supabase pooler's self-signed chain. Connection stays encrypted.
const finalUrl = /sslmode=/.test(url)
  ? url.replace(/sslmode=[^&]+/, "sslmode=no-verify")
  : url + (url.includes("?") ? "&" : "?") + "sslmode=no-verify";

const pool = new Pool({
  connectionString: finalUrl,
  ssl: { rejectUnauthorized: false },
});

try {
  const r = await pool.query("select now() as now");
  console.log("OK:", r.rows[0]);
} catch (e) {
  console.error("FAIL:", e.message);
}
await pool.end();
