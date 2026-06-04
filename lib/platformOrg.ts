/**
 * The Pierflow Platform organization.
 *
 * Special-purpose Organization that owns platform-level concerns:
 *   - Approved partners are linked here so they can hit the API even
 *     before any customer org has captured records for them.
 *   - Access-request reviewers belong here.
 *
 * Created on first access via getOrCreatePlatformOrg(). Idempotent —
 * safe to call on every request that needs it.
 */
import { db } from "@/lib/db";

const PLATFORM_ORG_SLUG = "pierflow-platform";

export async function getOrCreatePlatformOrg() {
  const existing = await db.organization.findUnique({
    where: { slug: PLATFORM_ORG_SLUG },
  });
  if (existing) return existing;

  return db.organization.create({
    data: {
      name: "Pierflow Platform",
      slug: PLATFORM_ORG_SLUG,
      type: "OTHER",
    },
  });
}
