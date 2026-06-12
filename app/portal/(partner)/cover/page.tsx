import Link from "next/link";
import { getEnhancedDashboardData } from "./actions";

export const dynamic = "force-dynamic";

function koboToNaira(kobo: string): string {
  return (Number(kobo) / 100).toLocaleString("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
  });
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split("-");
  const d = new Date(Number(y), Number(m) - 1);
  return d.toLocaleDateString("en-NG", { month: "short" });
}

export default async function CoverDashboardPage() {
  const data = await getEnhancedDashboardData();

  if (!data) {
    return (
      <div className="space-y-4">
        <h1 className="text-[22px] font-semibold text-accent-ink">
          Pierflow Cover
        </h1>
        <p className="text-[14px] text-accent-ink/60">
          Unable to load dashboard. This partner may not have an HMO provider
          linked.
        </p>
      </div>
    );
  }

  const { stats, planStats, enrollmentTrend, totalRevenueKobo, claimApprovalRate, topPlans } =
    data;

  const memberCards = [
    { label: "Total members", value: stats.totalMembers },
    { label: "Active members", value: stats.activeMembers },
    { label: "Pending claims", value: stats.pendingClaims },
    { label: "Approved claims", value: stats.approvedClaims },
    { label: "Rejected claims", value: stats.rejectedClaims },
  ];

  const planCards = [
    { label: "Active plans", value: planStats.activePlans, color: "text-emerald-700" },
    { label: "Draft plans", value: planStats.draftPlans, color: "text-blue-700" },
    { label: "Withdrawn", value: planStats.withdrawnPlans, color: "text-gray-500" },
    { label: "Stale (>30d)", value: planStats.stalePlans, color: "text-amber-600" },
  ];

  const maxEnrollment = Math.max(...enrollmentTrend.map((e) => e.count), 1);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-[22px] font-semibold text-accent-ink">
          Pierflow Cover
        </h1>
        <p className="text-[14px] text-accent-ink/55 mt-1">
          Health insurance management dashboard
        </p>
      </div>

      {/* Members & Claims KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {memberCards.map((card) => (
          <div
            key={card.label}
            className="rounded-lg border border-black/[0.06] p-4 bg-white"
          >
            <p className="text-[12px] text-accent-ink/55 uppercase tracking-wide">
              {card.label}
            </p>
            <p className="text-[28px] font-semibold text-accent-ink mt-1">
              {card.value.toLocaleString()}
            </p>
          </div>
        ))}
      </div>

      {/* Plan stats + Revenue + Approval Rate */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="rounded-xl border border-black/[0.08] p-5">
          <h2 className="text-[13px] font-semibold text-accent-ink/65 uppercase tracking-wider mb-3">
            Plan Catalogue
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {planCards.map((c) => (
              <div key={c.label}>
                <p className="text-[11px] text-accent-ink/45">{c.label}</p>
                <p className={`text-[24px] font-semibold ${c.color}`}>
                  {c.value}
                </p>
              </div>
            ))}
          </div>
          <Link
            href="/portal/cover/plans"
            className="block mt-3 text-[12px] text-accent-emerald hover:underline"
          >
            Manage plans →
          </Link>
        </div>

        <div className="rounded-xl border border-black/[0.08] p-5">
          <h2 className="text-[13px] font-semibold text-accent-ink/65 uppercase tracking-wider mb-3">
            Total Revenue
          </h2>
          <p className="text-[28px] font-semibold text-accent-ink font-mono">
            {koboToNaira(totalRevenueKobo)}
          </p>
          <p className="text-[12px] text-accent-ink/45 mt-1">
            Cumulative member payments
          </p>
        </div>

        <div className="rounded-xl border border-black/[0.08] p-5">
          <h2 className="text-[13px] font-semibold text-accent-ink/65 uppercase tracking-wider mb-3">
            Claim Approval Rate
          </h2>
          <p className="text-[28px] font-semibold text-accent-ink">
            {claimApprovalRate != null ? `${claimApprovalRate}%` : "—"}
          </p>
          <p className="text-[12px] text-accent-ink/45 mt-1">
            Approved ÷ resolved claims
          </p>
        </div>
      </div>

      {/* Enrollment trend (last 6 months) */}
      <div className="rounded-xl border border-black/[0.08] p-5">
        <h2 className="text-[13px] font-semibold text-accent-ink/65 uppercase tracking-wider mb-4">
          Enrollment Trend (Last 6 Months)
        </h2>
        <div className="flex items-end gap-2 h-32">
          {enrollmentTrend.map((e) => (
            <div key={e.month} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-[11px] text-accent-ink/55 font-mono">
                {e.count}
              </span>
              <div
                className="w-full rounded-t bg-accent-emerald/70"
                style={{
                  height: `${Math.max((e.count / maxEnrollment) * 100, 4)}%`,
                }}
              />
              <span className="text-[10px] text-accent-ink/45">
                {monthLabel(e.month)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Top plans */}
      {topPlans.length > 0 && (
        <div className="rounded-xl border border-black/[0.08] p-5">
          <h2 className="text-[13px] font-semibold text-accent-ink/65 uppercase tracking-wider mb-3">
            Top Plans by Enrollment
          </h2>
          <table className="w-full text-[13px]">
            <thead className="text-accent-ink/50 text-[10px] uppercase tracking-wider">
              <tr>
                <th className="text-left pb-2 font-medium">Plan</th>
                <th className="text-right pb-2 font-medium">Enrollments</th>
                <th className="text-right pb-2 font-medium">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.04]">
              {topPlans.map((p) => (
                <tr key={p.planId}>
                  <td className="py-2.5 font-medium text-accent-ink">
                    <Link
                      href={`/portal/cover/plans/${p.planId}`}
                      className="hover:text-accent-emerald"
                    >
                      {p.planName}
                    </Link>
                  </td>
                  <td className="py-2.5 text-right text-accent-ink/65">
                    {p.enrollmentCount.toLocaleString()}
                  </td>
                  <td className="py-2.5 text-right font-mono text-[12px] text-accent-ink/65">
                    {koboToNaira(p.revenueKobo)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
