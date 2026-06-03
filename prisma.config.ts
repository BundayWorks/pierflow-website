import "dotenv/config";
import path from "node:path";
import { defineConfig } from "prisma/config";

/**
 * Prisma 7 moved connection URLs out of schema.prisma into this config
 * file. Migrate, studio, and other CLI tooling read this file.
 * Runtime PrismaClient is configured in lib/db.ts.
 */
export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
  },
  datasource: {
    // Connection URL used by CLI tooling (migrate, studio, db push).
    // In production we point this at the direct (non-pooled) URL;
    // the runtime PrismaClient uses the pooled URL via DATABASE_URL.
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  },
});
