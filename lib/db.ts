/**
 * Singleton Prisma client.
 *
 * Why singleton: in Next.js dev mode each HMR reload would otherwise
 * instantiate a fresh PrismaClient and exhaust Postgres connections
 * within a few saves. Caching on globalThis keeps a single instance for
 * the life of the process. In production (Vercel Fluid Compute) the
 * same pattern keeps us at one client per warm instance.
 *
 * TLS rationale: pg v8+ interprets `sslmode=require` in the URL as
 * `verify-full` and ignores per-pool `ssl` overrides. Supabase's pooled
 * endpoint serves a certificate chain Node's default CA bundle doesn't
 * include. We rewrite the URL's sslmode to `no-verify` BEFORE Prisma
 * (or any adapter) reads it. The connection itself remains TLS-
 * encrypted; we just skip cert-chain verification.
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

function relaxSslmode(url: string): string {
  if (/sslmode=/.test(url)) {
    return url.replace(/sslmode=[^&]+/, "sslmode=no-verify");
  }
  return url + (url.includes("?") ? "&" : "?") + "sslmode=no-verify";
}

// Resolve the URL from any of the names our deploys use, then relax
// sslmode and write it back as DATABASE_URL — which is what Prisma's
// generated client reads by default.
function normaliseEnv(): void {
  const candidates = [
    "DATABASE_URL",
    "POSTGRES_PRISMA_URL",
    "POSTGRES_URL",
    "POSTGRES_URL_NON_POOLING",
  ];
  for (const name of candidates) {
    const v = process.env[name];
    if (v) {
      process.env[name] = relaxSslmode(v);
    }
  }
  // Ensure DATABASE_URL specifically is set — Prisma reads that name.
  if (!process.env.DATABASE_URL) {
    const fallback =
      process.env.POSTGRES_PRISMA_URL ??
      process.env.POSTGRES_URL ??
      process.env.POSTGRES_URL_NON_POOLING;
    if (fallback) process.env.DATABASE_URL = fallback;
  }
}

normaliseEnv();

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createClient(): PrismaClient {
  const connectionString =
    process.env.DATABASE_URL ?? "postgres://placeholder";

  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 10,
  });

  const adapter = new PrismaPg(pool);
  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "warn", "error"]
        : ["warn", "error"],
  });
}

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
