import Link from "next/link";
import { getContracts } from "./actions";

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

function formatMarkupMode(mode: string): string {
  return mode
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default async function ContractsPage() {
  const contracts = await getContracts();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold text-accent-ink">Contracts</h1>
        <p className="text-[14px] text-accent-ink/55 mt-1">
          Commercial agreements managed by Pierflow. Read-only view.
        </p>
      </div>

      {contracts.length === 0 ? (
        <p className="text-[14px] text-accent-ink/50">
          No contracts yet. Contact Pierflow to set up your rate card.
        </p>
      ) : (
        <div className="rounded-xl border border-black/[0.08] overflow-hidden">
          <table className="w-full text-[13px]">
            <thead className="bg-black/[0.03] text-accent-ink/55 uppercase tracking-[0.1em] text-[10px]">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">Version</th>
                <th className="text-left px-4 py-2.5 font-medium">Status</th>
                <th className="text-left px-4 py-2.5 font-medium">Markup Mode</th>
                <th className="text-left px-4 py-2.5 font-medium">Effective</th>
                <th className="text-left px-4 py-2.5 font-medium">
                  Enrollment Fee
                </th>
                <th className="text-center px-4 py-2.5 font-medium">Parties</th>
                <th className="text-left px-4 py-2.5 font-medium">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.06]">
              {contracts.map((c) => (
                <tr key={c.id} className="hover:bg-black/[0.02]">
                  <td className="px-4 py-3">
                    <Link
                      href={`/portal/cover/contracts/${c.id}`}
                      className="font-medium text-accent-ink hover:text-accent-emerald"
                    >
                      v{c.version}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${
                        STATUS_COLORS[c.status] ?? "bg-gray-50 text-gray-600"
                      }`}
                    >
                      {c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-accent-ink/75">
                    {formatMarkupMode(c.markupMode)}
                  </td>
                  <td className="px-4 py-3 text-accent-ink/65 text-[12px]">
                    {new Date(c.effectiveFrom).toLocaleDateString()}
                    {c.effectiveTo
                      ? ` → ${new Date(c.effectiveTo).toLocaleDateString()}`
                      : " → ongoing"}
                  </td>
                  <td className="px-4 py-3 font-mono text-[12px] text-accent-ink/65">
                    {c.enrollmentFeeNgn
                      ? koboToNaira(c.enrollmentFeeNgn)
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-center text-accent-ink/65">
                    {c.partyCount}
                  </td>
                  <td className="px-4 py-3 text-accent-ink/50 text-[12px]">
                    {new Date(c.createdAt).toLocaleDateString()}
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
