/**
 * Singleton Prisma client.
 *
 * Why singleton: in Next.js dev mode each HMR reload would otherwise
 * instantiate a fresh PrismaClient and exhaust Postgres connections
 * within a few saves. Caching on globalThis keeps a single instance for
 * the life of the process. In production (Vercel Fluid Compute) the
 * same pattern keeps us at one client per warm instance.
 *
 * Prisma 7 reads the connection URL from env automatically. We surface
 * a clearer error here if none of the expected names are set.
 */
import { PrismaClient } from "@prisma/client";

function ensureDatabaseUrl() {
  const url =
    process.env.DATABASE_URL ??
    process.env.POSTGRES_PRISMA_URL ??
    process.env.POSTGRES_URL ??
    process.env.POSTGRES_URL_NON_POOLING;

  if (!url && process.env.NODE_ENV !== "production") {
    // Loud but non-fatal in dev so `next dev` still boots when no DB is
    // configured yet (e.g. someone running just the marketing site).
    console.warn(
      "[db] No POSTGRES_* / DATABASE_URL env var set. Prisma queries will fail.",
    );
  }

  // Map whatever name Supabase / Vercel chose into the one Prisma reads.
  if (url && !process.env.DATABASE_URL) {
    process.env.DATABASE_URL = url;
  }
}

ensureDatabaseUrl();

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "warn", "error"]
        : ["warn", "error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
