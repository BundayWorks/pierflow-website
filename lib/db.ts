/**
 * Singleton Prisma client.
 *
 * Why singleton: in Next.js dev mode each HMR reload would otherwise
 * instantiate a fresh PrismaClient and exhaust Postgres connections
 * within a few saves. Caching on globalThis keeps a single instance for
 * the life of the process. In production (Vercel Fluid Compute) the
 * same pattern keeps us at one client per warm instance.
 *
 * Prisma 7 is engine-less by default — the JS-only runtime uses a
 * driver adapter (pg) for the actual Postgres connection. That works
 * well on Vercel because we get standard pg pooling semantics.
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

function resolveDatabaseUrl(): string | undefined {
  // Prefer the pooled URL at runtime — every Vercel Function should use
  // PgBouncer to avoid connection exhaustion.
  return (
    process.env.DATABASE_URL ??
    process.env.POSTGRES_PRISMA_URL ??
    process.env.POSTGRES_URL ??
    process.env.POSTGRES_URL_NON_POOLING
  );
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createClient(): PrismaClient {
  const connectionString = resolveDatabaseUrl();
  if (!connectionString) {
    // Loud in dev so devs notice, but don't crash the import — the
    // marketing site has many pages that don't need a DB.
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[db] No POSTGRES_* / DATABASE_URL env var set. Prisma queries will fail.",
      );
    }
  }
  const adapter = new PrismaPg({
    connectionString: connectionString ?? "postgres://placeholder",
  });
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
