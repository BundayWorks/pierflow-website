import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getContractDetailAction, type ContractPartyRow } from "../actions";

export const dynamic = "force-dynamic";

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700",
  DRAFT: "bg-blue-50 text-blue-700",
  SUPERSEDED: "bg-gray-50 text-gray-500",
  TERMINATED: "bg-red-50 text-red-600",
};

function koboToNaira(kobo: string): string {
  return (Number(kobo) / 100).toLocaleString("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
  });
}

function bpsToPercent(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`;
}

function formatFeeAmount(party: ContractPartyRow): string {
  if (party.kind === "FLAT" && party.amountFlatNgn) {
    return koboToNaira(party.amountFlatNgn);
  }
  if (party.kind === "PERCENTAGE" && party.amountBps != null) {
    return bpsToPercent(party.amountBps);
  }
  return "—";
}

function formatBounds(party: ContractPartyRow): string {
  const parts: string[] = [];
  if (party.minPerCycleNgn) parts.push(`min ${koboToNaira(party.minPerCycleNgn)}`);
  if (party.maxPerCycleNgn) parts.push(`max ${koboToNaira(party.maxPerCycleNgn)}`);
  return parts.join(", ") || "—";
}

export default async function ContractDetailPage({
  params,
}: {
  params: { contractId: string };
}) {
  const contract = await getContractDetailAction(params.contractId);
  if (!contract) notFound();

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/portal/cover/contracts"
          className="inline-flex items-center gap-1.5 text-[13px] text-accent-ink/55 hover:text-accent-ink"
        >
          <ArrowLeft size={14} /> Contracts
        </Link>
        <div className="mt-4 flex items-center gap-3">
          <h1 className="text-[22px] font-semibold text-accent-ink">
            Contract v{contract.version}
          </h1>
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded text-[11px] font-medium ${
              STATUS_COLORS[contract.status] ?? "bg-gray-50 text-gray-600"
            }`}
          >
            {contract.status}
          </span>
        </div>
        <p className="text-[14px] text-accent-ink/55 mt-1">
          Read-only view of your commercial agreement. Managed by Pierflow.
        </p>
      </div>

      {/* Overview */}
      <div className="rounded-xl border border-black/[0.08] p-5 space-y-3">
        <h2 className="text-[14px] font-semibold text-accent-ink">Overview</h2>
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 text-[13px]">
          <div>
            <p className="text-accent-ink/50 text-[11px] uppercase tracking-wider mb-0.5">
              Markup Mode
            </p>
            <p className="text-accent-ink font-medium">
              {contract.markupMode.replace(/_/g, " ")}
            </p>
          </div>
          {contract.markupFixedNgn && (
            <div>
              <p className="text-accent-ink/50 text-[11px] uppercase tracking-wider mb-0.5">
                Fixed Markup
              </p>
              <p className="text-accent-ink font-medium font-mono">
                {koboToNaira(contract.markupFixedNgn)}
              </p>
            </div>
          )}
          <div>
            <p className="text-accent-ink/50 text-[11px] uppercase tracking-wider mb-0.5">
              Enrollment Fee
            </p>
            <p className="text-accent-ink font-medium font-mono">
              {contract.enrollmentFeeNgn
                ? koboToNaira(contract.enrollmentFeeNgn)
                : "None"}
            </p>
          </div>
          {contract.enrollmentBeneficiaryRole && (
            <div>
              <p className="text-accent-ink/50 text-[11px] uppercase tracking-wider mb-0.5">
                Enrollment Fee Beneficiary
              </p>
              <p className="text-accent-ink font-medium">
                {contract.enrollmentBeneficiaryRole}
              </p>
            </div>
          )}
          <div>
            <p className="text-accent-ink/50 text-[11px] uppercase tracking-wider mb-0.5">
              Remainder Bearer
            </p>
            <p className="text-accent-ink font-medium">{contract.remainderBearer}</p>
          </div>
          <div>
            <p className="text-accent-ink/50 text-[11px] uppercase tracking-wider mb-0.5">
              Effective
            </p>
            <p className="text-accent-ink font-medium">
              {new Date(contract.effectiveFrom).toLocaleDateString()}
              {contract.effectiveTo
                ? ` → ${new Date(contract.effectiveTo).toLocaleDateString()}`
                : " → ongoing"}
            </p>
          </div>
          <div>
            <p className="text-accent-ink/50 text-[11px] uppercase tracking-wider mb-0.5">
              Created
            </p>
            <p className="text-accent-ink font-medium">
              {new Date(contract.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
        {contract.notes && (
          <div className="pt-2 border-t border-black/[0.06]">
            <p className="text-accent-ink/50 text-[11px] uppercase tracking-wider mb-0.5">
              Notes
            </p>
            <p className="text-accent-ink/75 text-[13px] whitespace-pre-wrap">
              {contract.notes}
            </p>
          </div>
        )}
      </div>

      {/* Parties table */}
      <div className="space-y-3">
        <h2 className="text-[14px] font-semibold text-accent-ink">
          Parties ({contract.parties.length})
        </h2>
        <div className="rounded-xl border border-black/[0.08] overflow-hidden">
          <table className="w-full text-[13px]">
            <thead className="bg-black/[0.03] text-accent-ink/55 uppercase tracking-[0.1em] text-[10px]">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">Role</th>
                <th className="text-left px-4 py-2.5 font-medium">Kind</th>
                <th className="text-left px-4 py-2.5 font-medium">Amount</th>
                <th className="text-left px-4 py-2.5 font-medium">Timing</th>
                <th className="text-left px-4 py-2.5 font-medium">Bounds</th>
                <th className="text-left px-4 py-2.5 font-medium">
                  Settlement Tag
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.06]">
              {contract.parties.map((p) => (
                <tr key={p.id} className="hover:bg-black/[0.02]">
                  <td className="px-4 py-3 font-medium text-accent-ink">
                    {p.role}
                    {p.displayName ? (
                      <span className="block text-[11px] text-accent-ink/45 font-normal">
                        {p.displayName}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-accent-ink/75">{p.kind}</td>
                  <td className="px-4 py-3 font-mono text-[12px] text-accent-ink/75">
                    {formatFeeAmount(p)}
                  </td>
                  <td className="px-4 py-3 text-accent-ink/65 text-[12px]">
                    {p.timing.replace(/_/g, " ")}
                  </td>
                  <td className="px-4 py-3 text-accent-ink/50 font-mono text-[12px]">
                    {formatBounds(p)}
                  </td>
                  <td className="px-4 py-3 text-accent-ink/50 font-mono text-[11px]">
                    {p.settlementAccountTag ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
