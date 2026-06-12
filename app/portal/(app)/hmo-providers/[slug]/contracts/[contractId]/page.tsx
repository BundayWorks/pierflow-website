import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  AlertCircle,
} from "lucide-react";
import { getHmoProviderBySlug } from "../../../actions";
import {
  getContractAction,
  previewPremiumAction,
  previewEnrollmentAction,
} from "../actions";
import ActivateButton from "./ActivateButton";

export const dynamic = "force-dynamic";

const KOBO_PER_NAIRA = BigInt(100);

function formatNaira(kobo: bigint | null | undefined): string {
  if (kobo === null || kobo === undefined) return "—";
  const naira = Number(kobo / KOBO_PER_NAIRA);
  return `₦${naira.toLocaleString()}`;
}

export default async function ContractDetailPage({
  params,
}: {
  params: { slug: string; contractId: string };
}) {
  const provider = await getHmoProviderBySlug(params.slug);
  if (!provider) notFound();
  const contract = await getContractAction(params.contractId);
  if (!contract || contract.providerId !== provider.id) notFound();

  // For markup modes we preview against a sample wholesale; for
  // GROSS_SHARE the "wholesale" is just the user's total premium.
  const sampleWholesaleNaira = 8500;
  const recurring = await previewPremiumAction(
    contract.id,
    contract.markupMode === "GROSS_SHARE" ? 9000 : sampleWholesaleNaira,
  );
  const enrollment = contract.enrollmentFeeNgn
    ? await previewEnrollmentAction(contract.id)
    : null;

  return (
    <div>
      <Link
        href={`/portal/hmo-providers/${provider.slug}/contracts`}
        className="inline-flex items-center gap-1.5 text-[13px] text-accent-ink/55 hover:text-accent-ink"
      >
        <ArrowLeft size={14} /> Contracts
      </Link>

      <div className="mt-4 flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="font-display text-[28px] md:text-[36px] leading-[1.05] tracking-[-0.02em] text-accent-ink font-medium">
              {provider.displayName} v{contract.version}
            </h1>
            <Chip status={contract.status} />
            <ModeChip mode={contract.markupMode} />
          </div>
          <p className="mt-2 text-[13px] text-accent-ink/65">
            Effective{" "}
            {new Date(contract.effectiveFrom).toLocaleDateString()}
            {contract.effectiveTo
              ? ` – ${new Date(contract.effectiveTo).toLocaleDateString()}`
              : ""}{" "}
            · remainder → {contract.remainderBearer}
            {contract.markupMode === "MARKUP_FIXED" && contract.markupFixedNgn
              ? ` · markup ${formatNaira(contract.markupFixedNgn)}`
              : ""}
          </p>
        </div>
        {contract.status === "DRAFT" ? (
          <ActivateButton
            contractId={contract.id}
            slug={provider.slug}
          />
        ) : null}
      </div>

      {/* ── Parties table ───────────────────────────────────────── */}
      <section className="mt-8">
        <h2 className="text-[16px] font-medium text-accent-ink">Parties</h2>
        <div className="mt-3 rounded-xl border border-black/[0.08] overflow-hidden">
          <table className="w-full text-[12px]">
            <thead className="bg-black/[0.03] text-accent-ink/55 uppercase tracking-[0.1em] text-[10px]">
              <tr>
                <th className="text-left px-3 py-2.5 font-medium">Role</th>
                <th className="text-left px-3 py-2.5 font-medium">Kind</th>
                <th className="text-left px-3 py-2.5 font-medium">Amount</th>
                <th className="text-left px-3 py-2.5 font-medium">When</th>
                <th className="text-left px-3 py-2.5 font-medium">
                  Caps / floors
                </th>
                <th className="text-left px-3 py-2.5 font-medium">
                  Settlement tag
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.06]">
              {contract.parties.map((p) => (
                <tr key={p.id}>
                  <td className="px-3 py-2.5 text-accent-ink">
                    {p.role}
                    {p.displayName ? (
                      <span className="ml-1.5 text-[11px] text-accent-ink/55">
                        ({p.displayName})
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2.5 text-accent-ink/75">
                    {p.kind === "FLAT" ? "flat ₦" : "%"}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-accent-ink">
                    {p.kind === "FLAT"
                      ? formatNaira(p.amountFlatNgn)
                      : `${((p.amountBps ?? 0) / 100).toFixed(2)}%`}
                  </td>
                  <td className="px-3 py-2.5 text-accent-ink/75 text-[11px]">
                    {p.timing.replace(/_/g, " ").toLowerCase()}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-accent-ink/55 text-[11px]">
                    {p.minPerCycleNgn || p.maxPerCycleNgn ? (
                      <>
                        {p.minPerCycleNgn
                          ? `min ${formatNaira(p.minPerCycleNgn)}`
                          : ""}{" "}
                        {p.maxPerCycleNgn
                          ? `max ${formatNaira(p.maxPerCycleNgn)}`
                          : ""}
                      </>
                    ) : (
                      <span className="text-accent-ink/35">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-accent-ink/55 text-[11px]">
                    {p.settlementAccountTag ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Preview at sample amounts ───────────────────────────── */}
      <section className="mt-8 grid lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-black/[0.08] p-4">
          <p className="text-[11px] uppercase tracking-[0.12em] text-accent-ink/45 font-medium">
            {contract.markupMode === "GROSS_SHARE"
              ? "Recurring premium ₦9,000 (sample)"
              : `Wholesale ₦${sampleWholesaleNaira.toLocaleString()} (sample)`}
          </p>
          <PremiumPreviewBlock
            result={recurring}
            mode={contract.markupMode}
            allParties={contract.parties}
          />
        </div>
        {enrollment ? (
          <div className="rounded-xl border border-black/[0.08] p-4">
            <p className="text-[11px] uppercase tracking-[0.12em] text-accent-ink/45 font-medium">
              Enrollment fee {formatNaira(contract.enrollmentFeeNgn)}
              {contract.markupMode !== "GROSS_SHARE" &&
              contract.enrollmentBeneficiaryRole
                ? ` → ${contract.enrollmentBeneficiaryRole}`
                : ""}
            </p>
            <EnrollmentPreviewBlock result={enrollment} />
          </div>
        ) : null}
      </section>

      {contract.notes ? (
        <section className="mt-8 max-w-[640px]">
          <p className="text-[11px] uppercase tracking-[0.12em] text-accent-ink/45 font-medium">
            Notes
          </p>
          <p className="mt-2 text-[13px] text-accent-ink/75 whitespace-pre-wrap">
            {contract.notes}
          </p>
        </section>
      ) : null}
    </div>
  );
}

function PremiumPreviewBlock({
  result,
  mode,
  allParties,
}: {
  result: Awaited<ReturnType<typeof previewPremiumAction>>;
  mode: string;
  allParties: { role: string; timing: string }[];
}) {
  if (!result.ok) {
    return (
      <p className="mt-2 text-[12px] text-[#a83232]">
        {result.issues.join(" ")}
      </p>
    );
  }
  const memberPaysNaira = Number(result.memberPaysNgn / KOBO_PER_NAIRA);
  const wholesaleNaira = Number(result.wholesaleNgn / KOBO_PER_NAIRA);
  const markupNaira = Number(result.markupNgn / KOBO_PER_NAIRA);
  const hmoNaira = Number(result.hmoLine.amountNgn / KOBO_PER_NAIRA);
  const includedRoles = new Set<string>(result.lines.map((l) => l.role));
  const excluded = allParties.filter(
    (p) => !includedRoles.has(p.role) && p.timing === "ENROLLMENT_ONLY",
  );

  return (
    <div className="mt-3">
      {mode !== "GROSS_SHARE" ? (
        <div className="grid grid-cols-3 gap-3 pb-2 border-b border-black/[0.06]">
          <HeaderStat label="Wholesale" value={wholesaleNaira} />
          <HeaderStat label="+ Markup" value={markupNaira} />
          <HeaderStat label="= Member pays" value={memberPaysNaira} emphasis />
        </div>
      ) : null}
      <table className="mt-2 w-full text-[12px]">
        <tbody className="divide-y divide-black/[0.05]">
          {mode !== "GROSS_SHARE" ? (
            <tr className="bg-black/[0.02]">
              <td className="py-1.5 text-accent-ink/75">HMO</td>
              <td className="py-1.5 text-right font-mono text-accent-ink">
                ₦{hmoNaira.toLocaleString()}
              </td>
              <td className="py-1.5 pl-3">
                <Badge tone="muted">wholesale</Badge>
              </td>
            </tr>
          ) : null}
          {result.lines.map((l, i) => (
            <DetailPreviewRow key={i} line={l} />
          ))}
          {excluded.length > 0 ? (
            <tr>
              <td colSpan={3} className="pt-2">
                <ExcludedDisclosure
                  label="enrollment-only — not in this split"
                  parties={excluded}
                />
              </td>
            </tr>
          ) : null}
          <tr className="border-t border-black/[0.1]">
            <td className="pt-2 text-accent-ink/55 text-[11px] uppercase tracking-[0.1em]">
              Total
            </td>
            <td className="pt-2 text-right font-mono font-medium text-accent-ink">
              ₦
              {(mode === "GROSS_SHARE"
                ? wholesaleNaira
                : memberPaysNaira
              ).toLocaleString()}
            </td>
            <td />
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function EnrollmentPreviewBlock({
  result,
}: {
  result: Awaited<ReturnType<typeof previewEnrollmentAction>>;
}) {
  if (!result.ok) {
    return (
      <p className="mt-2 text-[12px] text-[#a83232]">
        {result.issues.join(" ")}
      </p>
    );
  }
  return (
    <table className="mt-3 w-full text-[12px]">
      <tbody className="divide-y divide-black/[0.05]">
        {result.lines.map((l, i) => (
          <DetailPreviewRow key={i} line={l} />
        ))}
        <tr className="border-t border-black/[0.1]">
          <td className="pt-2 text-accent-ink/55 text-[11px] uppercase tracking-[0.1em]">
            Total
          </td>
          <td className="pt-2 text-right font-mono font-medium text-accent-ink">
            ₦
            {Number(result.memberPaysNgn / KOBO_PER_NAIRA).toLocaleString()}
          </td>
          <td />
        </tr>
      </tbody>
    </table>
  );
}

function DetailPreviewRow({
  line,
}: {
  line: {
    role: string;
    amountNgn: bigint;
    rawAmountNgn?: bigint | null;
    isRemainder: boolean;
  };
}) {
  const amount = Number(line.amountNgn / KOBO_PER_NAIRA);
  const raw =
    line.rawAmountNgn && line.rawAmountNgn !== line.amountNgn
      ? Number(line.rawAmountNgn / KOBO_PER_NAIRA)
      : null;
  // raw > amount → capped down; raw < amount → floored up.
  const cappedFrom = raw !== null && raw > amount ? raw : null;
  const flooredFrom = raw !== null && raw < amount ? raw : null;
  return (
    <tr>
      <td className="py-1.5 text-accent-ink/75">{line.role}</td>
      <td className="py-1.5 text-right font-mono text-accent-ink">
        ₦{amount.toLocaleString()}
      </td>
      <td className="py-1.5 pl-3 space-x-1.5">
        {cappedFrom !== null ? (
          <Badge tone="warn">capped from ₦{cappedFrom.toLocaleString()}</Badge>
        ) : null}
        {flooredFrom !== null ? (
          <Badge tone="warn">
            floored up from ₦{flooredFrom.toLocaleString()}
          </Badge>
        ) : null}
        {line.isRemainder ? <Badge tone="muted">remainder</Badge> : null}
      </td>
    </tr>
  );
}

function HeaderStat({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: number;
  emphasis?: boolean;
}) {
  return (
    <div>
      <p className="text-[11px] text-accent-ink/55 uppercase tracking-[0.1em] font-medium">
        {label}
      </p>
      <p
        className={`mt-0.5 text-[14px] font-mono ${
          emphasis
            ? "text-accent-emerald font-medium"
            : "text-accent-ink"
        }`}
      >
        ₦{value.toLocaleString()}
      </p>
    </div>
  );
}

function ExcludedDisclosure({
  label,
  parties,
}: {
  label: string;
  parties: { role: string; timing: string }[];
}) {
  return (
    <details className="text-[11px] text-accent-ink/55">
      <summary className="cursor-pointer hover:text-accent-ink">
        {parties.length} party{parties.length === 1 ? "" : "s"} {label}
      </summary>
      <ul className="mt-1.5 ml-3 space-y-0.5">
        {parties.map((p, i) => (
          <li key={i} className="italic text-accent-ink/45">
            {p.role}
          </li>
        ))}
      </ul>
    </details>
  );
}

function Badge({
  tone,
  children,
}: {
  tone: "muted" | "warn";
  children: React.ReactNode;
}) {
  const cls =
    tone === "warn"
      ? "bg-[#fff4d4] text-[#7a4a00]"
      : "bg-black/[0.06] text-accent-ink/55";
  return (
    <span
      className={`inline-flex items-center text-[10px] uppercase tracking-[0.08em] font-medium px-1.5 py-0.5 rounded-full ${cls}`}
    >
      {children}
    </span>
  );
}

function ModeChip({ mode }: { mode: string }) {
  const label =
    mode === "GROSS_SHARE"
      ? "Gross share"
      : mode === "MARKUP_FIXED"
        ? "Markup ₦"
        : mode === "MARKUP_FROM_SHARES"
          ? "Markup %"
          : mode;
  return (
    <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.12em] font-medium px-2 py-0.5 rounded-full bg-black/[0.05] text-accent-ink/65">
      {label}
    </span>
  );
}

function Chip({ status }: { status: string }) {
  if (status === "DRAFT") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.12em] font-medium px-2 py-0.5 rounded-full bg-[#eef2ff] text-[#3a3a8a]">
        <Clock size={10} /> Draft
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
  if (status === "SUPERSEDED") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.12em] font-medium px-2 py-0.5 rounded-full bg-black/[0.06] text-accent-ink/55">
        Superseded
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.12em] font-medium px-2 py-0.5 rounded-full bg-[#fde6e6] text-[#a83232]">
      <AlertCircle size={10} /> {status}
    </span>
  );
}
