import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Plus,
  ArrowRight,
  Receipt,
} from "lucide-react";
import { getHmoProviderBySlug } from "../../actions";
import { listContractsAction } from "./actions";

export const dynamic = "force-dynamic";

const KOBO_PER_NAIRA = BigInt(100);

function formatNaira(kobo: bigint | null | undefined): string {
  if (kobo === null || kobo === undefined) return "—";
  const naira = Number(kobo / KOBO_PER_NAIRA);
  return `₦${naira.toLocaleString()}`;
}

export default async function ContractsListPage({
  params,
}: {
  params: { slug: string };
}) {
  const provider = await getHmoProviderBySlug(params.slug);
  if (!provider) notFound();
  const contracts = await listContractsAction(provider.id);

  return (
    <div>
      <Link
        href={`/portal/hmo-providers/${provider.slug}`}
        className="inline-flex items-center gap-1.5 text-[13px] text-accent-ink/55 hover:text-accent-ink"
      >
        <ArrowLeft size={14} /> {provider.displayName}
      </Link>

      <div className="mt-4 flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h1 className="font-display text-[28px] md:text-[36px] leading-[1.05] tracking-[-0.02em] text-accent-ink font-medium">
            Contracts
          </h1>
          <p className="mt-3 text-[15px] leading-[1.7] text-accent-ink/65 max-w-[720px]">
            Versioned commercial agreements with this HMO. The active version
            governs every new enrollment&apos;s splits. Old policies stay
            locked to the version they enrolled under.
          </p>
        </div>
        <Link
          href={`/portal/hmo-providers/${provider.slug}/contracts/new`}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent-ink text-white text-[13px] font-medium shrink-0"
        >
          <Plus size={14} /> New contract
        </Link>
      </div>

      {contracts.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-black/[0.12] p-10 text-center">
          <p className="text-[14px] text-accent-ink/55">
            No contracts yet. Capture the first one to enable splits at
            enrollment and premium time.
          </p>
        </div>
      ) : (
        <ul className="mt-8 space-y-3">
          {contracts.map((c) => (
            <li key={c.id}>
              <Link
                href={`/portal/hmo-providers/${provider.slug}/contracts/${c.id}`}
                className="block rounded-xl border border-black/[0.08] p-4 hover:border-black/25 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <span className="w-9 h-9 rounded-xl bg-accent-teal-light text-accent-emerald grid place-items-center shrink-0">
                    <Receipt size={16} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-[14px] font-medium text-accent-ink">
                        v{c.version}
                      </p>
                      <Chip status={c.status} />
                      <ModeChip mode={c.markupMode} />
                      <span className="text-[11px] uppercase tracking-[0.12em] text-accent-ink/55">
                        remainder → {c.remainderBearer}
                      </span>
                    </div>
                    <p className="mt-1 text-[12px] text-accent-ink/55">
                      {c._count.parties} part
                      {c._count.parties === 1 ? "y" : "ies"} ·{" "}
                      {c.markupMode === "MARKUP_FIXED"
                        ? `markup ${formatNaira(c.markupFixedNgn)}`
                        : c.markupMode === "MARKUP_FROM_SHARES"
                          ? "markup from shares"
                          : `enrollment fee ${formatNaira(c.enrollmentFeeNgn)}`}{" "}
                      ·{" "}
                      effective{" "}
                      {new Date(c.effectiveFrom).toLocaleDateString()}
                      {c.effectiveTo
                        ? ` – ${new Date(c.effectiveTo).toLocaleDateString()}`
                        : ""}
                    </p>
                  </div>
                  <ArrowRight size={16} className="text-accent-ink/30 shrink-0" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
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
      {status}
    </span>
  );
}
