/**
 * Singleton Prisma client.
 *
 * Why: in Next.js dev mode, each HMR reload would otherwise instantiate
 * a fresh PrismaClient and exhaust Postgres connections within a few
 * saves. Caching on `globalThis` keeps a single instance for the life of
 * the process.
 *
 * In production (Vercel Fluid Compute), function instances are reused
 * across requests; the same singleton pattern keeps us at one client
 * per warm instance.
 */
import { PrismaClient } from "@prisma/client";

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
