import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getPlanDetail } from "../../actions";
import PlanFormClient from "../../new/PlanFormClient";

export const dynamic = "force-dynamic";

export default async function EditPlanPage({
  params,
}: {
  params: { planId: string };
}) {
  const plan = await getPlanDetail(params.planId);
  if (!plan) notFound();

  const initial = {
    id: plan.id,
    externalId: plan.externalId,
    name: plan.name,
    scope: plan.scope,
    status: plan.status,
    billingFrequency: plan.billingFrequency,
    coverage: (plan.coverage ?? {}) as Record<string, {
      covered?: boolean;
      limit?: number | null;
      co_pay_percent?: number | null;
      waiting_period_days?: number | null;
    }>,
    pricing: (plan.pricing ?? { individual_monthly: 0 }) as {
      individual_monthly?: number;
      age_bands?: { min_age: number; max_age: number; monthly: number }[];
      family_rate?: number | null;
      employer_discount_percent?: number | null;
    },
    waitingPeriods: plan.waitingPeriods as {
      general?: number | null;
      maternity?: number | null;
      pre_existing?: number | null;
    } | null,
    exclusions: Array.isArray(plan.exclusions) ? (plan.exclusions as string[]) : [],
  };

  return (
    <div>
      <Link
        href={`/portal/cover/plans/${plan.id}`}
        className="inline-flex items-center gap-1.5 text-[13px] text-accent-ink/55 hover:text-accent-ink"
      >
        <ArrowLeft size={14} /> {plan.name}
      </Link>

      <div className="mt-4">
        <h1 className="text-[22px] font-semibold text-accent-ink">
          Edit plan
        </h1>
        <p className="text-[14px] text-accent-ink/55 mt-1">
          Changes are applied immediately. Active plans update in the fintech
          marketplace in real time.
        </p>
      </div>

      <div className="mt-8">
        <PlanFormClient mode="edit" initial={initial} />
      </div>
    </div>
  );
}
