import Link from "next/link";
import { Plus, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { getPlans } from "./actions";

export const dynamic = "force-dynamic";

function formatKobo(kobo: number | null): string {
  if (kobo === null) return "—";
  return `₦${(kobo / 100).toLocaleString()}`;
}

export default async function PlansPage() {
  const plans = await getPlans();

  return (
    <div>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[22px] font-semibold text-accent-ink">Plans</h1>
          <p className="text-[14px] text-accent-ink/55 mt-1">
            Manage your plan catalogue. Active plans are visible to fintechs in
            the marketplace.
          </p>
        </div>
        <Link
          href="/portal/cover/plans/new"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-accent-emerald text-white text-[13px] font-medium hover:bg-accent-emerald/90"
        >
          <Plus size={14} /> Create plan
        </Link>
      </div>

      {plans.length === 0 ? (
        <div className="mt-12 text-center text-[14px] text-accent-ink/55">
          <p>No plans yet. Create your first plan to start distributing through fintechs.</p>
        </div>
      ) : (
        <div className="mt-6 rounded-xl border border-black/[0.08] overflow-hidden">
          <table className="w-full text-[13px]">
            <thead className="bg-black/[0.03] text-accent-ink/55 uppercase tracking-[0.1em] text-[10px]">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">Plan</th>
                <th className="text-left px-4 py-2.5 font-medium">Status</th>
                <th className="text-left px-4 py-2.5 font-medium">Scope</th>
                <th className="text-left px-4 py-2.5 font-medium">Billing</th>
                <th className="text-right px-4 py-2.5 font-medium">Wholesale</th>
                <th className="text-right px-4 py-2.5 font-medium">Last synced</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.06]">
              {plans.map((plan) => (
                <tr
                  key={plan.id}
                  className="hover:bg-black/[0.02]"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/portal/cover/plans/${plan.id}`}
                      className="text-accent-ink font-medium hover:text-accent-emerald"
                    >
                      {plan.name}
                    </Link>
                    <p className="text-[11px] text-accent-ink/45 font-mono mt-0.5">
                      {plan.externalId}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <StatusChip status={plan.status} stale={plan.stale} />
                  </td>
                  <td className="px-4 py-3 text-accent-ink/75">
                    {plan.scope.replace(/_/g, " ").toLowerCase()}
                  </td>
                  <td className="px-4 py-3 text-accent-ink/75">
                    {plan.billingFrequency.toLowerCase()}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-accent-ink">
                    {formatKobo(plan.wholesaleMonthly)}
                  </td>
                  <td className="px-4 py-3 text-right text-[12px] text-accent-ink/55">
                    {new Date(plan.lastSyncedAt).toLocaleDateString()}
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

function StatusChip({ status, stale }: { status: string; stale: boolean }) {
  if (stale && status === "ACTIVE") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.12em] font-medium px-2 py-0.5 rounded-full bg-[#fff4d4] text-[#7a4a00]">
        <Clock size={10} /> Stale
      </span>
    );
  }
  if (status === "ACTIVE") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.12em] font-medium px-2 py-0.5 rounded-full bg-card-mint text-accent-emerald">
        <CheckCircle2 size={10} /> Active
      </span>
    );
  }
  if (status === "DRAFT") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.12em] font-medium px-2 py-0.5 rounded-full bg-[#eef2ff] text-[#3a3a8a]">
        <Clock size={10} /> Draft
      </span>
    );
  }
  if (status === "WITHDRAWN") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.12em] font-medium px-2 py-0.5 rounded-full bg-black/[0.06] text-accent-ink/55">
        Withdrawn
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.12em] font-medium px-2 py-0.5 rounded-full bg-[#fde6e6] text-[#a83232]">
      <AlertCircle size={10} /> {status}
    </span>
  );
}
