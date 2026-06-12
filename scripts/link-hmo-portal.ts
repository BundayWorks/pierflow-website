/**
 * Link an existing HMO provider to a Partner account for portal access.
 *
 * Creates: Partner (type=INSURER) + PartnerUser + PartnerOrganizationLink
 * so the HMO admin can sign into the partner portal and see Cover pages.
 *
 * Usage: npx tsx scripts/link-hmo-portal.ts <hmo-slug> <admin-email>
 * Example: npx tsx scripts/link-hmo-portal.ts reliancehmo olabode.ogunfuye@gmail.com
 */

import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { db } = await import("../lib/db");
  const [slug, email] = process.argv.slice(2);
  if (!slug || !email) {
    console.error("Usage: npx tsx scripts/link-hmo-portal.ts <hmo-slug> <admin-email>");
    process.exit(1);
  }

  // 1. Find the HMO provider
  const provider = await db.hmoProvider.findUnique({
    where: { slug },
    include: { organization: true },
  });
  if (!provider) {
    console.error(`HmoProvider with slug "${slug}" not found.`);
    process.exit(1);
  }
  console.log("Found HMO:", provider.displayName, "(org:", provider.organization.name + ")");

  // 2. Create or find the Partner (type=INSURER)
  const partnerSlug = `${slug}-portal`;
  const partner = await db.partner.upsert({
    where: { slug: partnerSlug },
    update: {},
    create: {
      name: provider.displayName,
      slug: partnerSlug,
      type: "INSURER",
      accessStatus: "PRODUCTION",
      consumesProducts: ["INSURANCE"],
      country: provider.organization.country,
    },
  });
  console.log("Partner:", partner.id, partner.slug);

  // 3. Link Partner ↔ Organization
  await db.partnerOrganizationLink.upsert({
    where: {
      partnerId_organizationId: {
        partnerId: partner.id,
        organizationId: provider.organizationId,
      },
    },
    update: {},
    create: {
      partnerId: partner.id,
      organizationId: provider.organizationId,
    },
  });
  console.log("Partner ↔ Organization linked");

  // 4. Create PartnerUser for the admin email
  const normalizedEmail = email.trim().toLowerCase();
  const existingUser = await db.partnerUser.findFirst({
    where: { partnerId: partner.id, email: normalizedEmail },
  });
  if (existingUser) {
    console.log("PartnerUser already exists:", existingUser.id);
  } else {
    const user = await db.partnerUser.create({
      data: {
        partnerId: partner.id,
        email: normalizedEmail,
        role: "ADMIN",
        // externalId left null — will be bound on first Clerk sign-in
        // via resolvePartnerUser()'s email-match path.
      },
    });
    console.log("PartnerUser created:", user.id, "email:", normalizedEmail);
  }

  console.log("\nDone! Sign into the portal with", normalizedEmail);
  console.log("The Cover nav items (Dashboard, Members, Claims, Eligibility) will appear in the sidebar.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
