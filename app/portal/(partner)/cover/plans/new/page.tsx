import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import PlanFormClient from "./PlanFormClient";

export default function NewPlanPage() {
  return (
    <div>
      <Link
        href="/portal/cover/plans"
        className="inline-flex items-center gap-1.5 text-[13px] text-accent-ink/55 hover:text-accent-ink"
      >
        <ArrowLeft size={14} /> Plans
      </Link>

      <div className="mt-4">
        <h1 className="text-[22px] font-semibold text-accent-ink">
          Create a plan
        </h1>
        <p className="text-[14px] text-accent-ink/55 mt-1">
          Define coverage, pricing, and waiting periods. Active plans are
          immediately visible to fintechs in the marketplace.
        </p>
      </div>

      <div className="mt-8">
        <PlanFormClient mode="create" />
      </div>
    </div>
  );
}
