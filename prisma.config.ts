import path from "node:path";
import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

/**
 * Prisma 7 moved connection URLs out of schema.prisma into this config.
 * The CLI doesn't auto-load Next-style env files (.env.local / .env.development.local),
 * so we load them ourselves in the order Next.js would.
 */
[".env.local", ".env.development.local", ".env.development", ".env"].forEach((file) => {
  loadEnv({ path: file, override: false });
});

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
  },
  datasource: {
    // CLI tooling (migrate, studio, db push) needs a *direct* (non-pooled)
    // connection. Supabase via Vercel injects this as
    // POSTGRES_URL_NON_POOLING; allow DIRECT_URL / DATABASE_URL too so we
    // work regardless of how envs were named.
    url:
      process.env.DIRECT_URL ??
      process.env.POSTGRES_URL_NON_POOLING ??
      process.env.DATABASE_URL ??
      process.env.POSTGRES_PRISMA_URL,
  },
});
