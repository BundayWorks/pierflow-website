/**
 * Pierflow Cover demo seed.
 *
 * Creates the minimum data set for a 15-minute end-to-end demo:
 *   1. INSURER Organization + HmoProvider + HMO Partner with portal access
 *   2. HmoPlan with realistic Nigerian coverage
 *   3. HmoContract with simple splits
 *   4. Fintech Partner with API key + opted into the HMO
 *   5. Sample enrollment
 *   6. Sample claim
 *
 * Run: npx tsx scripts/seed-cover-demo.ts
 *
 * Idempotent on the INSURER org slug — re-running updates or skips
 * existing rows rather than erroring on unique violations.
 */

import { PrismaClient } from "@prisma/client";
import * as crypto from "crypto";

const db = new PrismaClient();

const KOBO = BigInt(100);

async function main() {
  console.log("--- Pierflow Cover demo seed ---\n");

  // ── 1. INSURER Organization + HmoProvider ───────────────────────

  const org = await db.organization.upsert({
    where: { slug: "reliance-hmo" },
    update: {},
    create: {
      name: "Reliance Health",
      type: "INSURER",
      slug: "reliance-hmo",
      state: "Lagos",
      country: "NG",
      accessStatus: "ACTIVE",
    },
  });
  console.log("Organization:", org.id, org.name);

  const provider = await db.hmoProvider.upsert({
    where: { organizationId: org.id },
    update: {},
    create: {
      organizationId: org.id,
      slug: "reliance",
      displayName: "Reliance Health",
      registrationNo: "NAICOM-0042",
      contactEmail: "demo@reliance-hmo.com",
      status: "ACTIVE",
    },
  });
  console.log("HmoProvider:", provider.id, provider.slug);

  // ── HMO Partner (so the insurer can sign into the portal) ──────

  const hmoPartner = await db.partner.upsert({
    where: { slug: "reliance-hmo-portal" },
    update: {},
    create: {
      name: "Reliance Health",
      slug: "reliance-hmo-portal",
      type: "INSURER",
      accessStatus: "PRODUCTION",
      consumesProducts: ["INSURANCE"],
    },
  });
  console.log("HMO Partner:", hmoPartner.id, hmoPartner.slug);

  // Link partner to org
  await db.partnerOrganizationLink.upsert({
    where: {
      partnerId_organizationId: {
        partnerId: hmoPartner.id,
        organizationId: org.id,
      },
    },
    update: {},
    create: {
      partnerId: hmoPartner.id,
      organizationId: org.id,
    },
  });
  console.log("Partner ↔ Organization linked");

  // ── 2. HmoPlan ─────────────────────────────────────────────────

  const plan = await db.hmoPlan.upsert({
    where: {
      providerId_externalId: {
        providerId: provider.id,
        externalId: "silver-plan-2025",
      },
    },
    update: {},
    create: {
      providerId: provider.id,
      externalId: "silver-plan-2025",
      name: "Silver Plan",
      scope: "INDIVIDUAL",
      status: "ACTIVE",
      billingFrequency: "MONTHLY",
      coverage: {
        outpatient: { covered: true, limit: 500000, co_pay_percent: 10 },
        inpatient: { covered: true, limit: 2000000 },
        dental: { covered: true, limit: 100000 },
        optical: { covered: true, limit: 50000 },
        maternity: { covered: true, limit: 1000000 },
        surgical: { covered: true, limit: 1500000 },
      },
      pricing: {
        individual_monthly: 2500000, // ₦25,000 in kobo
        age_bands: [
          { min: 0, max: 17, multiplier: 0.6 },
          { min: 18, max: 35, multiplier: 1.0 },
          { min: 36, max: 50, multiplier: 1.3 },
          { min: 51, max: 65, multiplier: 1.7 },
          { min: 66, max: 120, multiplier: 2.2 },
        ],
      },
      waitingPeriods: {
        general: 30,
        maternity: 365,
        pre_existing: 180,
      },
      exclusions: [
        "Cosmetic surgery",
        "Self-inflicted injuries",
        "Experimental treatments",
      ],
    },
  });
  console.log("HmoPlan:", plan.id, plan.name);

  // ── 3. HmoContract ─────────────────────────────────────────────

  // Check if we already have an ACTIVE contract for this provider
  const existingContract = await db.hmoContract.findFirst({
    where: { providerId: provider.id, status: "ACTIVE" },
  });

  let contractId: string;
  if (existingContract) {
    contractId = existingContract.id;
    console.log("HmoContract (existing):", contractId, "v" + existingContract.version);
  } else {
    const contract = await db.hmoContract.create({
      data: {
        providerId: provider.id,
        version: 1,
        status: "ACTIVE",
        effectiveFrom: new Date("2025-01-01"),
        markupMode: "MARKUP_FROM_SHARES",
        enrollmentFeeNgn: BigInt(50000) * KOBO, // ₦500
        enrollmentBeneficiaryRole: "FINTECH",
        remainderBearer: "FINTECH",
        parties: {
          create: [
            {
              role: "PIERFLOW",
              kind: "PERCENTAGE",
              timing: "BOTH",
              amountBps: 300, // 3%
              settlementAccountTag: "pierflow:platform_fee",
            },
            {
              role: "FINTECH",
              kind: "PERCENTAGE",
              timing: "BOTH",
              amountBps: 500, // 5%
              settlementAccountTag: "fintech:self",
            },
          ],
        },
      },
    });
    contractId = contract.id;
    console.log("HmoContract:", contractId, "v" + contract.version);
  }

  // ── 4. Fintech Partner + API key + HMO opt-in ─────────────────

  const fintech = await db.partner.upsert({
    where: { slug: "demo-fintech" },
    update: {},
    create: {
      name: "DemoFintech",
      slug: "demo-fintech",
      type: "FINTECH",
      accessStatus: "PRODUCTION",
      consumesProducts: ["INSURANCE"],
    },
  });
  console.log("Fintech Partner:", fintech.id, fintech.slug);

  // API key (deterministic for demo)
  const rawKey = "pf_test_sk_demo_cover_" + fintech.id.slice(-8);
  const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");
  const existingKey = await db.partnerApiKey.findUnique({
    where: { keyHash },
  });
  if (!existingKey) {
    await db.partnerApiKey.create({
      data: {
        partnerId: fintech.id,
        keyHash,
        last4: rawKey.slice(-4),
        label: "cover-demo",
        scopes: ["insurance:read", "insurance:write"],
        env: "test",
      },
    });
    console.log("API key created:", rawKey);
  } else {
    console.log("API key exists:", rawKey);
  }

  // Opt-in to HMO
  await db.partnerHmoAccess.upsert({
    where: {
      partnerId_hmoProviderId: {
        partnerId: fintech.id,
        hmoProviderId: provider.id,
      },
    },
    update: { status: "ACTIVE" },
    create: {
      partnerId: fintech.id,
      hmoProviderId: provider.id,
      status: "ACTIVE",
      acceptedAt: new Date(),
      contractId,
      rateCardSnapshot: [
        { kind: "PERCENTAGE", amountBps: 500, timing: "BOTH" },
      ],
    },
  });
  console.log("Fintech opted into HMO");

  // ── 5. Sample enrollment ───────────────────────────────────────

  const enrollmentKey = "cover-demo-enroll-1";
  let enrollment = await db.hmoEnrollment.findFirst({
    where: { partnerId: fintech.id, idempotencyKey: enrollmentKey },
  });

  if (!enrollment) {
    enrollment = await db.hmoEnrollment.create({
      data: {
        partnerId: fintech.id,
        providerId: provider.id,
        planId: plan.id,
        fintechUserRef: "demo-user-001",
        fullName: "Adeola Ogundimu",
        email: "adeola@example.com",
        phone: "+2348012345678",
        status: "ACTIVE",
        effectiveFrom: new Date(),
        wholesaleNgn: BigInt(2500000),  // ₦25,000
        markupNgn: BigInt(200000),      // ₦2,000
        memberPaysNgn: BigInt(2700000), // ₦27,000
        splitsSnapshot: {
          mode: "MARKUP_FROM_SHARES",
          wholesale_ngn: "2500000",
          markup_ngn: "200000",
          member_pays_ngn: "2700000",
          hmo_line: {
            role: "HMO",
            amount_ngn: "2500000",
            settlement_tag: "hmo:reliance",
          },
          lines: [
            {
              role: "PIERFLOW",
              amount_ngn: "75000",
              settlement_tag: "pierflow:platform_fee",
            },
            {
              role: "FINTECH",
              amount_ngn: "125000",
              settlement_tag: "fintech:self",
              is_remainder: true,
            },
          ],
        },
        contractVersion: 1,
        idempotencyKey: enrollmentKey,
        hmoPolicyId: "REL-DEMO-POL-001",
        hmoMemberId: "REL-MBR-001",
      },
    });
    console.log("Enrollment created:", enrollment.id);
  } else {
    console.log("Enrollment exists:", enrollment.id);
  }

  // ── 6. Sample claim ────────────────────────────────────────────

  const claimKey = "cover-demo-claim-1";
  let claim = await db.hmoClaim.findFirst({
    where: { partnerId: fintech.id, idempotencyKey: claimKey },
  });

  if (!claim) {
    claim = await db.hmoClaim.create({
      data: {
        partnerId: fintech.id,
        enrollmentId: enrollment.id,
        fintechUserRef: "demo-user-001",
        serviceDate: new Date(),
        serviceType: "outpatient_visit",
        facilityName: "Reddington Hospital",
        amountNgn: BigInt(85000), // ₦850
        diagnosisCodes: ["J06.9"],
        procedureCodes: ["99213"],
        notes: "Acute upper respiratory infection — consultation + medication",
        status: "UNDER_REVIEW",
        hmoClaimId: "REL-CLM-DEMO-001",
        idempotencyKey: claimKey,
      },
    });
    console.log("Claim created:", claim.id);
  } else {
    console.log("Claim exists:", claim.id);
  }

  console.log("\n--- Seed complete! ---");
  console.log("\nDemo flow:");
  console.log("1. Sign in as HMO partner → see Cover dashboard");
  console.log("2. POST /v1/cover/eligibility with enrollment_id:", enrollment.id);
  console.log("3. POST /v1/cover/claims to submit a new claim");
  console.log("4. Approve claim in portal → webhook fires to fintech");
  console.log("\nFintech API key:", rawKey);
  console.log("HMO partner slug:", hmoPartner.slug);
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
