"use server";

import { resolveSession } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * Resolve the HMO provider id for the current INSURER partner.
 * Chain: Partner → PartnerOrganizationLink → Organization → HmoProvider
 */
async function resolveProviderId(): Promise<string | null> {
  const session = await resolveSession();
  if (session.kind !== "partner") return null;

  const link = await db.partnerOrganizationLink.findFirst({
    where: { partnerId: session.partner.id },
    include: {
      organization: {
        include: { hmoProvider: { select: { id: true } } },
      },
    },
  });
  return link?.organization?.hmoProvider?.id ?? null;
}

// ─────────────────────────────────────────────────────────────────────
// Dashboard stats
// ─────────────────────────────────────────────────────────────────────

export type CoverDashboardStats = {
  totalMembers: number;
  activeMembers: number;
  pendingClaims: number;
  approvedClaims: number;
  rejectedClaims: number;
};

export type PlanStats = {
  activePlans: number;
  draftPlans: number;
  withdrawnPlans: number;
  stalePlans: number;
};

export type MonthlyEnrollment = {
  month: string; // YYYY-MM
  count: number;
};

export type TopPlan = {
  planId: string;
  planName: string;
  enrollmentCount: number;
  revenueKobo: string;
};

export type EnhancedDashboardData = {
  stats: CoverDashboardStats;
  planStats: PlanStats;
  enrollmentTrend: MonthlyEnrollment[];
  totalRevenueKobo: string;
  claimApprovalRate: number | null;
  topPlans: TopPlan[];
};

export async function getDashboardStats(): Promise<CoverDashboardStats | null> {
  const providerId = await resolveProviderId();
  if (!providerId) return null;

  const [totalMembers, activeMembers, pendingClaims, approvedClaims, rejectedClaims] =
    await Promise.all([
      db.hmoEnrollment.count({ where: { providerId } }),
      db.hmoEnrollment.count({ where: { providerId, status: "ACTIVE" } }),
      db.hmoClaim.count({
        where: {
          enrollment: { providerId },
          status: { in: ["SUBMITTED", "PENDING_HMO", "UNDER_REVIEW"] },
        },
      }),
      db.hmoClaim.count({
        where: {
          enrollment: { providerId },
          status: { in: ["APPROVED", "PAID"] },
        },
      }),
      db.hmoClaim.count({
        where: {
          enrollment: { providerId },
          status: "REJECTED",
        },
      }),
    ]);

  return { totalMembers, activeMembers, pendingClaims, approvedClaims, rejectedClaims };
}

export async function getEnhancedDashboardData(): Promise<EnhancedDashboardData | null> {
  const providerId = await resolveProviderId();
  if (!providerId) return null;

  const now = new Date();
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const staleThreshold = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    stats,
    activePlans,
    draftPlans,
    withdrawnPlans,
    stalePlans,
    recentEnrollments,
    totalRevenue,
    resolvedClaims,
    topPlanRows,
  ] = await Promise.all([
    // Base stats (reuse existing logic inline)
    (async () => {
      const [totalMembers, activeMembers, pendingClaims, approvedClaims, rejectedClaims] =
        await Promise.all([
          db.hmoEnrollment.count({ where: { providerId } }),
          db.hmoEnrollment.count({ where: { providerId, status: "ACTIVE" } }),
          db.hmoClaim.count({
            where: { enrollment: { providerId }, status: { in: ["SUBMITTED", "PENDING_HMO", "UNDER_REVIEW"] } },
          }),
          db.hmoClaim.count({
            where: { enrollment: { providerId }, status: { in: ["APPROVED", "PAID"] } },
          }),
          db.hmoClaim.count({
            where: { enrollment: { providerId }, status: "REJECTED" },
          }),
        ]);
      return { totalMembers, activeMembers, pendingClaims, approvedClaims, rejectedClaims };
    })(),

    // Plan counts
    db.hmoPlan.count({ where: { providerId, status: "ACTIVE" } }),
    db.hmoPlan.count({ where: { providerId, status: "DRAFT" } }),
    db.hmoPlan.count({ where: { providerId, status: "WITHDRAWN" } }),
    db.hmoPlan.count({
      where: {
        providerId,
        status: "ACTIVE",
        updatedAt: { lt: staleThreshold },
      },
    }),

    // Recent enrollments (last 6 months) for trend
    db.hmoEnrollment.findMany({
      where: { providerId, createdAt: { gte: sixMonthsAgo } },
      select: { createdAt: true },
    }),

    // Total revenue (sum of memberPaysNgn for active enrollments)
    db.hmoEnrollment.aggregate({
      where: { providerId, status: { in: ["ACTIVE", "LAPSED", "CANCELLED"] } },
      _sum: { memberPaysNgn: true },
    }),

    // Resolved claims for approval rate
    db.hmoClaim.count({
      where: {
        enrollment: { providerId },
        status: { in: ["APPROVED", "PAID", "REJECTED"] },
      },
    }),

    // Top plans by enrollment count
    db.hmoEnrollment.groupBy({
      by: ["planId"],
      where: { providerId },
      _count: { id: true },
      _sum: { memberPaysNgn: true },
      orderBy: { _count: { id: "desc" } },
      take: 5,
    }),
  ]);

  // Build monthly trend
  const monthMap = new Map<string, number>();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthMap.set(key, 0);
  }
  for (const e of recentEnrollments) {
    const d = e.createdAt;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (monthMap.has(key)) monthMap.set(key, monthMap.get(key)! + 1);
  }
  const enrollmentTrend: MonthlyEnrollment[] = Array.from(monthMap.entries()).map(
    ([month, count]) => ({ month, count }),
  );

  // Approval rate
  const approvedTotal = stats.approvedClaims;
  const claimApprovalRate =
    resolvedClaims > 0 ? Math.round((approvedTotal / resolvedClaims) * 100) : null;

  // Enrich top plans with names
  const planIds = topPlanRows.map((r) => r.planId);
  const planNames = planIds.length
    ? await db.hmoPlan.findMany({
        where: { id: { in: planIds } },
        select: { id: true, name: true },
      })
    : [];
  const nameMap = new Map(planNames.map((p) => [p.id, p.name]));

  const topPlans: TopPlan[] = topPlanRows.map((r) => ({
    planId: r.planId,
    planName: nameMap.get(r.planId) ?? "Unknown plan",
    enrollmentCount: r._count.id,
    revenueKobo: (r._sum.memberPaysNgn ?? BigInt(0)).toString(),
  }));

  return {
    stats,
    planStats: {
      activePlans,
      draftPlans,
      withdrawnPlans,
      stalePlans,
    },
    enrollmentTrend,
    totalRevenueKobo: (totalRevenue._sum.memberPaysNgn ?? BigInt(0)).toString(),
    claimApprovalRate,
    topPlans,
  };
}

// ─────────────────────────────────────────────────────────────────────
// Members list
// ─────────────────────────────────────────────────────────────────────

export type MemberRow = {
  id: string;
  fullName: string;
  planName: string;
  planId: string;
  status: string;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  hmoMemberId: string | null;
  fintechUserRef: string;
  createdAt: string;
};

export type MembersResult = {
  items: MemberRow[];
  nextCursor: string | null;
  totalCount: number;
};

export type PlanOption = { id: string; name: string };

export async function getPlanOptions(): Promise<PlanOption[]> {
  const providerId = await resolveProviderId();
  if (!providerId) return [];
  const plans = await db.hmoPlan.findMany({
    where: { providerId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return plans;
}

export async function getMembers(opts?: {
  search?: string;
  status?: string;
  planId?: string;
  cursor?: string;
  limit?: number;
}): Promise<MembersResult> {
  const providerId = await resolveProviderId();
  if (!providerId) return { items: [], nextCursor: null, totalCount: 0 };

  const limit = opts?.limit ?? 50;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = { providerId };

  if (opts?.status) where.status = opts.status;
  if (opts?.planId) where.planId = opts.planId;
  if (opts?.search) {
    const q = opts.search.trim();
    where.OR = [
      { fullName: { contains: q, mode: "insensitive" } },
      { hmoMemberId: { contains: q, mode: "insensitive" } },
      { fintechUserRef: { contains: q, mode: "insensitive" } },
    ];
  }

  const [totalCount, enrollments] = await Promise.all([
    db.hmoEnrollment.count({ where }),
    db.hmoEnrollment.findMany({
      where,
      include: { plan: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(opts?.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
    }),
  ]);

  const hasMore = enrollments.length > limit;
  const page = hasMore ? enrollments.slice(0, limit) : enrollments;
  const nextCursor = hasMore ? page[page.length - 1].id : null;

  return {
    items: page.map((e) => ({
      id: e.id,
      fullName: e.fullName,
      planName: e.plan.name,
      planId: e.plan.id,
      status: e.status,
      effectiveFrom: e.effectiveFrom?.toISOString() ?? null,
      effectiveTo: e.effectiveTo?.toISOString() ?? null,
      hmoMemberId: e.hmoMemberId,
      fintechUserRef: e.fintechUserRef,
      createdAt: e.createdAt.toISOString(),
    })),
    nextCursor,
    totalCount,
  };
}

// ─────────────────────────────────────────────────────────────────────
// Claims list
// ─────────────────────────────────────────────────────────────────────

export type ClaimRow = {
  id: string;
  enrollmentId: string;
  memberName: string;
  serviceDate: string;
  serviceType: string | null;
  facilityName: string | null;
  amountNgn: string;
  status: string;
  approvedAmountNgn: string | null;
  rejectionReason: string | null;
  createdAt: string;
};

export type ClaimsResult = {
  items: ClaimRow[];
  nextCursor: string | null;
  totalCount: number;
};

export async function getClaims(opts?: {
  search?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  cursor?: string;
  limit?: number;
}): Promise<ClaimsResult> {
  const providerId = await resolveProviderId();
  if (!providerId) return { items: [], nextCursor: null, totalCount: 0 };

  const limit = opts?.limit ?? 50;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = { enrollment: { providerId } };

  if (opts?.status) where.status = opts.status;
  if (opts?.dateFrom || opts?.dateTo) {
    where.serviceDate = {};
    if (opts?.dateFrom) where.serviceDate.gte = new Date(opts.dateFrom);
    if (opts?.dateTo) where.serviceDate.lte = new Date(opts.dateTo);
  }
  if (opts?.search) {
    const q = opts.search.trim();
    where.OR = [
      { enrollment: { providerId, fullName: { contains: q, mode: "insensitive" } } },
      { facilityName: { contains: q, mode: "insensitive" } },
      { hmoClaimId: { contains: q, mode: "insensitive" } },
    ];
  }

  const [totalCount, claims] = await Promise.all([
    db.hmoClaim.count({ where }),
    db.hmoClaim.findMany({
      where,
      include: { enrollment: { select: { fullName: true } } },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(opts?.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
    }),
  ]);

  const hasMore = claims.length > limit;
  const page = hasMore ? claims.slice(0, limit) : claims;
  const nextCursor = hasMore ? page[page.length - 1].id : null;

  return {
    items: page.map((c) => ({
      id: c.id,
      enrollmentId: c.enrollmentId,
      memberName: c.enrollment.fullName,
      serviceDate: c.serviceDate.toISOString(),
      serviceType: c.serviceType,
      facilityName: c.facilityName,
      amountNgn: c.amountNgn.toString(),
      status: c.status,
      approvedAmountNgn: c.approvedAmountNgn?.toString() ?? null,
      rejectionReason: c.rejectionReason,
      createdAt: c.createdAt.toISOString(),
    })),
    nextCursor,
    totalCount,
  };
}

// ─────────────────────────────────────────────────────────────────────
// Eligibility check
// ─────────────────────────────────────────────────────────────────────

export type EligibilityResult = {
  eligible: boolean;
  enrollment: {
    id: string;
    fullName: string;
    planName: string;
    status: string;
    effectiveFrom: string | null;
    effectiveTo: string | null;
  } | null;
  coverageSummary: Record<string, unknown> | null;
};

export async function checkEligibility(
  identifier: string,
): Promise<EligibilityResult> {
  const providerId = await resolveProviderId();
  if (!providerId) {
    return { eligible: false, enrollment: null, coverageSummary: null };
  }

  // Search by enrollment id or HMO member id.
  const enrollment = await db.hmoEnrollment.findFirst({
    where: {
      providerId,
      OR: [
        { id: identifier },
        { hmoMemberId: identifier },
      ],
    },
    include: { plan: { select: { name: true, coverage: true } } },
  });

  if (!enrollment) {
    return { eligible: false, enrollment: null, coverageSummary: null };
  }

  return {
    eligible: enrollment.status === "ACTIVE",
    enrollment: {
      id: enrollment.id,
      fullName: enrollment.fullName,
      planName: enrollment.plan.name,
      status: enrollment.status,
      effectiveFrom: enrollment.effectiveFrom?.toISOString() ?? null,
      effectiveTo: enrollment.effectiveTo?.toISOString() ?? null,
    },
    coverageSummary: enrollment.plan.coverage as Record<string, unknown>,
  };
}
